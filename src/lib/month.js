/*
 * Motor del mes: plan contra realidad.
 *
 * La app vieja solo sumaba lo que ya había pasado. Este motor responde la
 * pregunta que de verdad importa cada mes: "¿voy bien o me desvié, y cuánto
 * me queda libre para abonarle a la deuda?".
 *
 * La cascada es:
 *
 *     Ingresos
 *   − Gastos fijos (solo TU parte, no lo que te devuelven)
 *   − Cuota mínima de deudas
 *   − Ahorro (metas)
 *   − Gasto variable
 *   = Excedente bruto
 *   − Colchones (margen sin asignar)
 *   = Disponible para abono extra
 *
 * Cada línea tiene su valor planeado y su valor real, para poder señalar dónde
 * exactamente se rompió el mes en vez de dar un solo número al final.
 *
 * Todo es puro: recibe el estado, devuelve números. Ver mes.test.js.
 */

import { monthKeyFromDate, addMonths } from './dates.js';
import { simulate, monthlyRateOf } from './amortization.js';

const num = (v) => Number(v) || 0;
const sum = (arr, f) => (arr || []).reduce((s, x) => s + num(f(x)), 0);

/*
 * Lo que TÚ pagas de un gasto fijo: el valor total menos lo que reparten otros.
 * Se calcula, no se guarda, para que nunca puedan descuadrar entre sí.
 */
export function myShare(gastoFijo) {
  return num(gastoFijo.totalAmount) - sum(gastoFijo.shares, (r) => r.amount);
}

/*
 * Lo que TÚ pones en un bucket compartido, al mes.
 *
 * Mismo cálculo que en un gasto fijo, y por la misma razón: el monto guardado
 * es el del pote y tu parte se resta. El colchón de los gatos son $130.000
 * entre dos; lo que sale de tu cuenta son $65.000, pero cuando el veterinario
 * cobra, cobra de los $130.000.
 *
 * La diferencia con un gasto fijo compartido está en el dinero, no en la
 * cuenta: en el Spotify pagas tú y te devuelven, así que hay cobro. Acá cada
 * uno mete lo suyo, así que no hay nada que cobrar.
 */
export function myBucketShare(bucket) {
  return num(bucket.monthlyAmount) - sum(bucket.shares, (r) => r.amount);
}

/* Lo que te deben en total por un gasto fijo compartido. */
export function othersShare(gastoFijo) {
  return sum(gastoFijo.shares, (r) => r.amount);
}

/*
 * Los cobros del mes, uno por persona por gasto compartido, con su estado.
 * `cobros` guarda solo los que ya se marcaron como cobrados: lo demás se
 * deduce, así no hay que generar filas por adelantado cada mes.
 */
export function monthCollections(fixedExpenses, collections, month) {
  const cobrados = new Set(
    (collections || []).filter((c) => c.month === month).map((c) => c.shareId),
  );
  const filas = [];
  (fixedExpenses || []).forEach((g) => {
    (g.shares || []).forEach((r) => {
      if (num(r.amount) <= 0) return;
      filas.push({
        shareId: r.id,
        fixedExpenseId: g.id,
        fixedExpenseName: g.name,
        personId: r.personId,
        amount: num(r.amount),
        collected: cobrados.has(r.id),
      });
    });
  });
  return filas;
}

/*
 * El mes de la primera cuota de una deuda: el siguiente al del desembolso.
 *
 * Sin fecha de desembolso no hay forma de saberlo, y se devuelve null — que
 * las que llaman leen como "lleva cobrándose desde siempre". Es la lectura
 * segura: una deuda vieja sin fecha registrada sí tiene cuota este mes.
 */
export function firstInstallmentMonth(debt) {
  if (!debt || !debt.startDate) return null;
  return addMonths(monthKeyFromDate(debt.startDate), 1);
}

/*
 * Si a esta deuda le toca cuota en `month`.
 *
 * Dos razones para que no: que el crédito se haya desembolsado este mes —la
 * primera cuota es la del mes entrante— o que ya esté pago.
 *
 * Sin esto, un crédito desembolsado el 8 de septiembre le restaba su cuota al
 * plan de septiembre: un mes que el banco no cobró. El plan se cobraba a sí
 * mismo una cuota inexistente y el disponible salía 446.413 más pobre de lo
 * que era.
 */
export function debtDueIn(debt, month) {
  if (!debt) return false;
  if (debt.currentBalance != null && num(debt.currentBalance) <= 0) return false;
  if (!month) return true;
  const primera = firstInstallmentMonth(debt);
  return !primera || month >= primera;
}

/* ------------------------------------------------------------- planeado -- */

/*
 * El plan guardado de un mes, si existe. `monthlyPlans` es la foto de cada mes:
 * si en diciembre te sube el arriendo, noviembre no debería reescribirse.
 */
