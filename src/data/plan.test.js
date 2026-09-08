import test from 'node:test';
import assert from 'node:assert/strict';
import { diffState, planWrites, diffSize } from './sync.js';

const UID = 'user-abc';

const conDeuda = {
  transactions: [{ id: 't1', type: 'gasto', amount: 200, category: 'deudas', date: '2026-09-02',
                   note: 'Abono', debtId: 'd1', debtPaymentId: 'p1' }],
  creditCards: [{ id: 'c1', name: 'Visa', lastFour: '1111', currency: 'COP' }],
  debts: [{ id: 'd1', name: 'X', totalAmount: 1000, startDate: '2026-01-01',
            payments: [{ id: 'p1', amount: 200, date: '2026-09-02' }] }],
  fixedExpenses: [], customCategories: [], categoryLabels: {},
};
const vacio = { transactions: [], creditCards: [], debts: [],
                fixedExpenses: [], customCategories: [], categoryLabels: {} };

const clone = (o) => JSON.parse(JSON.stringify(o));
const orden = (plan) => plan.map((s) => `${s.op}:${s.table}`);

test('los borrados van antes que los upserts', () => {
  const next = clone(conDeuda);
  next.transactions = [];
  next.creditCards.push({ id: 'c2', name: 'Amex', lastFour: '2222', currency: 'USD' });
  const plan = planWrites(diffState(conDeuda, next), UID);
  const primerUpsert = plan.findIndex((s) => s.op === 'upsert');
  const ultimoDelete = plan.map((s) => s.op).lastIndexOf('delete');
  assert.ok(ultimoDelete < primerUpsert, orden(plan).join(' -> '));
});

test('al borrar todo, los hijos se borran antes que sus padres', () => {
  const plan = planWrites(diffState(conDeuda, vacio), UID);
  const pos = (t) => orden(plan).indexOf(`delete:${t}`);
  assert.ok(pos('debt_payments') < pos('debts'), 'los abonos antes que la deuda');
  assert.ok(pos('transactions') < pos('credit_cards'), 'los movimientos antes que la tarjeta');
});

test('al crear, los padres se escriben antes que los hijos', () => {
  const plan = planWrites(diffState(vacio, conDeuda), UID);
  const pos = (t) => orden(plan).indexOf(`upsert:${t}`);
  assert.ok(pos('debts') < pos('debt_payments'));
  assert.ok(pos('credit_cards') < pos('transactions'));
});

test('toda fila escrita lleva user_id, si no RLS la rechaza', () => {
  const plan = planWrites(diffState(vacio, conDeuda), UID);
  const upserts = plan.filter((s) => s.op === 'upsert');
  assert.ok(upserts.length > 0);
  upserts.forEach((s) => s.rows.forEach((r) => {
    assert.equal(r.user_id, UID, `fila sin user_id en ${s.table}`);
  }));
});

test('los borrados van acotados al usuario', () => {
  const plan = planWrites(diffState(conDeuda, vacio), UID);
  plan.filter((s) => s.op === 'delete').forEach((s) => {
    assert.equal(s.userId, UID);
    assert.ok(Array.isArray(s.ids) && s.ids.length > 0);
  });
});

test('user_settings resuelve el conflicto por user_id, el resto por user_id,id', () => {
  const next = clone(conDeuda);
  next.categoryLabels = { compras: 'Antojos' };
  next.creditCards[0].name = 'Visa Oro';
  const plan = planWrites(diffState(conDeuda, next), UID);
  const ajustes = plan.find((s) => s.table === 'user_settings');
  const tarjetas = plan.find((s) => s.table === 'credit_cards');
  assert.equal(ajustes.onConflict, 'user_id');
  assert.equal(tarjetas.onConflict, 'user_id,id');
});

test('una carga grande se parte en varias peticiones', () => {
  const muchos = clone(vacio);
  muchos.transactions = Array.from({ length: 1250 }, (_, i) => ({
    id: `t${i}`, type: 'gasto', amount: 100, category: 'otros_gasto', date: '2026-09-01', note: '',
  }));
  const plan = planWrites(diffState(vacio, muchos), UID, 500);
  const partes = plan.filter((s) => s.table === 'transactions');
  assert.equal(partes.length, 3);
  assert.deepEqual(partes.map((p) => p.rows.length), [500, 500, 250]);
});

test('sin cambios no se manda ninguna petición', () => {
  assert.deepEqual(planWrites(diffState(conDeuda, clone(conDeuda)), UID), []);
});


/* ============================== esquema v2 ============================== */

/*
 * Un estado v2 con las cadenas de llaves foráneas que importan:
 * persona -> reparto -> cobro, y bucket -> aporte.
 */
