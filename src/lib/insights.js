import { AlertTriangle, TrendingUp, Wallet, Check } from 'lucide-react';
import { COLORS } from './constants.js';
import { getCategory } from './categories.js';
import { monthKeyFromDate, monthsBetween } from './dates.js';
import { fmtCOP } from './money.js';
import { monthPlan, monthActual, myBucketShare } from './month.js';

/*
 * Recomendaciones: lo que se ve mirando más lejos que el mes.
 *
 * La versión anterior leía el modelo viejo y decía cosas falsas — "no tienes
 * metas de ahorro creadas" cuando hay seis buckets, o sugerir el método
 * avalancha teniendo una sola deuda, que es como recomendarle a alguien que
 * escoja bien entre su único par de zapatos.
 *
 * Dos reglas para que esto no vuelva a pasar:
 *
 *   1. Se calcula sobre el PLAN, no sobre los movimientos registrados. El plan
 *      está completo desde el día uno; los movimientos van llegando. Basar un
 *      consejo en lo registrado es hablar de un mes a medio anotar.
 *
 *   2. No se repite lo que ya dice El mes —cobros pendientes, gasto variable
 *      desbordado, plata que falta por salir—. Esto es para lo que solo se ve
 *      en el horizonte largo: si el colchón alcanza, si la deuda pesa
 *      demasiado, si una meta no va a llegar a su fecha.
 */

const num = (v) => Number(v) || 0;
const sum = (arr, f) => (arr || []).reduce((s, x) => s + num(f(x)), 0);

/* Lo acumulado en un bucket, contando solo tu parte del pote. */
function acumuladoMio(b) {
  const total = num(b.monthlyAmount);
  const factor = total > 0 ? myBucketShare(b) / total : 1;
  return sum(b.contributions, (c) => c.amount) * factor;
}