export function storedPlan(estado, month) {
  return (estado.monthlyPlans || []).find((p) => p.month === month) || null;
}

export function monthPlan(estado, month) {
  const guardado = storedPlan(estado, month);

  /*
   * Un mes cerrado ya no se recalcula: se juzga contra los números que tenía
   * entonces. Recalcularlo con los gastos de hoy diría que en marzo te
   * desviaste por un arriendo que solo subió en diciembre.
   */
  if (guardado && guardado.locked) return frozenPlan(guardado);

  /*
   * Una fuente inactiva es una que dejaste de recibir —se acabó el contrato,
   * saliste del club— y no se borra para no perder el historial. Contarla
   * infla el plan con plata que no va a entrar.
   */
  const fuentes = (estado.incomeSources || []).filter((f) => f.active !== false);
  const fijos = estado.fixedExpenses || [];
  const buckets = estado.buckets || [];
  const debts = estado.debts || [];

  const metas = buckets.filter((b) => b.kind === 'meta');
  const colchones = buckets.filter((b) => b.kind === 'colchon');

  const income = sum(fuentes, (f) => f.expected);
  const fixedExpenses = sum(fijos, myShare);
  const debtPayment = sum(debts.filter((d) => debtDueIn(d, month)), (d) => d.fixedPayment);
  /*
   * Solo tu parte, igual que en los gastos fijos: de un fondo común de 600.000
   * entre dos, lo que sale de tu cuenta son 300.000.
   */
  const savings = sum(metas, myBucketShare);
  const variable = num(guardado && guardado.variableEstimate);
  const cushion = sum(colchones, myBucketShare);

  const grossSurplus = income - fixedExpenses - debtPayment - savings - variable;

  return {
    income,
    fixedExpenses,
    debtPayment,
    savings,
    variable,
    grossSurplus,
    cushion,
    availableForExtra: grossSurplus - cushion,
    receivable: sum(fijos, othersShare),
    locked: false,
  };
}

/* Un mes cerrado: los mismos campos, leídos de la foto en vez de recalculados. */
function frozenPlan(p) {
  const grossSurplus = num(p.expectedIncome) - num(p.fixedExpenses)
    - num(p.debtPayment) - num(p.savings) - num(p.variableEstimate);
  return {
    income: num(p.expectedIncome),
    fixedExpenses: num(p.fixedExpenses),
    debtPayment: num(p.debtPayment),
    savings: num(p.savings),
    variable: num(p.variableEstimate),
    grossSurplus,
    cushion: num(p.cushion),
    availableForExtra: grossSurplus - num(p.cushion),
    receivable: 0,
    locked: true,
  };
}

/* ----------------------------------------------------------------- real -- */

/*
 * Los abonos y los aportes viven dentro de su deuda y de su bucket, igual que
 * en el resto de la app. Aquí se aplanan para poder filtrarlos por mes; tenerlos
 * además sueltos en el estado sería el mismo dato dos veces.
 */
const debtPayments = (estado) => (estado.debts || []).flatMap((d) => d.payments || []);

/*
 * Cada aporte se lleva el tipo de su bucket y si mueve plata.
 *
 * Un aporte guarda TU plata, no la del pote. Antes guardaba la del pote y aquí
 * se multiplicaba por tu fracción, lo cual solo funcionaba si los dos metían
 * lo suyo el mismo día y por partes iguales. En cuanto uno paga su mitad en
 * dos quincenas —150.000 el 15 y 150.000 el 30— la cuenta se partía: la app
 * leía cada depósito como si fuera del pote y te acreditaba la mitad, o sea
 * 150.000 de los 300.000 que de verdad pusiste.
 *
 * La conversión sigue existiendo, pero se hace al RETIRAR y en la pantalla,
 * donde se puede ver: sacar 200.000 del pote de los gatos te cuesta 100.000.
 * Aportar no necesita conversión porque lo que aportas ya es tuyo.
 */
const bucketContributions = (estado) => (estado.buckets || []).flatMap((b) => (
  (b.contributions || []).map((c) => ({
    ...c, kind: b.kind, movesCash: b.movesCash !== false,
  }))
));

/* De qué tipo es la reserva a la que apunta un gasto, si es que apunta a una. */
function reservaKind(estado, bucketId) {
  const b = (estado.buckets || []).find((x) => x.id === bucketId);
  return b && b.movesCash === false ? b.kind : null;
}

/*
 * Clasifica los movimientos del mes en las mismas líneas del plan.
 *
 * Un movimiento cuenta en el mes de su FECHA DE GASTO (cuándo consumiste), no
 * en el de la salida de caja. Para efectivo y débito es lo mismo; para tarjeta
 * de crédito no, y ahí está la diferencia que la app vieja se saltaba: una
 * compra con tarjeta es gasto de septiembre aunque la plata salga en octubre.
 */
