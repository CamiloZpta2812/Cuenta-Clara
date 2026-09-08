import test from 'node:test';
import assert from 'node:assert/strict';
import { stateToRows, rowsToState, normalizeState } from './mapping.js';

/* Un blob como los que guardaba kv_store, con todos los casos raros metidos. */
const blob = {
  transactions: [
    { id: 't1', type: 'gasto', amount: 50000, category: 'alimentacion', date: '2026-09-04',
      note: 'Mercado', paymentMethod: 'efectivo', cardId: null, isFixed: false },
    { id: 't2', type: 'ingreso', amount: 3200000, category: 'salario', date: '2026-09-01',
      note: '', paymentMethod: null, cardId: null, isFixed: false },
    { id: 't3', type: 'gasto', amount: 120000, category: 'compras', date: '2026-08-20',
      note: 'Audífonos', paymentMethod: 'credito', cardId: 'c1', isFixed: false,
      isInstallment: true, totalInstallments: 12, currentInstallment: 3, interestRate: 2.08,
      totalAmount: 1440000, installmentGroupId: 'g1', currency: 'USD',
      originalAmount: 30, exchangeRateUsed: 4000 },
    { id: 't4', type: 'gasto', amount: 1200000, category: 'vivienda', date: '2026-09-01',
      note: 'Arriendo', paymentMethod: 'debito', cardId: null, isFixed: true, fixedExpenseId: 'f1' },
    { id: 't5', type: 'gasto', amount: 200000, category: 'deudas', date: '2026-09-02',
      note: 'Abono a Crédito', paymentMethod: 'debito', cardId: null, isFixed: false,
      debtId: 'd1', debtPaymentId: 'p1' },
  ],
  creditCards: [
    { id: 'c1', name: 'Amex', lastFour: '4321', currency: 'USD', cutDay: 15, paymentDay: 5 },
    { id: 'c2', name: 'Visa', lastFour: '1111', currency: 'COP', cutDay: null, paymentDay: null },
  ],
  fixedExpenses: [
    { id: 'f1', name: 'Arriendo', category: 'vivienda', amount: 1200000, dueDay: 1,
      paymentMethod: 'debito', cardId: null },
  ],
  debts: [
    { id: 'd1', name: 'Crédito de estudio', totalAmount: 1000000, interestRate: 1.5,
      monthlyPayment: 100000, dueDay: 10, startDate: '2026-01-15', currency: 'COP',
      exchangeRate: null, payments: [{ id: 'p1', amount: 200000, date: '2026-09-02' }] },
    { id: 'd2', name: 'Préstamo en dólares', totalAmount: 500, interestRate: 0,
      monthlyPayment: 0, dueDay: null, startDate: '2026-03-01', currency: 'USD',
      exchangeRate: 4100, payments: [] },
  ],
  savingsGoals: [
    { id: 'g1', name: 'Fondo de emergencia', targetAmount: 6000000, targetDate: '2027-06-30',
      contributions: [
        { id: 'a1', amount: 500000, date: '2026-07-01' },
        { id: 'a2', amount: -100000, date: '2026-08-01' },
      ] },
    { id: 'g2', name: 'Sin meta fija', targetAmount: null, targetDate: '', contributions: [] },
  ],
  customCategories: [
    { id: 'custom-x1', type: 'gasto', label: 'Peluquería', iconKey: 'utensils', color: '#B0524B' },
  ],
  categoryLabels: { alimentacion: 'Mercado' },
};

test('el blob completo sobrevive el viaje de ida y vuelta a filas', () => {
  const rows = stateToRows(blob);
  assert.deepEqual(rowsToState(rows), normalizeState(blob));
});

