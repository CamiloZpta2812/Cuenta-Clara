import test from 'node:test';
import assert from 'node:assert/strict';
import { cashEvents, buildCashFlow } from './cashflow.js';

const estado = {
  transactions: [
    { id: 't1', type: 'ingreso', amount: 1_700_000, category: 'salario', date: '2026-09-15' },
    { id: 't2', type: 'gasto', amount: 300_000, category: 'vivienda', date: '2026-09-01' },
    { id: 't3', type: 'gasto', amount: 47_300, category: 'alimentacion', date: '2026-09-20' },
  ],
  buckets: [
    { id: 'b1', name: 'Colchón gatos', contributions: [
      { id: 'ap1', amount: 65_000, date: '2026-09-05' },
      { id: 'ap2', amount: -20_000, date: '2026-09-25' },
    ] },
  ],
  debts: [
    { id: 'd1', name: 'Libre inversión', payments: [
      { id: 'pd1', amount: 446_413, date: '2026-09-10' },
    ] },
  ],
};

test('sube con los ingresos y baja con todo lo demás', () => {
  const puntos = buildCashFlow(estado, ['2026-09']);
  const porFecha = Object.fromEntries(puntos.map((p) => [p.date, p.saldo]));

  assert.equal(porFecha['2026-09-01'], -300_000, 'el arriendo');
  assert.equal(porFecha['2026-09-05'], -365_000, 'y el aporte al colchón');
  assert.equal(porFecha['2026-09-10'], -811_413, 'y la cuota de la deuda');
  assert.equal(porFecha['2026-09-15'], 888_587, 'entra la quincena');
  assert.equal(porFecha['2026-09-20'], 841_287, 'el granizado');
  assert.equal(porFecha['2026-09-25'], 861_287, 'sacar del colchón devuelve plata');
});

test('un abono enlazado no baja la línea dos veces', () => {
  /* La pantalla de deuda deja la fila del abono Y su movimiento. */
  const conEnlace = {
    transactions: [
      { id: 'mv', type: 'gasto', amount: 500_000, category: 'deudas', date: '2026-09-10',
        debtId: 'd1', debtPaymentId: 'pd1' },
    ],
    debts: [{ id: 'd1', name: 'X', payments: [{ id: 'pd1', amount: 500_000, date: '2026-09-10' }] }],
    buckets: [],
  };
  assert.equal(cashEvents(conEnlace).length, 1, 'un solo evento, no dos');
  assert.equal(buildCashFlow(conEnlace, ['2026-09'])[0].saldo, -500_000);
});

test('los eventos salen ordenados por fecha aunque entren revueltos', () => {
  const fechas = cashEvents(estado).map((e) => e.date);
  assert.deepEqual(fechas, [...fechas].sort());
});

test('varios movimientos del mismo día son un solo punto', () => {
  const mismoDia = {
    transactions: [
      { id: 'a', type: 'gasto', amount: 10_000, category: 'alimentacion', date: '2026-09-03' },
      { id: 'b', type: 'gasto', amount: 20_000, category: 'alimentacion', date: '2026-09-03' },
      { id: 'c', type: 'gasto', amount: 30_000, category: 'alimentacion', date: '2026-09-03' },
    ],
    buckets: [], debts: [],
  };
  const puntos = buildCashFlow(mismoDia, ['2026-09']);
  assert.equal(puntos.length, 1);
  assert.equal(puntos[0].saldo, -60_000, 'el saldo con el que te acuestas');
});

test('lo anterior a la ventana cuenta pero no se dibuja', () => {
  const conHistoria = {
    transactions: [
      { id: 'viejo', type: 'ingreso', amount: 1_000_000, category: 'salario', date: '2026-08-15' },
      { id: 'nuevo', type: 'gasto', amount: 200_000, category: 'compras', date: '2026-09-02' },
    ],
    buckets: [], debts: [],
  };
  const puntos = buildCashFlow(conHistoria, ['2026-09']);
  assert.equal(puntos.length, 1, 'agosto no se dibuja');
  assert.equal(puntos[0].saldo, 800_000, 'pero sí arrastra el millón de agosto');
});

test('sin ventana se dibuja todo', () => {
  assert.equal(buildCashFlow(estado, []).length, 6);
});

test('un estado vacío no revienta', () => {
  assert.deepEqual(buildCashFlow({}, ['2026-09']), []);
  assert.deepEqual(cashEvents({}), []);
});

test('los montos en cero no ensucian la gráfica', () => {
  const conCeros = {
    transactions: [{ id: 'z', type: 'gasto', amount: 0, category: 'otros_gasto', date: '2026-09-01' }],
    buckets: [{ id: 'b', name: 'X', contributions: [{ id: 'z2', amount: 0, date: '2026-09-02' }] }],
    debts: [],
  };
  assert.deepEqual(cashEvents(conCeros), []);
});
