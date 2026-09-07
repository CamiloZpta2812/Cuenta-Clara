import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportSheets } from './report.js';

const datos = {
  transactions: [
    { id: 't1', type: 'gasto', amount: 50000, category: 'alimentacion', date: '2026-08-04', note: 'Mercado', paymentMethod: 'efectivo', isFixed: false },
    { id: 't2', type: 'ingreso', amount: 3200000, category: 'salario', date: '2026-09-01', note: 'Quincena' },
    { id: 't3', type: 'gasto', amount: 120000, category: 'compras', date: '2026-09-05', note: 'Audífonos',
      paymentMethod: 'credito', cardId: 'c1', isInstallment: true, totalInstallments: 12, currentInstallment: 3,
      interestRate: 2.08, totalAmount: 1440000, installmentGroupId: 'grp1', currency: 'USD',
      originalAmount: 30, exchangeRateUsed: 4000 },
    { id: 't4', type: 'gasto', amount: 1200000, category: 'vivienda', date: '2026-09-01', note: 'Arriendo',
      paymentMethod: 'debito', isFixed: true, fixedExpenseId: 'f1' },
    { id: 't5', type: 'gasto', amount: 200000, category: 'deudas', date: '2026-09-02', note: 'Abono',
      paymentMethod: 'debito', debtId: 'd1', debtPaymentId: 'p1' },
    { id: 't6', type: 'gasto', amount: 90000, category: 'alimentacion', date: '2026-09-15', note: 'Mercado 2',
      paymentMethod: 'credito', cardId: 'c1' },
  ],
  creditCards: [{ id: 'c1', name: 'Visa', lastFour: '1111', currency: 'COP', cutDay: 15, paymentDay: 5 }],
  fixedExpenses: [{ id: 'f1', name: 'Arriendo', category: 'vivienda', amount: 1200000, dueDay: 1, paymentMethod: 'debito' }],
  debts: [{ id: 'd1', name: 'Crédito', totalAmount: 1000000, interestRate: 1.5, monthlyPayment: 100000,
            dueDay: 10, startDate: '2026-01-15', currency: 'COP',
            payments: [{ id: 'p1', amount: 200000, date: '2026-09-02' }] }],
  savingsGoals: [{ id: 'g1', name: 'Fondo', targetAmount: 6000000, targetDate: '2027-06-30',
                   contributions: [{ id: 'a1', amount: 500000, date: '2026-07-01' },
                                   { id: 'a2', amount: -100000, date: '2026-08-01' }] }],
  customCategories: [], categoryLabels: {},
};

const hojas = buildReportSheets(datos);
const hoja = (n) => hojas.find((h) => h.name === n);
const fila = (n, k, v) => hoja(n).rows.find((r) => r[k] === v);

test('el reporte trae todas las hojas', () => {
  assert.deepEqual(hojas.map((h) => h.name), [
    'Resumen', 'Por mes', 'Movimientos', 'Gastos por categoría', 'Ingresos',
    'Tarjetas', 'Facturas de tarjeta', 'Movimientos de tarjeta', 'Cuotas activas',
    'Deudas', 'Abonos a deudas', 'Metas de ahorro', 'Aportes a metas',
    'Gastos fijos', 'Compromisos futuros',
  ]);
});

test('no se pierde ningún movimiento', () => {
  assert.equal(hoja('Movimientos').rows.length, datos.transactions.length);
});

test('los totales del resumen cuadran', () => {
  const v = (c) => fila('Resumen', 'concepto', c).valor;
  assert.equal(v('Ingresos totales'), 3200000);
  assert.equal(v('Gastos totales'), 50000 + 120000 + 1200000 + 200000 + 90000);
  assert.equal(v('Saldo en caja (ingresos - gastos)'), 3200000 - 1660000);
  assert.equal(v('Ahorro total'), 400000, 'el retiro de -100.000 resta');
  assert.equal(v('Deuda pendiente (en COP)'), 800000);
  assert.equal(v('Patrimonio neto'), (3200000 - 1660000) + 400000 - 800000);
  assert.equal(v('Número de movimientos'), 6);
});

test('los gastos van en negativo para que la columna se pueda sumar', () => {
  const movs = hoja('Movimientos').rows;
  assert.equal(movs.find((r) => r.id === 't1').monto, -50000);
  assert.equal(movs.find((r) => r.id === 't2').monto, 3200000);
  const suma = movs.reduce((s, r) => s + r.monto, 0);
  assert.equal(suma, 3200000 - 1660000, 'sumar la columna da el saldo en caja');
});

test('los montos son números, no texto con signo de peso', () => {
  hoja('Movimientos').rows.forEach((r) => assert.equal(typeof r.monto, 'number'));
  assert.equal(typeof fila('Deudas', 'nombre', 'Crédito').pendiente, 'number');
});

test('las fechas van como fechas reales, sin correrse de día', () => {
  const r = hoja('Movimientos').rows.find((x) => x.id === 't1');
  assert.ok(r.fecha instanceof Date);
  assert.equal(r.fecha.getFullYear(), 2026);
  assert.equal(r.fecha.getMonth(), 7, 'agosto');
  assert.equal(r.fecha.getDate(), 4, 'el día 4, no el 3');
});