export function buildRecommendations(estado, month) {
  const recs = [];
  const plan = monthPlan(estado, month);
  const real = monthActual(estado, month);
  const buckets = estado.buckets || [];
  const debts = estado.debts || [];

  /* ------------------------------------------------------ peso de la deuda */

  const saldoDeuda = sum(debts, (d) => (d.currentBalance != null
    ? d.currentBalance
    : Math.max(0, num(d.totalAmount) - sum(d.payments, (p) => p.amount))));

  if (plan.income > 0 && saldoDeuda > plan.income * 3) {
    recs.push({
      kind: 'warning',
      text: `Tu deuda (${fmtCOP(saldoDeuda)}) equivale a ${(saldoDeuda / plan.income).toFixed(1)} meses de ingreso. Mientras esté así, cada gasto nuevo se paga con meses de crédito.`,
    });
  }

  /*
   * La avalancha solo tiene sentido si hay entre qué escoger. Con una sola
   * deuda el consejo es ruido con cara de consejo.
   */
  const conTasa = debts.filter((d) => num(d.interestRate) > 0);
  if (conTasa.length > 1) {
    const cara = [...conTasa].sort((a, b) => num(b.interestRate) - num(a.interestRate))[0];
    recs.push({
      kind: 'tip',
      text: `Tienes ${conTasa.length} deudas con interés. La más cara es "${cara.name}" al ${cara.interestRate}% mensual: mandarle ahí el abono extra te ahorra más que repartirlo.`,
    });
  }

  /* ------------------------------------------------------------- colchones */

  const colchones = buckets.filter((b) => b.kind === 'colchon' && b.movesCash !== false);
  const disponible = sum(colchones.filter((b) => b.liquid !== false), acumuladoMio);
  const mesesCubiertos = plan.fixedExpenses > 0 ? disponible / plan.fixedExpenses : 0;

  if (colchones.length === 0) {
    recs.push({
      kind: 'tip',
      text: 'No tienes colchones. Uno de emergencia que cubra 3 meses de gastos fijos es lo que evita que un imprevisto se vuelva deuda.',
    });
  } else if (mesesCubiertos < 1 && plan.fixedExpenses > 0) {
    recs.push({
      kind: 'warning',
      text: `Tus colchones cubren ${(mesesCubiertos * 30).toFixed(0)} días de gastos fijos. Con menos de un mes de margen, cualquier imprevisto tiene que salir de la deuda.`,
    });
  } else if (mesesCubiertos >= 3) {
    recs.push({
      kind: 'success',
      text: `Tus colchones cubren ${mesesCubiertos.toFixed(1)} meses de gastos fijos. Ese margen es lo que te deja abonarle a la deuda sin miedo.`,
    });
  }

  /*
   * Una reserva pasada de su cupo. Es distinto a desviarse en el gasto
   * variable: la reserva tenía un monto pensado, y saberlo a tiempo sirve para
   * ajustarlo el mes entrante en vez de descubrirlo al final.
   */
  buckets.filter((b) => b.movesCash === false).forEach((b) => {
    const cupo = myBucketShare(b);
    const gastado = sum(
      (estado.transactions || []).filter((t) => t.type === 'gasto' && t.bucketId === b.id
        && monthKeyFromDate(t.date) === month),
      (t) => t.amount,
    );
    if (cupo > 0 && gastado > cupo) {
      recs.push({
        kind: 'warning',
        text: `"${b.name}" se pasó de lo reservado: llevas ${fmtCOP(gastado)} de ${fmtCOP(cupo)}. O subes el cupo, o sale del abono a la deuda.`,
      });
    }
  });

  /* ----------------------------------------------------------------- metas */

  buckets.filter((b) => b.kind !== 'colchon' && b.targetAmount > 0 && b.targetDate).forEach((b) => {
    const llevado = sum(b.contributions, (c) => c.amount);
    const falta = num(b.targetAmount) - llevado;
    if (falta <= 0) return;
    const meses = monthsBetween(month, monthKeyFromDate(b.targetDate));
    if (meses <= 0) {
      recs.push({
        kind: 'warning',
        text: `La fecha de "${b.name}" ya pasó y todavía faltan ${fmtCOP(falta)}.`,
      });
      return;
    }
    const necesario = falta / meses;
    if (necesario > num(b.monthlyAmount) * 1.2) {
      recs.push({
        kind: 'tip',
        text: `Para que "${b.name}" llegue a tiempo harían falta ${fmtCOP(necesario)} al mes, y vas aportando ${fmtCOP(b.monthlyAmount)}. O subes el aporte, o corres la fecha.`,
      });
    }
  });

  /* ----------------------------------------------------- peso de los fijos */

  if (plan.income > 0 && plan.fixedExpenses / plan.income > 0.5) {
    recs.push({
      kind: 'warning',
      text: `Tus gastos fijos son el ${((plan.fixedExpenses / plan.income) * 100).toFixed(0)}% de lo que entra. Con ese margen, un mes malo no tiene de dónde salir.`,
    });
  }

  /*
   * En qué se va el gasto variable. Se mira solo lo variable a propósito: los
   * fijos y los abonos son decisiones ya tomadas, y meterlos hacía que la
   * recomendación de siempre fuera "recorta en pago de deudas".
   */
  const variables = (estado.transactions || []).filter((t) => t.type === 'gasto'
    && monthKeyFromDate(t.date) === month
    && !t.fixedExpenseId && !t.debtId && !t.bucketId && t.category !== 'deudas');
  const totalVariable = sum(variables, (t) => t.amount);
  if (totalVariable > 0) {
    const porCat = {};
    variables.forEach((t) => { porCat[t.category] = (porCat[t.category] || 0) + num(t.amount); });
    const [catId, monto] = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
    const parte = monto / totalVariable;
    if (parte > 0.4) {
      recs.push({
        kind: 'tip',
        text: `${getCategory(catId).label} es el ${(parte * 100).toFixed(0)}% de tu gasto variable (${fmtCOP(monto)}). Es la línea que sí puedes mover.`,
      });
    }
  }

  /* ------------------------------------------------------- lo que va bien */

  if (plan.income > 0 && plan.availableForExtra > 0) {
    const parte = plan.availableForExtra / plan.income;
    if (parte >= 0.15 && real.variable <= plan.variable) {
      recs.push({
        kind: 'success',
        text: `Le estás mandando el ${(parte * 100).toFixed(0)}% de lo que entra a la deuda por encima de la cuota. A ese ritmo se acaba mucho antes de lo pactado.`,
      });
    }
  }

  const prioridad = { warning: 0, tip: 1, success: 2 };
  return recs.sort((a, b) => prioridad[a.kind] - prioridad[b.kind]).slice(0, 5);
}

/*
 * El estado del mes, para el sello de arriba.
 *
 * Sale del plan y no de los movimientos: registrar va con retraso, y con el
 * mes a medio anotar el sello decía "revisar gastos" el día 3 simplemente
 * porque todavía no había entrado la quincena.
 */
export function getStatus(plan) {
  if (!plan || plan.income === 0) {
    return { label: 'Sin plan este mes', color: COLORS.inkSoft, Icon: Wallet };
  }
  if (plan.availableForExtra < 0) {
    return { label: 'El plan no cierra', color: COLORS.expense, Icon: AlertTriangle };
  }
  if (plan.availableForExtra / plan.income >= 0.15) {
    return { label: 'Vas bien', color: COLORS.income, Icon: Check };
  }
  return { label: 'Ajustado', color: COLORS.savings, Icon: TrendingUp };
}
