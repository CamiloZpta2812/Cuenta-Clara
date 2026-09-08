import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendations, getStatus } from './insights.js';

const MES = '2026-09';

/* Un estado sano: plan que cierra, colchones con algo adentro, una deuda. */
const base = {
  incomeSources: [{ id: 'i1', name: 'Salario', expected: 3_600_000, active: true }],
  fixedExpenses: [
    { id: 'f1', name: 'Arriendo', category: 'vivienda', totalAmount: 586_000, shares: [] },
  ],
  buckets: [
    { id: 'seg', name: 'Colchón de seguridad', kind: 'colchon', liquid: true,
      monthlyAmount: 300_000, movesCash: true, shares: [],
      contributions: [{ id: 'c1', amount: 2_000_000, date: '2026-05-01' }] },
  ],
  debts: [
    { id: 'd1', name: 'Libre inversión', interestRate: 1.67, currentBalance: 8_000_000,
      fixedPayment: 446_413, payments: [] },
  ],
  monthlyPlans: [{ month: MES, variableEstimate: 830_000 }],
  transactions: [],
  collections: [],
};

const textos = (estado) => buildRecommendations(estado, MES).map((r) => r.text).join(' || ');

test('no sugiere el método avalancha con una sola deuda', () => {
  assert.ok(!textos(base).includes('avalancha'));
  assert.ok(!textos(base).toLowerCase().includes('la más cara'));
});

test('con dos deudas sí dice cuál atacar', () => {
  const dos = {
    ...base,
    debts: [
      ...base.debts,
      { id: 'd2', name: 'Tarjeta', interestRate: 2.4, currentBalance: 1_000_000,
        fixedPayment: 100_000, payments: [] },
    ],
  };
  const t = textos(dos);
  assert.ok(t.includes('Tarjeta'), 'nombra la más cara');
  assert.ok(t.includes('2.4%'));
});

test('no dice que no tienes ahorro cuando tienes buckets', () => {
  assert.ok(!textos(base).includes('No tienes colchones'));
});

test('avisa cuando no hay ningún colchón', () => {
  const sinColchon = { ...base, buckets: [] };
  assert.ok(textos(sinColchon).includes('No tienes colchones'));
});

test('avisa si el colchón no cubre ni un mes de gastos fijos', () => {
  const flaco = {
    ...base,
    buckets: [{ ...base.buckets[0], contributions: [{ id: 'c1', amount: 200_000, date: '2026-05-01' }] }],
  };
  assert.ok(textos(flaco).includes('días de gastos fijos'));
});

test('reconoce cuando el colchón sí alcanza', () => {
  assert.ok(textos(base).includes('meses de gastos fijos'));
});

test('avisa cuando una reserva se pasa de su cupo', () => {
  const gasolina = {
    ...base,
    buckets: [...base.buckets,
      { id: 'gas', name: 'Gasolina', kind: 'colchon', liquid: true, monthlyAmount: 160_000,
        movesCash: false, shares: [], contributions: [] }],
    transactions: [
      { id: 't1', type: 'gasto', amount: 190_000, category: 'transporte', date: '2026-09-20', bucketId: 'gas' },
    ],
  };
  const t = textos(gasolina);
  assert.ok(t.includes('"Gasolina" se pasó'));
  assert.ok(t.includes('190.000'));
});

test('la categoría que concentra el gasto mira solo lo variable', () => {
  /*
   * Antes contaba los abonos y la recomendación de siempre era "recorta en
   * pago de deudas", que no es una línea que uno pueda recortar.
   */
  const conAbono = {
    ...base,
    transactions: [
      { id: 't1', type: 'gasto', amount: 1_750_000, category: 'deudas', date: '2026-09-01' },
      { id: 't2', type: 'gasto', amount: 150_000, category: 'alimentacion', date: '2026-09-10' },
      { id: 't3', type: 'gasto', amount: 20_000, category: 'transporte', date: '2026-09-11' },
    ],
  };
  const t = textos(conAbono);
  assert.ok(!t.includes('Pago de deudas'), 'abonar no es una línea que se recorte');
  assert.ok(t.includes('gasto variable'));
});

test('el sello sale del plan y no de lo registrado', () => {
  // Mes recién empezado, sin un solo movimiento: el plan cierra igual.
  assert.equal(getStatus({ income: 3_600_000, availableForExtra: 686_587 }).label, 'Vas bien');
  assert.equal(getStatus({ income: 3_600_000, availableForExtra: -100 }).label, 'El plan no cierra');
  assert.equal(getStatus({ income: 3_600_000, availableForExtra: 100_000 }).label, 'Ajustado');
  assert.equal(getStatus({ income: 0, availableForExtra: 0 }).label, 'Sin plan este mes');
  assert.equal(getStatus(null).label, 'Sin plan este mes');
});

test('nunca devuelve más de cinco, y los avisos van primero', () => {
  const feo = {
    ...base,
    incomeSources: [{ id: 'i1', name: 'X', expected: 1_000_000, active: true }],
    fixedExpenses: [{ id: 'f1', name: 'Arriendo', totalAmount: 900_000, category: 'vivienda', shares: [] }],
    buckets: [],
    debts: [
      { id: 'd1', name: 'A', interestRate: 2, currentBalance: 9_000_000, fixedPayment: 100_000, payments: [] },
      { id: 'd2', name: 'B', interestRate: 3, currentBalance: 5_000_000, fixedPayment: 100_000, payments: [] },
    ],
  };
  const recs = buildRecommendations(feo, MES);
  assert.ok(recs.length <= 5);
  assert.equal(recs[0].kind, 'warning');
});

test('un estado vacío no revienta', () => {
  assert.doesNotThrow(() => buildRecommendations({}, MES));
});