test('no se pierde ni se inventa ningún registro', () => {
  const rows = stateToRows(blob);
  assert.equal(rows.transactions.length, 5);
  assert.equal(rows.credit_cards.length, 2);
  assert.equal(rows.fixed_expenses.length, 1);
  assert.equal(rows.debts.length, 2);
  assert.equal(rows.debt_payments.length, 1, 'los abonos salen de dentro de la deuda');
  assert.equal(rows.savings_goals.length, 2);
  assert.equal(rows.goal_contributions.length, 2);
  assert.equal(rows.custom_categories.length, 1);
});

test('los abonos y aportes vuelven a la deuda y meta correctas', () => {
  const back = rowsToState(stateToRows(blob));
  assert.deepEqual(back.debts.find((d) => d.id === 'd1').payments,
                   [{ id: 'p1', amount: 200000, date: '2026-09-02',
                      month: '2026-09', balanceAfter: null }]);
  assert.deepEqual(back.debts.find((d) => d.id === 'd2').payments, []);
  assert.equal(back.savingsGoals.find((g) => g.id === 'g1').contributions.length, 2);
  assert.equal(back.savingsGoals.find((g) => g.id === 'g2').contributions.length, 0);
});

test('un aporte negativo (retiro de la meta) mantiene el signo', () => {
  const back = rowsToState(stateToRows(blob));
  const aportes = back.savingsGoals.find((g) => g.id === 'g1').contributions;
  assert.equal(aportes.find((c) => c.id === 'a2').amount, -100000);
});

test('las referencias entre registros se conservan', () => {
  const rows = stateToRows(blob);
  const t3 = rows.transactions.find((t) => t.id === 't3');
  assert.equal(t3.card_id, 'c1');
  assert.equal(t3.installment_group_id, 'g1');
  assert.equal(t3.currency, 'USD');
  assert.equal(t3.original_amount, 30);
  assert.equal(t3.exchange_rate_used, 4000);

  const t5 = rows.transactions.find((t) => t.id === 't5');
  assert.equal(t5.debt_id, 'd1');
  assert.equal(t5.debt_payment_id, 'p1', 'el enlace del abono es lo que arregló el bug 6');

  assert.equal(rows.transactions.find((t) => t.id === 't4').fixed_expense_id, 'f1');
});

test('los ajustes viajan en user_settings', () => {
  const rows = stateToRows(blob);
  assert.deepEqual(rows.user_settings[0].category_labels, { alimentacion: 'Mercado' });
});

test('un blob vacío o a medias no revienta', () => {
  assert.doesNotThrow(() => stateToRows({}));
  const vacio = rowsToState(stateToRows({}));
  assert.deepEqual(vacio.transactions, []);
  assert.deepEqual(vacio.debts, []);
  assert.deepEqual(vacio.categoryLabels, {});
});

test('un movimiento viejo sin campos de moneda queda como COP', () => {
  const antiguo = { transactions: [{ id: 'v1', type: 'gasto', amount: 1000, category: 'otros_gasto', date: '2025-01-01' }] };
  const t = rowsToState(stateToRows(antiguo)).transactions[0];
  assert.equal(t.currency, 'COP');
  assert.equal(t.originalAmount, null);
  assert.equal(t.note, '');
  assert.equal(t.isFixed, false);
});

test('los montos que venían como texto quedan numéricos', () => {
  const conTexto = { debts: [{ id: 'd9', name: 'X', totalAmount: '1000000', interestRate: '2.5',
                               startDate: '2026-01-01', payments: [] }] };
  const d = rowsToState(stateToRows(conTexto)).debts[0];
  assert.equal(d.totalAmount, 1000000);
  assert.equal(d.interestRate, 2.5);
  assert.equal(typeof d.totalAmount, 'number');
});

test('normalizeState es idempotente', () => {
  const una = normalizeState(blob);
  assert.deepEqual(normalizeState(una), una);
});


/* ============================== esquema v2 ============================== */

/*
 * El mismo estado que consume el motor del mes: personas, reparto, cobros,
 * buckets y el plan de cada mes. Es el que de verdad va a viajar a Supabase.
 */