test('el detalle de una compra en USD a cuotas viaja completo', () => {
  const r = hoja('Movimientos').rows.find((x) => x.id === 't3');
  assert.equal(r.cuota, 3);
  assert.equal(r.deCuantas, 12);
  assert.equal(r.moneda, 'USD');
  assert.equal(r.montoOriginal, 30);
  assert.equal(r.tasa, 4000);
  assert.equal(r.interes, 2.08);
  assert.equal(r.tarjeta, 'Visa *1111');
});

test('la tabla de gastos por categoría cuadra por fila y por columna', () => {
  const h = hoja('Gastos por categoría');
  const total = h.rows.find((r) => r.categoria === 'TOTAL');
  assert.equal(total.total, 1660000);
  const alimentacion = h.rows.find((r) => r.categoria === 'Alimentación');
  assert.equal(alimentacion['2026-08'], 50000);
  assert.equal(alimentacion['2026-09'], 90000);
  assert.equal(alimentacion.total, 140000);
  const sumaColumnas = h.rows.filter((r) => r.categoria !== 'TOTAL').reduce((s, r) => s + r.total, 0);
  assert.equal(sumaColumnas, total.total);
});

test('el mes separa fijos de variables', () => {
  const sep = hoja('Por mes').rows.find((r) => r.mes.startsWith('sep'));
  assert.equal(sep.ingresos, 3200000);
  assert.equal(sep.gastos, 1610000);
  assert.equal(sep.fijos, 1200000);
  assert.equal(sep.variables, 410000);
  assert.equal(sep.balance, 3200000 - 1610000);
});

test('la tarjeta trae sus facturas con la fecha de cobro', () => {
  assert.equal(hoja('Tarjetas').rows[0].historico, 210000);
  const facturas = hoja('Facturas de tarjeta').rows;
  assert.ok(facturas.length >= 1);
  facturas.forEach((f) => assert.ok(f.fecha instanceof Date));
  const movsTarjeta = hoja('Movimientos de tarjeta').rows;
  assert.equal(movsTarjeta.length, 2);
  movsTarjeta.forEach((m) => assert.ok(m.cobro instanceof Date, 'cada compra sabe cuándo se cobra'));
});

test('las cuotas activas dicen cuánto falta', () => {
  const c = hoja('Cuotas activas').rows[0];
  assert.equal(c.va, 3);
  assert.equal(c.de, 12);
  assert.equal(c.faltan, 9);
  assert.equal(c.pendiente, 9 * 120000);
});

test('deudas, abonos, metas y aportes salen completos', () => {
  const d = hoja('Deudas').rows[0];
  assert.equal(d.pagado, 200000);
  assert.equal(d.pendiente, 800000);
  assert.equal(hoja('Abonos a deudas').rows.length, 1);

  const m = hoja('Metas de ahorro').rows[0];
  assert.equal(m.ahorrado, 400000);
  assert.equal(m.falta, 5600000);
  assert.equal(m.avance, 7);
  const aportes = hoja('Aportes a metas').rows;
  assert.equal(aportes.length, 2);
  assert.equal(aportes.find((a) => a.monto < 0).tipo, 'Retiro');
});

test('una deuda en USD reporta el pendiente en las dos monedas', () => {
  const soloUSD = { ...datos, debts: [{ id: 'd9', name: 'USD', totalAmount: 1000, currency: 'USD',
                                        exchangeRate: 4100, startDate: '2026-01-01', payments: [] }] };
  const d = buildReportSheets(soloUSD).find((h) => h.name === 'Deudas').rows[0];
  assert.equal(d.pendiente, 1000);
  assert.equal(d.pendienteCOP, 4100000);
});

test('con la app vacía el reporte se genera igual, sin filas', () => {
  const vacio = buildReportSheets({});
  assert.equal(vacio.length, 15);
  vacio.forEach((h) => {
    assert.ok(Array.isArray(h.rows), `${h.name} sin filas`);
    assert.ok(h.columns.length > 0, `${h.name} sin columnas`);
  });
  assert.equal(vacio.find((h) => h.name === 'Movimientos').rows.length, 0);
});

test('los nombres de hoja son válidos para Excel', () => {
  hojas.forEach((h) => {
    assert.ok(h.name.length <= 31, `"${h.name}" pasa de 31 caracteres`);
    assert.ok(!/[\\/*?:[\]]/.test(h.name), `"${h.name}" tiene caracteres prohibidos`);
  });
  assert.equal(new Set(hojas.map((h) => h.name)).size, hojas.length, 'nombres repetidos');
});

test('toda fila usa claves que existen como columna', () => {
  hojas.forEach((h) => {
    const claves = new Set(h.columns.map((c) => c.key));
    h.rows.forEach((r) => Object.keys(r).forEach((k) => {
      assert.ok(claves.has(k), `${h.name}: la fila trae "${k}" y no hay columna`);
    }));
  });
});
