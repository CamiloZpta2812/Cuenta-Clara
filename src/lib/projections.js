import { computeChargeDate, monthKeyFromDate, addMonths, todayStr, daysInMonth } from './dates.js';

/*
 * Dos preguntas que la app calculaba a medias y nunca respondía:
 *
 *   1. "¿Cuánto me va a llegar en la factura de esta tarjeta y cuándo la pago?"
 *      computeChargeDate() ya existía, pero solo se usaba para un texto de
 *      ayuda en el formulario. Un gasto con crédito se restaba del saldo el día
 *      de la compra, cuando la plata en realidad sale al pagar la factura.
 *
 *   2. "¿Cuánto tengo ya comprometido en marzo?"
 *      Una compra a 12 cuotas solo registraba la cuota 1; las otras 11 eran
 *      invisibles hasta que se registraban a mano, mes a mes.
 */

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/* ------------------------------------------------------------ facturas ---- */

/*
 * Agrupa los movimientos de una tarjeta por la fecha en que se cobran de
 * verdad. Sin día de corte y de pago configurados no hay nada que calcular.
 */
export function buildCardStatements(transactions, card) {
  if (!card || !card.cutDay || !card.paymentDay) return [];

  const porFecha = new Map();
  transactions
    .filter((t) => t.cardId === card.id && t.type === 'gasto')
    .forEach((t) => {
      const cobro = computeChargeDate(t.date, card.cutDay, card.paymentDay);
      if (!cobro) return;
      const clave = iso(cobro);
      if (!porFecha.has(clave)) porFecha.set(clave, { paymentDate: clave, total: 0, items: [] });
      const factura = porFecha.get(clave);
      factura.total += t.amount;
      factura.items.push(t);
    });

  return [...porFecha.values()].sort((a, b) => (a.paymentDate < b.paymentDate ? -1 : 1));
}

/*
 * La próxima factura por pagar: la primera cuyo día de pago aún no ha llegado.
 * Si todas ya pasaron, devuelve null.
 */
export function nextStatement(statements, today = todayStr()) {
  return statements.find((f) => f.paymentDate >= today) || null;
}

/* Las facturas cuyo día de pago ya pasó, de más reciente a más vieja. */
export function pastStatements(statements, today = todayStr()) {
  return statements.filter((f) => f.paymentDate < today).reverse();
}

/* ------------------------------------------------------------ cuotas ------ */

/*
 * Agrupa las compras a cuotas y devuelve, por cada una, en qué va y cuánto
 * falta. Se toma la cuota registrada más alta como la última pagada.
 */
export function activeInstallmentGroups(transactions) {
  const grupos = new Map();
  transactions
    .filter((t) => t.isInstallment && t.totalInstallments)
    .forEach((t) => {
      const id = t.installmentGroupId || t.id;
      const previo = grupos.get(id);
      if (!previo || (t.currentInstallment || 0) > (previo.currentInstallment || 0)) {
        grupos.set(id, t);
      }
    });

  return [...grupos.entries()]
    .map(([id, ultima]) => ({
      groupId: id,
      last: ultima,
      paid: ultima.currentInstallment || 0,
      total: ultima.totalInstallments,
      remaining: Math.max(0, ultima.totalInstallments - (ultima.currentInstallment || 0)),
      monthly: ultima.amount,
    }))
    .filter((g) => g.remaining > 0);
}

/*
 * Reparte las cuotas que faltan en los meses que vienen: la siguiente cae el
 * mes después de la última registrada, y de ahí una por mes.
 */
export function projectInstallments(transactions, monthKeys) {
  const porMes = {};
  monthKeys.forEach((k) => { porMes[k] = { total: 0, items: [] }; });

  activeInstallmentGroups(transactions).forEach((g) => {
    const desde = monthKeyFromDate(g.last.date);
    for (let i = 1; i <= g.remaining; i += 1) {
      const mes = addMonths(desde, i);
      if (!porMes[mes]) continue;   // cae fuera de la ventana que se pidió
      porMes[mes].total += g.monthly;
      porMes[mes].items.push({
        groupId: g.groupId,
        note: g.last.note || '',
        category: g.last.category,
        cuota: g.paid + i,
        de: g.total,
        amount: g.monthly,
      });
    }
  });

  return porMes;
}

/*
 * Lo que ya está comprometido mes a mes: las cuotas que faltan más los gastos
 * fijos, que por definición se repiten.
 */
export function buildCommitments(transactions, fixedExpenses, monthKeys) {
  const cuotas = projectInstallments(transactions, monthKeys);
  const fijos = (fixedExpenses || []).reduce((s, f) => s + (Number(f.amount) || 0), 0);

  return monthKeys.map((mes) => ({
    monthKey: mes,
    installments: cuotas[mes].total,
    fixed: fijos,
    total: cuotas[mes].total + fijos,
    items: cuotas[mes].items,
  }));
}

/* Día de pago real de un mes, recortado si el mes es más corto (30 de febrero). */
export function paymentDayInMonth(monthKey, paymentDay) {
  if (!paymentDay) return null;
  const [y, m] = monthKey.split('-').map(Number);
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(paymentDay, daysInMonth(y, m - 1))).padStart(2, '0')}`;
}
