import test from 'node:test';
import assert from 'node:assert/strict';
import { diffState, replayLocalChanges } from './sync.js';
import { stateToRows, rowsToState } from './mapping.js';

/* Estado con el que el usuario se quedó sin señal. */
const alPerderSenal = {
  transactions: [
    { id: 't1', type: 'gasto', amount: 50000, category: 'alimentacion', date: '2026-09-01', note: 'Mercado' },
    { id: 't2', type: 'gasto', amount: 20000, category: 'transporte', date: '2026-09-02', note: 'Taxi' },
  ],
  creditCards: [], debts: [], savingsGoals: [], fixedExpenses: [],
  customCategories: [], categoryLabels: {},
};

const clone = (o) => JSON.parse(JSON.stringify(o));

/* Lo que alcanzó a hacer sin conexión: un gasto nuevo y borrar otro. */
function sinSenal() {
  const s = clone(alPerderSenal);
  s.transactions.push({ id: 't3', type: 'gasto', amount: 9000, category: 'otros_gasto', date: '2026-09-03', note: 'Café' });
  s.transactions = s.transactions.filter((t) => t.id !== 't2');
  return s;
}

function reconciliar(servidor, base, local) {
  const pendiente = diffState(base, local);
  return rowsToState(replayLocalChanges(stateToRows(servidor), pendiente));
}

test('si el servidor no cambió, se recupera exactamente lo local', () => {
  const local = sinSenal();
  const resultado = reconciliar(alPerderSenal, alPerderSenal, local);
  assert.deepEqual(resultado.transactions.map((t) => t.id).sort(), ['t1', 't3']);
});

test('lo que se registró sin señal no se pierde al reconectar', () => {
  const local = sinSenal();
  const servidor = clone(alPerderSenal);   // otro dispositivo agregó algo
  servidor.transactions.push({ id: 't9', type: 'ingreso', amount: 100000, category: 'salario', date: '2026-09-02', note: 'Extra' });

  const resultado = reconciliar(servidor, alPerderSenal, local);
  const ids = resultado.transactions.map((t) => t.id).sort();
  assert.ok(ids.includes('t3'), 'el gasto hecho sin señal sigue ahí');
  assert.ok(ids.includes('t9'), 'lo del otro dispositivo tampoco se pisa');
  assert.ok(!ids.includes('t2'), 'el borrado hecho sin señal se respeta');
  assert.deepEqual(ids, ['t1', 't3', 't9']);
});

test('si ambos tocaron el mismo registro, gana el cambio local', () => {
  const local = clone(alPerderSenal);
  local.transactions[0].amount = 55000;
  const servidor = clone(alPerderSenal);
  servidor.transactions[0].amount = 51000;

  const resultado = reconciliar(servidor, alPerderSenal, local);
  assert.equal(resultado.transactions.find((t) => t.id === 't1').amount, 55000);
});

test('un registro que solo cambió en el servidor se conserva', () => {
  const local = sinSenal();
  const servidor = clone(alPerderSenal);
  servidor.transactions[0].note = 'Mercado del mes';

  const resultado = reconciliar(servidor, alPerderSenal, local);
  assert.equal(resultado.transactions.find((t) => t.id === 't1').note, 'Mercado del mes');
});

test('sin cambios pendientes, la reconciliación deja el servidor tal cual', () => {
  const servidor = clone(alPerderSenal);
  servidor.transactions.push({ id: 't9', type: 'gasto', amount: 1, category: 'otros_gasto', date: '2026-09-09', note: '' });
  const resultado = reconciliar(servidor, alPerderSenal, alPerderSenal);
  assert.deepEqual(resultado.transactions.map((t) => t.id).sort(), ['t1', 't2', 't9']);
});

test('los ajustes cambiados sin señal también se recuperan', () => {
  const local = clone(alPerderSenal);
  local.categoryLabels = { alimentacion: 'Mercado' };
  const resultado = reconciliar(alPerderSenal, alPerderSenal, local);
  assert.deepEqual(resultado.categoryLabels, { alimentacion: 'Mercado' });
});

test('una deuda creada sin señal llega con sus abonos', () => {
  const local = clone(alPerderSenal);
  local.debts.push({ id: 'd1', name: 'Nueva', totalAmount: 500, startDate: '2026-09-01',
                     payments: [{ id: 'p1', amount: 50, date: '2026-09-02' }] });
  const resultado = reconciliar(alPerderSenal, alPerderSenal, local);
  assert.equal(resultado.debts.length, 1);
  assert.deepEqual(resultado.debts[0].payments,
                   [{ id: 'p1', amount: 50, date: '2026-09-02',
                      month: '2026-09', balanceAfter: null }]);
});
