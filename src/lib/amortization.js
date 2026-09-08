/*
 * Motor de amortización de deuda.
 *
 * Antes la app trataba una deuda como "total menos lo abonado". Eso no dice lo
 * único que de verdad importa: cuánto de cada pago se va en intereses, cuándo
 * terminas, y cuánto te ahorras si abonas de más.
 *
 * El modelo es el de un crédito de cuota fija (sistema francés), que es como
 * funciona un libre inversión:
 *
 *   interés del mes = saldo × tasa mensual
 *   capital del mes = pago − interés
 *   saldo nuevo     = saldo − capital
 *
 * Abonar de más NO cambia el valor de la cuota: baja el saldo, por lo que el
 * mes siguiente se va menos plata en intereses y más a capital. El efecto es
 * que se acaban antes las cuotas. Eso es lo que hace el banco cuando "recalcula
 * a menos cuotas manteniendo la cuota fija".
 *
 * Todo aquí es puro y trabaja con números sin redondear; el redondeo es cosa de
 * la presentación. Ver amortizacion.test.js.
 */

const MAX_MESES = 1200; // 100 años: tope de seguridad, no un límite real

/*
 * La deuda guarda UNA sola cifra de tasa: `interestRate`, el porcentaje mensual
 * (1,67 = 1,67%), que es como la reporta el banco y como ya la pedían las
 * pantallas viejas. Los motores trabajan en decimal, así que la conversión vive
 * aquí en vez de guardarse dos veces y poder descuadrar.
 */
export function monthlyRateOf(debt) {
  return (Number(debt && debt.interestRate) || 0) / 100;
}

/*
 * Corre el crédito mes a mes hasta liquidarlo.
 *
 *   principal   saldo inicial
 *   monthlyRate tasa mensual en decimal (1,67% -> 0.0167)
 *   payment     lo que pagas cada mes (cuota + abono extra)
 *   extra       abono adicional, si prefieres pasarlo aparte de la cuota
 *
 * Devuelve { schedule, months, totalPaid, totalInterest, feasible }.
 *
 * Si el pago no alcanza a cubrir ni los intereses, la deuda nunca se acaba:
 * en ese caso feasible = false y se devuelve el pago mínimo que haría falta.
 * Es un caso real —una tarjeta pagando solo el mínimo— y callarlo sería el
 * peor error posible en una app de finanzas.
 */
export function simulate({ principal, monthlyRate, payment, extra = 0, maxMonths = MAX_MESES }) {
  const saldoInicial = Number(principal) || 0;
  const tasa = Number(monthlyRate) || 0;
  const pagoMensual = (Number(payment) || 0) + (Number(extra) || 0);

  if (saldoInicial <= 0) {
    return { schedule: [], months: 0, totalPaid: 0, totalInterest: 0, feasible: true };
  }

  const interesPrimerMes = saldoInicial * tasa;
  if (pagoMensual <= interesPrimerMes) {
    return {
      schedule: [],
      months: Infinity,
      totalPaid: Infinity,
      totalInterest: Infinity,
      feasible: false,
      // Con esto apenas se cubren los intereses; hay que pagar más para bajar capital.
      minimumPayment: interesPrimerMes,
    };
  }

  const schedule = [];
  let saldo = saldoInicial;
  let totalPagado = 0;
  let totalInteres = 0;

  for (let month = 1; month <= maxMonths && saldo > 0; month += 1) {
    const apertura = saldo;
    const interes = apertura * tasa;
    // El último mes se paga solo lo que falta, no la cuota completa.
    const pago = Math.min(pagoMensual, apertura + interes);
    const capital = pago - interes;
    saldo = apertura - capital;
    if (saldo < 1e-6) saldo = 0;   // ruido de coma flotante

    totalPagado += pago;
    totalInteres += interes;
    schedule.push({ month: month, opening: apertura, interest: interes, principal: capital, payment: pago, closing: saldo });
  }

  return {
    schedule,
    months: schedule.length,
    totalPaid: totalPagado,
    totalInterest: totalInteres,
    feasible: saldo === 0,
  };
}

