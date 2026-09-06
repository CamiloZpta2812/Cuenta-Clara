import test from 'node:test';
import assert from 'node:assert/strict';
import { diffState, planWrites } from './sync.js';

const UID = 'user-abc';

const conDeuda = {
  transactions: [{ id: 't1', type: 'gasto', amount: 200, category: 'deudas', date: '2026-09-02',
                   note: 'Abono', debtId: 'd1', debtPaymentId: 'p1' }],
  creditCards: [{ id: 'c1', name: 'Visa', lastFour: '1111', currency: 'COP' }],
  debts: [{ id: 'd1', name: 'X', totalAmount: 1000, startDate: '2026-01-01',
            payments: [{ id: 'p1', amount: 200, date: '2026-09-02' }] }],
  savingsGoals: [{ id: 'g1', name: 'Meta', targetAmount: 500, targetDate: '',
                   contributions: [{ id: 'a1', amount: 100, date: '2026-05-01' }] }],
  fixedExpenses: [], customCategories: [], categoryLabels: {},
};
const vacio = { transactions: [], creditCards: [], debts: [], savingsGoals: [],
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
  assert.ok(pos('goal_contributions') < pos('savings_goals'), 'los aportes antes que la meta');
  assert.ok(pos('transactions') < pos('credit_cards'), 'los movimientos antes que la tarjeta');
});

test('al crear, los padres se escriben antes que los hijos', () => {
  const plan = planWrites(diffState(vacio, conDeuda), UID);
  const pos = (t) => orden(plan).indexOf(`upsert:${t}`);
  assert.ok(pos('debts') < pos('debt_payments'));
  assert.ok(pos('savings_goals') < pos('goal_contributions'));
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
