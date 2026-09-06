import test from 'node:test';
import assert from 'node:assert/strict';
import { diffState, isEmptyDiff, diffSize } from './sync.js';

const base = {
  transactions: [
    { id: 't1', type: 'gasto', amount: 50000, category: 'alimentacion', date: '2026-09-04', note: 'a' },
    { id: 't2', type: 'gasto', amount: 20000, category: 'transporte', date: '2026-09-05', note: 'b' },
  ],
  creditCards: [{ id: 'c1', name: 'Visa', lastFour: '1111', currency: 'COP' }],
  debts: [{ id: 'd1', name: 'X', totalAmount: 1000, startDate: '2026-01-01',
            payments: [{ id: 'p1', amount: 100, date: '2026-02-01' }] }],
  savingsGoals: [],
  fixedExpenses: [],
  customCategories: [],
  categoryLabels: {},
};

const clone = (o) => JSON.parse(JSON.stringify(o));

test('sin cambios no se escribe nada', () => {
  assert.ok(isEmptyDiff(diffState(base, clone(base))));
});

test('agregar un movimiento toca una sola fila', () => {
  const next = clone(base);
  next.transactions.push({ id: 't3', type: 'ingreso', amount: 900, category: 'salario', date: '2026-09-06', note: '' });
  const d = diffState(base, next);
  assert.equal(diffSize(d), 1, 'no se reescriben los movimientos que no cambiaron');
  assert.deepEqual(d.upserts.transactions.map((r) => r.id), ['t3']);
  assert.equal(d.deletes.transactions, undefined);
});

test('editar un movimiento solo manda ese', () => {
  const next = clone(base);
  next.transactions[1].amount = 25000;
  const d = diffState(base, next);
  assert.equal(diffSize(d), 1);
  assert.equal(d.upserts.transactions[0].id, 't2');
  assert.equal(d.upserts.transactions[0].amount, 25000);
});

test('borrar un movimiento manda solo su id', () => {
  const next = clone(base);
  next.transactions = next.transactions.filter((t) => t.id !== 't1');
  const d = diffState(base, next);
  assert.deepEqual(d.deletes.transactions, ['t1']);
  assert.equal(d.upserts.transactions, undefined);
});

test('renombrar una categoría ya no reescribe los movimientos', () => {
  const next = clone(base);
  next.categoryLabels = { alimentacion: 'Mercado' };
  const d = diffState(base, next);
  assert.equal(diffSize(d), 1, 'antes esto reescribía el blob entero');
  assert.deepEqual(Object.keys(d.upserts), ['user_settings']);
});

test('renombrar una categoría propia solo toca los ajustes', () => {
  const next = clone(base);
  next.categoryLabels = { transporte: 'Moto' };
  const d = diffState(base, next);
  assert.deepEqual(Object.keys(d.upserts), ['user_settings']);
  assert.deepEqual(d.upserts.user_settings[0].category_labels, { transporte: 'Moto' });
});

test('un abono nuevo aparece como fila de debt_payments, no como deuda modificada', () => {
  const next = clone(base);
  next.debts[0].payments.push({ id: 'p2', amount: 300, date: '2026-03-01' });
  const d = diffState(base, next);
  assert.deepEqual(d.upserts.debt_payments.map((r) => r.id), ['p2']);
  assert.equal(d.upserts.debts, undefined, 'la deuda en sí no cambió');
});

test('borrar una deuda borra la deuda y sus abonos', () => {
  const next = clone(base);
  next.debts = [];
  const d = diffState(base, next);
  assert.deepEqual(d.deletes.debts, ['d1']);
  assert.deepEqual(d.deletes.debt_payments, ['p1']);
});

test('deshacer un abono borra el abono y el movimiento enlazado', () => {
  const conAbono = clone(base);
  conAbono.debts[0].payments.push({ id: 'p2', amount: 300, date: '2026-03-01' });
  conAbono.transactions.push({ id: 't9', type: 'gasto', amount: 300, category: 'deudas',
                               date: '2026-03-01', note: 'Abono', debtId: 'd1', debtPaymentId: 'p2' });
  const next = clone(conAbono);
  next.debts[0].payments = next.debts[0].payments.filter((p) => p.id !== 'p2');
  next.transactions = next.transactions.filter((t) => t.id !== 't9');
  const d = diffState(conAbono, next);
  assert.deepEqual(d.deletes.debt_payments, ['p2']);
  assert.deepEqual(d.deletes.transactions, ['t9']);
});

test('borrar todo produce solo borrados', () => {
  const vacio = { transactions: [], creditCards: [], debts: [], savingsGoals: [],
                  fixedExpenses: [], customCategories: [], categoryLabels: {} };
  const d = diffState(base, vacio);
  assert.equal(Object.keys(d.upserts).length, 0);
  assert.deepEqual(d.deletes.transactions.sort(), ['t1', 't2']);
  assert.deepEqual(d.deletes.credit_cards, ['c1']);
  assert.deepEqual(d.deletes.debts, ['d1']);
  assert.deepEqual(d.deletes.debt_payments, ['p1']);
});

test('reordenar sin cambiar nada no genera escrituras', () => {
  const next = clone(base);
  next.transactions.reverse();
  assert.ok(isEmptyDiff(diffState(base, next)), 'el diff va por id, no por posición');
});
