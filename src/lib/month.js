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
import { simulate } from './amortization.js';

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

export function monthPlan(estado) {
  const fuentes = estado.incomeSources || [];
  const fijos = estado.fixedExpenses || [];
  const buckets = estado.buckets || [];
  const debts = estado.debts || [];
  const plan = estado.plan || {};

  const metas = buckets.filter((b) => b.type === 'meta');
  const colchones = buckets.filter((b) => b.type === 'colchon');

  const income = sum(fuentes, (f) => f.expected);
  const fixedExpenses = sum(fijos, myShare);
  const debtPayment = sum(debts, (d) => d.fixedPayment);
  const savings = sum(metas, (b) => b.monthlyAmount);
  const variable = num(plan.variableEstimate);
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
  };
}

/* ----------------------------------------------------------------- real -- */

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
  const debtPayment = sum((estado.debtPayments || []).filter((p) => monthKeyFromDate(p.date) === month), (p) => p.amount);
  const savings = sum((estado.bucketContributions || []).filter((a) => monthKeyFromDate(a.date) === month), (a) => a.amount);

  // Variable es todo lo demás: ni fijo, ni abono a deuda, ni aporte a ahorro.
  const variable = sum(gastos.filter((t) => !t.fixedExpenseId && !t.deudaId && !t.bucketId), (t) => t.amount);

  return {
    income,
    fixedExpenses,
    debtPayment,
    savings,
    variable,
    grossSurplus: income - fixedExpenses - debtPayment - savings - variable,
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
      detail: `Esperabas ${shortMoney(plan.ingresos)} y llevas ${shortMoney(real.ingresos)}.`,
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
  const plan = monthPlan(estado);
  const real = monthActual(estado, month);
  const salidas = monthCashOut(estado, month);

  const deviations = {};
  ['income', 'fixedExpenses', 'debtPayment', 'savings', 'variable'].forEach((k) => {
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
export function simulatePlanChange(estado, cambios = {}) {
  const plan = monthPlan(estado);
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
  const before = simulate({
    principal: deuda.currentBalance, monthlyRate: deuda.monthlyRate, payment: pago(extraBefore),
  });
  const after = simulate({
    principal: deuda.currentBalance, monthlyRate: deuda.monthlyRate, payment: pago(extraAfter),
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