const v2 = {
  people: [
    { id: 'p1', name: 'Juanjo', linkedUserId: null },
    { id: 'p2', name: 'Yeison', linkedUserId: null },
    { id: 'p3', name: 'Andy', linkedUserId: null },
    { id: 'p4', name: 'Paula', linkedUserId: null },
    { id: 'p5', name: 'Alex', linkedUserId: null },
    { id: 'p6', name: 'Sofi', linkedUserId: null },
  ],
  incomeSources: [
    { id: 'i1', name: 'Salario', expected: 3400000, variable: true, active: true },
    { id: 'i2', name: 'Club Aletas', expected: 200000, variable: true, active: false },
  ],
  fixedExpenses: [
    { id: 'f1', name: 'HBO Max', category: 'entretenimiento', amount: 8300, totalAmount: 12450,
      dueDay: 5, paymentMethod: 'credito', cardId: 'c1',
      shares: [{ id: 's1', personId: 'p1', amount: 4150 }] },
    { id: 'f2', name: 'Spotify', category: 'entretenimiento', amount: 6100, totalAmount: 30500,
      dueDay: 8, paymentMethod: 'credito', cardId: 'c1',
      shares: [
        { id: 's2', personId: 'p2', amount: 6100 }, { id: 's3', personId: 'p3', amount: 6100 },
        { id: 's4', personId: 'p4', amount: 6100 }, { id: 's5', personId: 'p5', amount: 6100 },
      ] },
    { id: 'f3', name: 'iCloud', category: 'otros_gasto', amount: 11300, totalAmount: 11300,
      dueDay: 1, paymentMethod: 'debito', cardId: null, shares: [] },
  ],
  collections: [
    { id: 'co1', month: '2026-09', shareId: 's2', collectedAt: '2026-09-06' },
  ],
  buckets: [
    { id: 'b1', name: 'Ahorro personal', kind: 'meta', liquid: true, monthlyAmount: 50000,
      targetAmount: 2000000, targetDate: '2027-12-31',
      contributions: [
        { id: 'ap1', amount: 50000, date: '2026-09-05', month: '2026-09' },
        { id: 'ap2', amount: -20000, date: '2026-09-20', month: '2026-09' },
      ] },
    { id: 'b2', name: 'Cooperativa', kind: 'meta', liquid: false, monthlyAmount: 76000,
      targetAmount: null, targetDate: null, contributions: [] },
    /* Compartido: el monto es el del pote, la parte de Sofi va aparte. */
    { id: 'b3', name: 'Colchón gatos', kind: 'colchon', liquid: true, monthlyAmount: 130000,
      movesCash: true, targetAmount: null, targetDate: null,
      shares: [{ id: 'shb1', personId: 'p6', amount: 65000 }], contributions: [] },
    /* Reserva: no mueve plata, se llena con los gastos que la etiquetan. */
    { id: 'b4', name: 'Gasolina', kind: 'colchon', liquid: true, monthlyAmount: 160000,
      movesCash: false, targetAmount: null, targetDate: null, shares: [], contributions: [] },
  ],
  debts: [
    { id: 'd1', name: 'Libre inversión', totalAmount: 16000000, interestRate: 1.67,
      monthlyPayment: 446413, dueDay: 15, startDate: '2026-01-15', currency: 'COP',
      exchangeRate: null, fixedPayment: 446413, payoffMode: 'reducir-plazo',
      currentBalance: 14000000,
      payments: [{ id: 'pd1', amount: 1184000, date: '2026-09-10', month: '2026-09',
                   balanceAfter: 13050000 }] },
  ],
  monthlyPlans: [
    { month: '2026-09', expectedIncome: 3600000, fixedExpenses: 795000, debtPayment: 446413,
      savings: 426000, variableEstimate: 830000, cushion: 365000, locked: false },
    { month: '2026-08', expectedIncome: 3600000, fixedExpenses: 780000, debtPayment: 446413,
      savings: 426000, variableEstimate: 900000, cushion: 365000, locked: true },
  ],
  transactions: [
    { id: 't1', type: 'gasto', amount: 180000, category: 'entretenimiento', date: '2026-09-20',
      paymentMethod: 'credito', cardId: 'c1', cashOutDate: '2026-11-05', month: '2026-09' },
    { id: 't2', type: 'ingreso', amount: 3400000, category: 'salario', date: '2026-10-02',
      paymentMethod: 'debito', incomeSourceId: 'i1', month: '2026-09' },
    { id: 't3', type: 'gasto', amount: 50000, category: 'ahorro', date: '2026-09-05',
      paymentMethod: 'debito', bucketId: 'b1' },
  ],
  setupCompletedAt: '2026-09-01T12:00:00.000Z',
  categoryLabels: {},
};

