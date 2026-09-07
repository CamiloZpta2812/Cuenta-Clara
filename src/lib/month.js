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

import { monthKeyFromDate } from './dates.js';
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

  const fuentes = estado.incomeSources || [];
  const fijos = estado.fixedExpenses || [];
  const buckets = estado.buckets || [];
  const debts = estado.debts || [];

  const metas = buckets.filter((b) => b.kind === 'meta');
  const colchones = buckets.filter((b) => b.kind === 'colchon');

  const income = sum(fuentes, (f) => f.expected);
  const fixedExpenses = sum(fijos, myShare);
  const debtPayment = sum(debts, (d) => d.fixedPayment);
  const savings = sum(metas, (b) => b.monthlyAmount);
  const variable = num(guardado && guardado.variableEstimate);
  const cushion = sum(colchones, (b) => b.monthlyAmount);

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

/* Cada aporte se lleva el tipo de su bucket: el plan separa metas de colchones. */
const bucketContributions = (estado) => (estado.buckets || [])
  .flatMap((b) => (b.contributions || []).map((c) => ({ ...c, kind: b.kind })));

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
  const debtPayment = sum(debtPayments(estado).filter((p) => monthKeyFromDate(p.date) === month), (p) => p.amount);

  /*
   * Un aporte a un colchón no es lo mismo que uno a una meta, y meterlos en la
   * misma línea haría que guardar para los gatos apareciera como si te hubieras
   * pasado de ahorro. El plan los separa; lo real tiene que separarlos igual o
   * el desvío compara peras con manzanas.
   */
  const aportes = bucketContributions(estado).filter((a) => monthKeyFromDate(a.date) === month);
  const savings = sum(aportes.filter((a) => a.kind !== 'colchon'), (a) => a.amount);
  const cushion = sum(aportes.filter((a) => a.kind === 'colchon'), (a) => a.amount);

  // Variable es todo lo demás: ni fijo, ni abono a deuda, ni aporte a ahorro.
  const variable = sum(gastos.filter((t) => !t.fixedExpenseId && !t.debtId && !t.bucketId), (t) => t.amount);

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
export function simulatePlanChange(estado, cambios = {}, month) {
  const plan = monthPlan(estado, month);
  const deuda = (estado.debts || [])[0];
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