export function monthActual(estado, month) {
  const transactions = (estado.transactions || []).filter((t) => monthKeyFromDate(t.date) === month);

  const income = sum(transactions.filter((t) => t.type === 'ingreso'), (t) => t.amount);
  const gastos = transactions.filter((t) => t.type === 'gasto');

  const fixedExpenses = sum(gastos.filter((t) => t.fixedExpenseId), (t) => t.amount);

  /*
   * Abonar a una deuda no es gastar: es cambiar de sitio un pasivo. La plata
   * sale, sí, pero el plan ya la tiene contada en su propia línea.
   *
   * Los abonos llegan por dos vías. Los que se registran desde la pantalla de
   * deuda dejan una fila en `payments` y un movimiento enlazado por
   * debtPaymentId. Los que alguien anota a mano —al consolidar deudas, por
   * ejemplo— son solo un movimiento en la categoría "deudas".
   *
   * Se suman las dos, pero el movimiento enlazado se descuenta: su fila en
   * `payments` ya lo representa, y contarlo dos veces diría que pagaste el
   * doble.
   */
  const abonosRegistrados = debtPayments(estado).filter((p) => monthKeyFromDate(p.date) === month);
  const abonosSueltos = gastos.filter((t) => t.category === 'deudas' && !t.debtPaymentId);
  const debtPayment = sum(abonosRegistrados, (p) => p.amount) + sum(abonosSueltos, (t) => t.amount);

  /*
   * Un aporte a un colchón no es lo mismo que uno a una meta, y meterlos en la
   * misma línea haría que guardar para los gatos apareciera como si te hubieras
   * pasado de ahorro. El plan los separa; lo real tiene que separarlos igual o
   * el desvío compara peras con manzanas.
   *
   * Y un bucket se mide distinto según si mueve la plata o no:
   *
   *   colchón real  por lo que aportaste — la plata se fue a otra cuenta
   *   reserva       por lo que llevas gastado de ella — la plata nunca se movió
   *
   * De un bucket compartido se cuenta solo tu parte: el pote se mueve completo,
   * pero de tu cuenta sale la fracción que te toca.
   */
  const aportes = bucketContributions(estado).filter((a) => monthKeyFromDate(a.date) === month);
  const gastosDeReserva = gastos.filter((t) => t.bucketId);

  const porBucket = (kind) => {
    const deAportes = sum(
      aportes.filter((a) => a.kind === kind && a.movesCash !== false),
      (a) => a.amount,
    );
    const deGastos = sum(
      gastosDeReserva.filter((t) => reservaKind(estado, t.bucketId) === kind),
      (t) => t.amount,
    );
    return deAportes + deGastos;
  };

  const savings = porBucket('meta');
  const cushion = porBucket('colchon');

  // Variable es todo lo demás: ni fijo, ni abono a deuda, ni aporte a ahorro.
  const variable = sum(
    gastos.filter((t) => !t.fixedExpenseId && !t.debtId && !t.bucketId && t.category !== 'deudas'),
    (t) => t.amount,
  );

  const grossSurplus = income - fixedExpenses - debtPayment - savings - variable;

  return {
    income,
    fixedExpenses,
    debtPayment,
    savings,
    variable,
    grossSurplus,
    cushion,
    availableForExtra: grossSurplus - cushion,
    transactions: transactions.length,
  };
}

/* ---------------------------------------------------------- salidas caja -- */

/*
 * Lo que de verdad sale de la cuenta este mes, que no es lo mismo que lo que
 * gastaste: aquí sí manda la fecha de salida de caja, así que una compra con
 * tarjeta del mes pasado aparece ahora, y la de este mes aparecerá después.
 */
export function monthCashOut(estado, month) {
  const porFecha = (t) => monthKeyFromDate(t.cashOutDate || t.date);
  const gastos = (estado.transactions || []).filter((t) => t.type === 'gasto' && porFecha(t) === month);
  return {
    total: sum(gastos, (t) => t.amount),
    conTarjeta: sum(gastos.filter((t) => t.paymentMethod === 'credito'), (t) => t.amount),
    sinTarjeta: sum(gastos.filter((t) => t.paymentMethod !== 'credito'), (t) => t.amount),
  };
}

/* -------------------------------------------------------------- alertas -- */

/*
 * Las reglas que el usuario quiere que la app le recuerde. Cada una dice qué
 * pasó y cuánto cuesta, con cifras, no con un regaño genérico.
 */