test('el estado v2 completo sobrevive el viaje de ida y vuelta', () => {
  assert.deepEqual(rowsToState(stateToRows(v2)), normalizeState(v2));
});

test('cada tabla nueva recibe exactamente sus filas', () => {
  const rows = stateToRows(v2);
  assert.equal(rows.people.length, 6);
  assert.equal(rows.income_sources.length, 2);
  assert.equal(rows.fixed_expense_shares.length, 5, 'el reparto sale de dentro del gasto');
  assert.equal(rows.collections.length, 1);
  assert.equal(rows.buckets.length, 4);
  assert.equal(rows.bucket_contributions.length, 2, 'los aportes salen de dentro del bucket');
  assert.equal(rows.monthly_plans.length, 2);
});

test('el reparto vuelve a su gasto fijo, y los aportes a su bucket', () => {
  const back = rowsToState(stateToRows(v2));
  assert.deepEqual(back.fixedExpenses.find((f) => f.id === 'f1').shares,
                   [{ id: 's1', personId: 'p1', amount: 4150 }]);
  assert.deepEqual(back.fixedExpenses.find((f) => f.id === 'f3').shares, []);
  assert.equal(back.buckets.find((b) => b.id === 'b1').contributions.length, 2);
  assert.deepEqual(back.buckets.find((b) => b.id === 'b2').contributions, []);
});

test('un retiro de un bucket mantiene el signo negativo', () => {
  const back = rowsToState(stateToRows(v2));
  const aportes = back.buckets.find((b) => b.id === 'b1').contributions;
  assert.equal(aportes.find((c) => c.id === 'ap2').amount, -20000);
});

test('mi parte del gasto fijo no se guarda: se deduce del total y el reparto', () => {
  const rows = stateToRows(v2);
  const spotify = rows.fixed_expenses.find((f) => f.id === 'f2');
  assert.equal(spotify.total_amount, 30500);
  const repartido = rows.fixed_expense_shares
    .filter((s) => s.fixed_expense_id === 'f2')
    .reduce((a, s) => a + s.amount, 0);
  assert.equal(spotify.total_amount - repartido, 6100, 'lo mío sale de restar, no de una columna');
});

test('el cobro apunta al reparto, no al par gasto+persona', () => {
  const rows = stateToRows(v2);
  assert.equal(rows.collections[0].share_id, 's2', 'es la llave foránea real');
  assert.equal(rows.collections[0].month, '2026-09');
  assert.equal(rows.collections[0].collected_at, '2026-09-06');
});

test('el plan del mes se identifica por el mes, sin id propio', () => {
  const rows = stateToRows(v2);
  const agosto = rows.monthly_plans.find((p) => p.month === '2026-08');
  assert.equal(agosto.id, undefined, 'no hay id: solo puede haber un plan por mes');
  assert.equal(agosto.locked, true);
  assert.equal(agosto.variable_estimate, 900000);
});

test('la deuda guarda la cuota pactada y qué hace el banco al abonar de más', () => {
  const d = stateToRows(v2).debts[0];
  assert.equal(d.fixed_payment, 446413);
  assert.equal(d.payoff_mode, 'reducir-plazo');
  assert.equal(d.current_balance, 14000000);
  assert.equal(d.interest_rate, 1.67, 'porcentaje mensual, una sola cifra');
});

