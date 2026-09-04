import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCardStatements, nextStatement, pastStatements,
  activeInstallmentGroups, projectInstallments, buildCommitments, paymentDayInMonth,
} from './projections.js';

/* Corte el 15, pago el 5 del mes siguiente al corte. */
const tarjeta = { id: 'c1', name: 'Visa', cutDay: 15, paymentDay: 5 };

const gasto = (id, date, amount, extra = {}) => ({
  id, type: 'gasto', amount, category: 'compras', date, note: id, cardId: 'c1', ...extra,
});

test('las compras antes y después del corte caen en facturas distintas', () => {
  const tx = [gasto('a', '2026-09-10', 100000), gasto('b', '2026-09-20', 50000)];
  const facturas = buildCardStatements(tx, tarjeta);
  assert.equal(facturas.length, 2);
  assert.equal(facturas[0].paymentDate, '2026-10-05', 'compra del 10: entra al corte del 15 de sep');
  assert.equal(facturas[1].paymentDate, '2026-11-05', 'compra del 20: se pasa al corte de oct');
});

test('varias compras del mismo ciclo se suman en una sola factura', () => {
  const tx = [gasto('a', '2026-09-01', 100000), gasto('b', '2026-09-10', 30000), gasto('c', '2026-09-14', 20000)];
  const facturas = buildCardStatements(tx, tarjeta);
  assert.equal(facturas.length, 1);
  assert.equal(facturas[0].total, 150000);
  assert.equal(facturas[0].items.length, 3);
});

test('solo cuenta lo de esa tarjeta y solo los gastos', () => {
  const tx = [
    gasto('a', '2026-09-01', 100000),
    gasto('otra', '2026-09-01', 999, { cardId: 'c2' }),
    { id: 'ing', type: 'ingreso', amount: 500, category: 'salario', date: '2026-09-01', cardId: 'c1' },
  ];
  const facturas = buildCardStatements(tx, tarjeta);
  assert.equal(facturas.length, 1);
  assert.equal(facturas[0].total, 100000);
});

test('sin día de corte o de pago no hay factura que calcular', () => {
  assert.deepEqual(buildCardStatements([gasto('a', '2026-09-01', 1)], { id: 'c1' }), []);
  assert.deepEqual(buildCardStatements([gasto('a', '2026-09-01', 1)], { id: 'c1', cutDay: 15 }), []);
});

test('la próxima factura es la primera que aún no se ha pagado', () => {
  const tx = [gasto('a', '2026-08-01', 10), gasto('b', '2026-09-10', 20), gasto('c', '2026-09-20', 30)];
  const facturas = buildCardStatements(tx, tarjeta);
  const proxima = nextStatement(facturas, '2026-09-25');
  assert.equal(proxima.paymentDate, '2026-10-05');
  assert.equal(proxima.total, 20);
  assert.equal(pastStatements(facturas, '2026-09-25').length, 1, 'la de septiembre ya pasó');
});

test('si ya se pagaron todas, no hay próxima', () => {
  const facturas = buildCardStatements([gasto('a', '2026-01-05', 10)], tarjeta);
  assert.equal(nextStatement(facturas, '2027-01-01'), null);
});

/* ------------------------------------------------------------ cuotas ------ */

const cuota = (id, date, n, extra = {}) => ({
  id, type: 'gasto', amount: 120000, category: 'compras', date, note: 'Audífonos',
  cardId: 'c1', isInstallment: true, totalInstallments: 12, currentInstallment: n,
  installmentGroupId: 'grp1', ...extra,
});

test('el grupo va por la cuota más alta registrada', () => {
  const grupos = activeInstallmentGroups([cuota('x1', '2026-07-20', 1), cuota('x2', '2026-08-20', 2), cuota('x3', '2026-09-20', 3)]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].paid, 3);
  assert.equal(grupos[0].remaining, 9);
  assert.equal(grupos[0].monthly, 120000);
});

test('una compra a cuotas ya terminada no aparece', () => {
  assert.deepEqual(activeInstallmentGroups([cuota('x', '2026-09-20', 12)]), []);
});

test('las cuotas que faltan aparecen en los meses siguientes, una por mes', () => {
  const meses = ['2026-10', '2026-11', '2026-12', '2027-01'];
  const proy = projectInstallments([cuota('x', '2026-09-20', 3)], meses);
  meses.forEach((m) => assert.equal(proy[m].total, 120000, `falta la cuota de ${m}`));
  assert.equal(proy['2026-10'].items[0].cuota, 4);
  assert.equal(proy['2026-11'].items[0].cuota, 5);
  assert.equal(proy['2026-10'].items[0].de, 12);
});

test('dos compras a cuotas se suman en el mismo mes', () => {
  const otra = { ...cuota('y', '2026-09-15', 1), installmentGroupId: 'grp2', amount: 80000, totalInstallments: 3 };
  const proy = projectInstallments([cuota('x', '2026-09-20', 3), otra], ['2026-10']);
  assert.equal(proy['2026-10'].total, 200000);
  assert.equal(proy['2026-10'].items.length, 2);
});

test('las cuotas que caen fuera de la ventana no se cuentan', () => {
  const proy = projectInstallments([cuota('x', '2026-09-20', 11)], ['2026-10', '2026-11']);
  assert.equal(proy['2026-10'].total, 120000, 'solo queda la cuota 12');
  assert.equal(proy['2026-11'].total, 0);
});

test('los compromisos suman cuotas más gastos fijos', () => {
  const fijos = [{ id: 'f1', name: 'Arriendo', amount: 1200000 }, { id: 'f2', name: 'Internet', amount: 90000 }];
  const c = buildCommitments([cuota('x', '2026-09-20', 3)], fijos, ['2026-10', '2026-11']);
  assert.equal(c[0].installments, 120000);
  assert.equal(c[0].fixed, 1290000);
  assert.equal(c[0].total, 1410000);
  assert.equal(c[1].total, 1410000);
});

test('sin cuotas ni gastos fijos, los compromisos son cero', () => {
  const c = buildCommitments([], [], ['2026-10']);
  assert.equal(c[0].total, 0);
  assert.deepEqual(c[0].items, []);
});

test('el día de pago se recorta si el mes es más corto', () => {
  assert.equal(paymentDayInMonth('2026-02', 31), '2026-02-28');
  assert.equal(paymentDayInMonth('2026-04', 31), '2026-04-30');
  assert.equal(paymentDayInMonth('2026-10', 5), '2026-10-05');
  assert.equal(paymentDayInMonth('2026-10', null), null);
});