export function monthAlerts(estado, month, plan, real) {
  const alerts = [];

  const pendientes = monthCollections(estado.fixedExpenses, estado.collections, month).filter((c) => !c.collected);
  if (pendientes.length > 0) {
    const total = sum(pendientes, (c) => c.amount);
    alerts.push({
      type: 'cobro',
      severity: 'aviso',
      title: `Te deben ${pendientes.length} cobro${pendientes.length === 1 ? '' : 's'} este mes`,
      amount: total,
      // Lo que pesa no es el mes, es el año: es plata tuya que se queda en la calle.
      detail: `${shortMoney(total)} este mes. Si se te pasa todos los meses son ${shortMoney(total * 12)} al año.`,
    });
  }

  if (plan.variable > 0 && real.variable > plan.variable) {
    const exceso = real.variable - plan.variable;
    alerts.push({
      type: 'variable',
      severity: exceso > plan.variable * 0.2 ? 'alerta' : 'aviso',
      title: 'Te pasaste del gasto variable estimado',
      amount: exceso,
      detail: `Llevas ${shortMoney(real.variable)} de ${shortMoney(plan.variable)} estimados. Eso sale del abono a la deuda.`,
    });
  }

  if (real.income > 0 && real.income < plan.income * 0.95) {
    alerts.push({
      type: 'ingreso',
      severity: 'aviso',
      title: 'Entró menos de lo planeado',
      amount: plan.income - real.income,
      detail: `Esperabas ${shortMoney(plan.income)} y llevas ${shortMoney(real.income)}.`,
    });
  }

  return alerts;
}

function shortMoney(n) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(Math.round(n || 0));
}

/* ---------------------------------------------------------------- todo --- */

export function monthSummary(estado, month) {
  const plan = monthPlan(estado, month);
  const real = monthActual(estado, month);
  const salidas = monthCashOut(estado, month);

  const deviations = {};
  ['income', 'fixedExpenses', 'debtPayment', 'savings', 'variable', 'cushion'].forEach((k) => {
    deviations[k] = real[k] - plan[k];
  });

  return {
    month,
    plan,
    real,
    salidas,
    deviations,
    collections: monthCollections(estado.fixedExpenses, estado.collections, month),
    alerts: monthAlerts(estado, month, plan, real),
  };
}


/* --------------------------------------------------------------- deuda -- */

/*
 * A cuál deuda le estás abonando de más.
 *
 * Sin un id explícito se ataca la más cara: mayor tasa, y a igual tasa la de
 * mayor saldo. Antes esto era `debts[0]` — el orden en que Postgres devolviera
 * las filas, o sea azar. Con una sola deuda daba igual; con nueve, el
 * simulador habría estado hablando de una deuda cualquiera sin decirlo.
 */
export function targetDebt(estado, debtId) {
  const debts = estado.debts || [];
  if (debtId) return debts.find((d) => d.id === debtId) || null;
  return [...debts].sort((a, b) => (
    (num(b.interestRate) - num(a.interestRate))
    || (num(b.currentBalance) - num(a.currentBalance))
  ))[0] || null;
}

/* ------------------------------------------------------------ simulador -- */

/*
 * "¿Y si le bajo al colchón?" / "¿Y si me sube el arriendo?"
 *
 * Aplica cambios sobre el plan y devuelve qué pasa con la deuda. Es lo que se
 * muestra ANTES de confirmar un cambio, para que nadie mueva un número sin ver
 * lo que cuesta en meses.
 *
 * Los cambios son sumas o restas sobre las líneas del plan, no valores nuevos:
 * { colchon: -150000 } significa "bajo el colchón en 150.000".
 */
export function simulatePlanChange(estado, cambios = {}, month, debtId) {
  const plan = monthPlan(estado, month);
  const deuda = targetDebt(estado, debtId);
  if (!deuda) return null;

  const delta = Object.values(cambios).reduce((s, v) => s - num(v), 0);
  const extraBefore = plan.availableForExtra;
  const extraAfter = extraBefore + delta;

  /*
   * Sin recortar en cero a propósito. Si el plan queda en déficit, no es que
   * "abones cero": es que no te alcanza ni para la cuota mínima, y eso tiene
   * que verse. Recortarlo mostraría un plan de pago que no existe.
   */
  const pago = (a) => num(deuda.fixedPayment) + a;
  const tasa = monthlyRateOf(deuda);
  const before = simulate({
    principal: deuda.currentBalance, monthlyRate: tasa, payment: pago(extraBefore),
  });
  const after = simulate({
    principal: deuda.currentBalance, monthlyRate: tasa, payment: pago(extraAfter),
  });

  return {
    /* Cuál deuda se está simulando: con más de una, no decirlo sería adivinanza. */
    debtId: deuda.id,
    debtName: deuda.name,
    extraBefore,
    extraAfter,
    before,
    after,
    // El plan no cierra: los gastos se comen hasta la cuota mínima.
    deficit: extraAfter < 0,
    monthsDifference: before.feasible && after.feasible ? before.months - after.months : null,
    interestDifference: before.feasible && after.feasible
      ? before.totalInterest - after.totalInterest : null,
    becomesUnpayable: before.feasible && !after.feasible,
  };
}