const v2 = {
  people: [{ id: 'p1', name: 'Juanjo', linkedUserId: null }],
  incomeSources: [{ id: 'i1', name: 'Salario', expected: 3400000, variable: false, active: true }],
  fixedExpenses: [{ id: 'f1', name: 'HBO Max', category: 'entretenimiento', amount: 8300,
                    totalAmount: 12450, dueDay: 5, paymentMethod: 'debito', cardId: null,
                    shares: [{ id: 's1', personId: 'p1', amount: 4150 }] }],
  collections: [{ id: 'co1', month: '2026-09', shareId: 's1', collectedAt: '2026-09-06' }],
  buckets: [{ id: 'b1', name: 'Ahorro', kind: 'meta', liquid: true, monthlyAmount: 50000,
              targetAmount: null, targetDate: null,
              contributions: [{ id: 'ap1', amount: 50000, date: '2026-09-05', month: '2026-09' }] }],
  monthlyPlans: [{ month: '2026-09', expectedIncome: 3400000, fixedExpenses: 8300,
                   debtPayment: 0, savings: 50000, variableEstimate: 830000,
                   cushion: 0, locked: false }],
  transactions: [], creditCards: [], debts: [],
  customCategories: [], categoryLabels: {},
};

const v2Vacio = { ...vacio, people: [], incomeSources: [], collections: [],
                  buckets: [], monthlyPlans: [] };

test('al crear, la persona va antes del reparto y el reparto antes del cobro', () => {
  const plan = planWrites(diffState(v2Vacio, v2), UID);
  const pos = (t) => orden(plan).indexOf(`upsert:${t}`);
  assert.ok(pos('people') < pos('fixed_expense_shares'), 'sin la persona, el reparto no entra');
  assert.ok(pos('fixed_expenses') < pos('fixed_expense_shares'));
  assert.ok(pos('fixed_expense_shares') < pos('collections'), 'el cobro apunta al reparto');
  assert.ok(pos('buckets') < pos('bucket_contributions'));
});

test('al borrar todo, la cadena se deshace al revés', () => {
  const plan = planWrites(diffState(v2, v2Vacio), UID);
  const pos = (t) => orden(plan).indexOf(`delete:${t}`);
  assert.ok(pos('collections') < pos('fixed_expense_shares'), 'el cobro antes que el reparto');
  assert.ok(pos('fixed_expense_shares') < pos('fixed_expenses'));
  assert.ok(pos('fixed_expense_shares') < pos('people'), 'el reparto antes que la persona');
  assert.ok(pos('bucket_contributions') < pos('buckets'));
});

test('el plan del mes resuelve el conflicto por mes, no por id', () => {
  const next = clone(v2);
  next.monthlyPlans[0].variableEstimate = 900000;
  const plan = planWrites(diffState(v2, next), UID);
  const planes = plan.find((s) => s.table === 'monthly_plans');
  assert.equal(planes.onConflict, 'user_id,month', 'monthly_plans no tiene columna id');
  assert.equal(planes.rows[0].month, '2026-09');
  assert.equal(planes.rows[0].id, undefined);
});

test('borrar el plan de un mes se acota por la columna month', () => {
  const next = clone(v2);
  next.monthlyPlans = [];
  const paso = planWrites(diffState(v2, next), UID).find((s) => s.table === 'monthly_plans');
  assert.equal(paso.op, 'delete');
  assert.equal(paso.keyColumn, 'month', 'con .in("id", ...) Postgres no encontraría la columna');
  assert.deepEqual(paso.ids, ['2026-09']);
});

test('los borrados de las demás tablas siguen yendo por id', () => {
  const next = clone(v2);
  next.collections = [];
  const paso = planWrites(diffState(v2, next), UID).find((s) => s.table === 'collections');
  assert.equal(paso.keyColumn, 'id');
  assert.deepEqual(paso.ids, ['co1']);
});

test('cambiar el plan de un mes no reescribe los otros meses', () => {
  const conDosMeses = clone(v2);
  conDosMeses.monthlyPlans.push({ month: '2026-10', expectedIncome: 3400000, fixedExpenses: 8300,
                                  debtPayment: 0, savings: 50000, variableEstimate: 700000,
                                  cushion: 0, locked: false });
  const next = clone(conDosMeses);
  next.monthlyPlans[1].variableEstimate = 750000;
  const d = diffState(conDosMeses, next);
  assert.equal(diffSize(d), 1);
  assert.deepEqual(d.upserts.monthly_plans.map((r) => r.month), ['2026-10']);
});

test('marcar un cobro toca una sola fila', () => {
  const next = clone(v2);
  next.collections.push({ id: 'co2', month: '2026-10', shareId: 's1', collectedAt: '2026-10-03' });
  const d = diffState(v2, next);
  assert.equal(diffSize(d), 1);
  assert.deepEqual(d.upserts.collections.map((r) => r.id), ['co2']);
});

test('cambiar el reparto no reescribe el gasto fijo', () => {
  const next = clone(v2);
  next.fixedExpenses[0].shares[0].amount = 4200;
  const d = diffState(v2, next);
  assert.equal(diffSize(d), 1);
  assert.equal(d.upserts.fixed_expenses, undefined, 'el total no cambió');
  assert.equal(d.upserts.fixed_expense_shares[0].amount, 4200);
});