test('el abono guarda el saldo que reportó el banco', () => {
  const p = stateToRows(v2).debt_payments[0];
  assert.equal(p.balance_after, 13050000);
  assert.equal(p.month, '2026-09');
});

test('un ingreso que cae en otro mes cuenta en el mes que le asignaste', () => {
  const rows = stateToRows(v2);
  const t2 = rows.transactions.find((t) => t.id === 't2');
  assert.equal(t2.date, '2026-10-02', 'la plata llegó el 2 de octubre');
  assert.equal(t2.month, '2026-09', 'pero es la quincena de septiembre');
  assert.equal(t2.income_source_id, 'i1');
});

test('sin mes asignado, el mes sale de la fecha', () => {
  const rows = stateToRows(v2);
  assert.equal(rows.transactions.find((t) => t.id === 't3').month, '2026-09');
});

test('la salida de caja de una compra a crédito es cuando se paga la factura', () => {
  const rows = stateToRows(v2);
  const t1 = rows.transactions.find((t) => t.id === 't1');
  assert.equal(t1.date, '2026-09-20', 'el gasto es de septiembre');
  assert.equal(t1.cash_out_date, '2026-11-05', 'la plata sale en noviembre');

  const t3 = rows.transactions.find((t) => t.id === 't3');
  assert.equal(t3.cash_out_date, t3.date, 'con débito es el mismo día');
});

test('un estado v2 vacío no revienta', () => {
  const vacio = rowsToState(stateToRows({}));
  assert.deepEqual(vacio.people, []);
  assert.deepEqual(vacio.buckets, []);
  assert.deepEqual(vacio.collections, []);
  assert.deepEqual(vacio.monthlyPlans, []);
  assert.equal(vacio.setupCompletedAt, null);
});

test('normalizeState del estado v2 es idempotente', () => {
  const una = normalizeState(v2);
  assert.deepEqual(normalizeState(una), una);
});

/*
 * Este test es un recordatorio con dientes. El estado que produce rowsToState()
 * es el contrato entre la base y la app: si aquí aparece una clave nueva, hay
 * que agregarla también a snapshot() en src/state/financeStore.jsx. Lo que el
 * store no incluya en su foto se guardaría como vacío, y el siguiente diff
 * borraría esas filas en Supabase sin que nadie se entere.
 */
test('el estado canónico tiene exactamente estas claves', () => {
  assert.deepEqual(Object.keys(rowsToState({})).sort(), [
    'buckets',
    'categoryLabels',
    'collections',
    'creditCards',
    'customCategories',
    'debts',
    'fixedExpenses',
    'incomeSources',
    'monthlyPlans',
    'people',
    'savingsGoals',
    'setupCompletedAt',
    'transactions',
  ]);
});

test('el reparto de un bucket compartido vuelve a su bucket', () => {
  const rows = stateToRows(v2);
  assert.equal(rows.bucket_shares.length, 1);
  assert.equal(rows.bucket_shares[0].bucket_id, 'b3');
  assert.equal(rows.bucket_shares[0].person_id, 'p6');

  const back = rowsToState(rows);
  assert.deepEqual(back.buckets.find((b) => b.id === 'b3').shares,
                   [{ id: 'shb1', personId: 'p6', amount: 65000 }]);
  assert.deepEqual(back.buckets.find((b) => b.id === 'b1').shares, []);
});

test('una reserva se distingue de un colchón de verdad', () => {
  const rows = stateToRows(v2);
  assert.equal(rows.buckets.find((b) => b.id === 'b4').moves_cash, false);
  assert.equal(rows.buckets.find((b) => b.id === 'b3').moves_cash, true);
  // Un bucket viejo, sin la columna, se asume que sí mueve la plata.
  assert.equal(rowsToState({ buckets: [{ id: 'x', name: 'Y', kind: 'meta' }] }).buckets[0].movesCash, true);
});