/*
 * Reconstruye lo que YA pagaste, cuota por cuota.
 *
 * De un abono solo se guardan tres cosas: cuánto, cuándo, y el saldo que
 * reportó el banco si lo anotaste. Cuánto de ese pago se fue en intereses no se
 * guarda — se deduce, corriendo el crédito hacia adelante igual que él:
 *
 *   interés = saldo × tasa      capital = pago − interés
 *
 * Cuando hay saldo reportado, se usa ESE como saldo de cierre y el modelo se
 * vuelve a anclar ahí. Así una diferencia con el banco —un seguro, un día de
 * mora, un redondeo— no se arrastra al resto de la tabla: se queda en su fila.
 * La fila queda marcada con `anchored` para poder decir cuál viene del banco.
 */
export function replayPayments({ principal, monthlyRate, payments }) {
  const tasa = Number(monthlyRate) || 0;
  let saldo = Number(principal) || 0;

  return [...(payments || [])]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((p, i) => {
      const apertura = saldo;
      const interes = apertura * tasa;
      const pago = Number(p.amount) || 0;
      const reportado = p.balanceAfter;
      const anchored = reportado !== null && reportado !== undefined && reportado !== '';

      const cierre = anchored
        ? Math.max(0, Number(reportado))
        : Math.max(0, apertura + interes - pago);

      saldo = cierre;
      return {
        month: i + 1,
        date: p.date,
        monthKey: p.month || null,
        opening: apertura,
        interest: interes,
        principal: pago - interes,
        payment: pago,
        closing: cierre,
        anchored,
        paid: true,
      };
    });
}

/*
 * Cuota fija de un crédito a N meses (fórmula de anualidad).
 * Sirve para deducir la cuota cuando conoces el plazo, o el plazo cuando
 * conoces la cuota.
 */
export function levelPayment(principal, monthlyRate, months) {
  const P = Number(principal) || 0;
  const i = Number(monthlyRate) || 0;
  const n = Number(months) || 0;
  if (P <= 0 || n <= 0) return 0;
  if (i === 0) return P / n;
  return (P * i) / (1 - (1 + i) ** -n);
}

/*
 * Cuántos meses faltan pagando una cuota dada. Devuelve null si la cuota no
 * alcanza ni para los intereses.
 */
export function monthsRemaining(principal, monthlyRate, payment) {
  const P = Number(principal) || 0;
  const i = Number(monthlyRate) || 0;
  const A = Number(payment) || 0;
  if (P <= 0) return 0;
  if (i === 0) return A > 0 ? Math.ceil(P / A) : null;
  if (A <= P * i) return null;
  return Math.ceil(-Math.log(1 - (P * i) / A) / Math.log(1 + i));
}

/*
 * Compara pagar solo la cuota mínima contra pagar cuota + abono extra.
 * Es el número que de verdad motiva: cuántos meses y cuánta plata te ahorras.
 */
export function comparePlans({ principal, monthlyRate, minimumPayment, extra }) {
  const minimumOnly = simulate({ principal, monthlyRate, payment: minimumPayment });
  const withExtra = simulate({ principal, monthlyRate, payment: minimumPayment, extra });

  return {
    minimumOnly,
    withExtra,
    monthsSaved: minimumOnly.feasible && withExtra.feasible
      ? minimumOnly.months - withExtra.months : null,
    interestSaved: minimumOnly.feasible && withExtra.feasible
      ? minimumOnly.totalInterest - withExtra.totalInterest : null,
  };
}

/*
 * Cuánto atrasa la liquidación un nuevo compromiso mensual (una compra a
 * cuotas, por ejemplo) que le quita plata al abono extra.
 *
 * Este es el número del guardarraíl: en vez de bloquear la compra, se le
 * muestra al usuario lo que cuesta en meses de deuda.
 */
export function impactOfNewCommitment({ principal, monthlyRate, payment, monthlyCommitment }) {
  const before = simulate({ principal, monthlyRate, payment });
  const after = simulate({ principal, monthlyRate, payment: payment - monthlyCommitment });

  return {
    before,
    after,
    extraMonths: before.feasible && after.feasible ? after.months - before.months : null,
    extraInterest: before.feasible && after.feasible
      ? after.totalInterest - before.totalInterest : null,
    becomesUnpayable: before.feasible && !after.feasible,
  };
}

/*
 * Saldo después de N meses. Útil para dibujar la proyección sin tener que
 * recorrer el cronograma completo desde fuera.
 */
export function projectedBalance(schedule, month) {
  if (month <= 0) return schedule.length ? schedule[0].opening : 0;
  const fila = schedule[month - 1];
  return fila ? fila.closing : 0;
}
