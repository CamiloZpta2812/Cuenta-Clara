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
  monthStartDay: 16,
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
                   [{ id: 'p1', amount: 200000, date: '2026-09-02' }]);
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
  assert.equal(rows.user_settings[0].month_start_day, 16);
  assert.deepEqual(rows.user_settings[0].category_labels, { alimentacion: 'Mercado' });
});

test('un blob vacío o a medias no revienta', () => {
  assert.doesNotThrow(() => stateToRows({}));
  const vacio = rowsToState(stateToRows({}));
  assert.deepEqual(vacio.transactions, []);
  assert.deepEqual(vacio.debts, []);
  assert.deepEqual(vacio.categoryLabels, {});
  assert.equal(vacio.monthStartDay, 1, 'sin ajustes guardados, el mes empieza el 1');
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
