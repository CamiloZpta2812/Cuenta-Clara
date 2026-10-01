import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSplitShares, splitFromShares } from './split.js';

test('por partes iguales contigo adentro: cada uno paga su cuarto', () => {
  const r = buildSplitShares(120_000, { personIds: ['a', 'b', 'c'], mode: 'iguales', includeMe: true });
  assert.deepEqual(r.map((x) => x.amount), [30_000, 30_000, 30_000]);
});

test('si tú no comiste, se reparte solo entre ellos', () => {
  const r = buildSplitShares(120_000, { personIds: ['a', 'b'], mode: 'iguales', includeMe: false });
  assert.deepEqual(r.map((x) => x.amount), [60_000, 60_000]);
});

test('con montos a mano se respeta lo que escribiste', () => {
  const r = buildSplitShares(100_000, {
    personIds: ['a', 'b'], mode: 'montos', amounts: { a: '45000', b: '20000' },
  });
  assert.deepEqual(r.map((x) => x.amount), [45_000, 20_000]);
});

test('montos que suman más que la cuenta no se guardan', () => {
  assert.equal(buildSplitShares(50_000, {
    personIds: ['a'], mode: 'montos', amounts: { a: '60000' },
  }), null);
});

test('sin nadie no hay reparto', () => {
  assert.deepEqual(buildSplitShares(50_000, { personIds: [] }), []);
  assert.deepEqual(buildSplitShares(50_000, undefined), []);
});

test('editar la cuenta no borra lo que ya te pagaron', () => {
  const previas = [{ id: 'r1', personId: 'a', amount: 30_000, collectedAt: '2026-09-27' }];
  const r = buildSplitShares(160_000, { personIds: ['a', 'b'], mode: 'iguales', includeMe: true }, previas);
  assert.equal(r[0].id, 'r1', 'misma fila');
  assert.equal(r[0].collectedAt, '2026-09-27', 'sigue cobrada');
  assert.equal(r[1].collectedAt, null);
});

test('del reparto guardado se reconstruye el formulario', () => {
  const t = { amount: 120_000, shares: [
    { id: '1', personId: 'a', amount: 30_000 }, { id: '2', personId: 'b', amount: 30_000 },
  ] };
  const f = splitFromShares(t);
  assert.equal(f.mode, 'iguales');
  assert.equal(f.includeMe, true, 'lo de ellos no cubre la cuenta: tú también comiste');
  assert.deepEqual(f.personIds, ['a', 'b']);
});
