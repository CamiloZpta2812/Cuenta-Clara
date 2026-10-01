import test from 'node:test';
import assert from 'node:assert/strict';
import { isVariable, monthPace, variableByCategory } from './analisis.js';

const gasto = (id, date, amount, extra = {}) => ({
  id, type: 'gasto', amount, category: 'alimentacion', date, ...extra,
});

const estado = {
  incomeSources: [], fixedExpenses: [], debts: [], buckets: [],
  monthlyPlans: [{ month: '2026-09', variableEstimate: 300_000 }],
  transactions: [
    gasto('a', '2026-09-02', 50_000),
    gasto('b', '2026-09-05', 40_000, { category: 'transporte' }),
    gasto('c', '2026-09-10', 60_000),
    gasto('fijo', '2026-09-01', 300_000, { fixedExpenseId: 'casa' }),
    gasto('colchon', '2026-09-03', 20_000, { bucketId: 'gasolina' }),
    gasto('abono', '2026-09-04', 100_000, { category: 'deudas' }),
    gasto('agosto', '2026-08-20', 90_000),
  ],
};

test('solo es variable lo que no es fijo, abono ni colchón', () => {
  const ids = estado.transactions.filter(isVariable).map((t) => t.id);
  assert.deepEqual(ids, ['a', 'b', 'c', 'agosto']);
});

test('el ritmo acumula día a día y deja el futuro vacío', () => {
  const r = monthPace(estado, '2026-09', '2026-09-10');
  assert.equal(r.dias[0].real, 0);
  assert.equal(r.dias[1].real, 50_000, 'el 2');
  assert.equal(r.dias[9].real, 150_000, 'el 10');
  assert.equal(r.dias[10].real, null, 'el 11 todavía no ha pasado');
  assert.equal(r.gastado, 150_000);
});

test('la recta del plan va de cero al estimado del mes', () => {
  const r = monthPace(estado, '2026-09', '2026-09-10');
  assert.equal(r.dias[29].plan, 300_000);
  assert.equal(r.deberias, 100_000, 'el 10 de 30 días');
  assert.equal(r.adelanto, 50_000, 'vas 50.000 por encima del ritmo');
});

test('si sigues así, terminas en el triple de lo que llevas en diez días', () => {
  assert.equal(monthPace(estado, '2026-09', '2026-09-10').proyeccion, 450_000);
});

test('un mes que ya pasó está completo y su proyección es lo gastado', () => {
  const r = monthPace(estado, '2026-09', '2026-10-05');
  assert.equal(r.cerrado, true);
  assert.equal(r.hoyDia, 30);
  assert.equal(r.proyeccion, 150_000);
});

test('un mes que no ha llegado no tiene nada gastado', () => {
  const r = monthPace(estado, '2026-09', '2026-08-15');
  assert.equal(r.hoyDia, 0);
  assert.ok(r.dias.every((d) => d.real === null));
});

test('de una cuenta dividida, el ritmo cuenta solo tu parte', () => {
  const conCena = {
    ...estado,
    transactions: [gasto('cena', '2026-09-03', 120_000, {
      shares: [{ id: 'r', personId: 'p', amount: 80_000 }],
    })],
  };
  assert.equal(monthPace(conCena, '2026-09', '2026-09-05').gastado, 40_000);
});

test('las categorías vienen con el mes anterior al lado', () => {
  const c = variableByCategory(estado, '2026-09');
  const comida = c.find((x) => x.category === 'alimentacion');
  assert.equal(comida.amount, 110_000);
  assert.equal(comida.previous, 90_000);
  assert.equal(c[0].category, 'alimentacion', 'de más a menos');
});

test('una categoría que solo existió el mes pasado también sale', () => {
  // Haber dejado de gastar en algo es tan informativo como empezar.
  const c = variableByCategory({ ...estado, transactions: [gasto('x', '2026-08-03', 30_000, { category: 'compras' })] }, '2026-09');
  assert.deepEqual(c, [{ category: 'compras', amount: 0, previous: 30_000 }]);
});
