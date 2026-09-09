import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCharge, upcomingCharges } from './upcoming.js';

const HOY = '2026-09-08';

const estado = {
  fixedExpenses: [
    { id: 'arriendo', name: 'Aporte Casa', totalAmount: 300_000, dueDay: 5, shares: [] },
    { id: 'gym', name: 'Gimnasio', totalAmount: 103_400, dueDay: 10, shares: [] },
    { id: 'celular', name: 'Plan Celular', totalAmount: 53_900, dueDay: 25, shares: [] },
    { id: 'hbo', name: 'HBO Max', totalAmount: 12_450, dueDay: 12,
      shares: [{ id: 's1', personId: 'p1', amount: 4_150 }] },
    { id: 'sinfecha', name: 'Motilada', totalAmount: 40_000, shares: [] },
  ],
  transactions: [],
};

test('muestra lo que se cobra dentro de la ventana', () => {
  const c = upcomingCharges(estado, 7, HOY).map((x) => x.name);
  assert.deepEqual(c, ['Aporte Casa', 'Gimnasio', 'HBO Max']);
});

test('el celular del 25 no aparece a 7 días, pero sí a 30', () => {
  assert.ok(!upcomingCharges(estado, 7, HOY).some((c) => c.id === 'celular'));
  assert.ok(upcomingCharges(estado, 30, HOY).some((c) => c.id === 'celular'));
});

test('un gasto sin día de cobro no aparece', () => {
  // Sin ese dato no hay nada que anticipar, e inventarle fecha sería peor.
  assert.ok(!upcomingCharges(estado, 30, HOY).some((c) => c.id === 'sinfecha'));
});

test('lo que ya se venció sin pagar sale marcado', () => {
  const arriendo = upcomingCharges(estado, 7, HOY).find((c) => c.id === 'arriendo');
  assert.equal(arriendo.date, '2026-09-05', 'era el 5 y hoy es 8');
  assert.equal(arriendo.vencido, true);
});

test('lo ya pagado desaparece de la lista', () => {
  const conPago = {
    ...estado,
    transactions: [{ id: 't1', type: 'gasto', amount: 300_000, date: '2026-09-05', fixedExpenseId: 'arriendo' }],
  };
  assert.ok(!upcomingCharges(conPago, 7, HOY).some((c) => c.id === 'arriendo'));
});

test('de un gasto compartido se anuncia TU parte', () => {
  const hbo = upcomingCharges(estado, 7, HOY).find((c) => c.id === 'hbo');
  assert.equal(hbo.amount, 8_300, '12.450 menos los 4.150 de Juanjo');
});

test('salen ordenados por fecha', () => {
  const fechas = upcomingCharges(estado, 30, HOY).map((c) => c.date);
  assert.deepEqual(fechas, [...fechas].sort());
});

test('pagado el de este mes, el próximo cobro es el del mes entrante', () => {
  const f = { id: 'x', dueDay: 5 };
  assert.deepEqual(nextCharge(f, HOY, true), { date: '2026-10-05', vencido: false });
  assert.deepEqual(nextCharge(f, HOY, false), { date: '2026-09-05', vencido: true });
});

test('un día 31 se recorta al último día de un mes corto', () => {
  const f = { id: 'x', dueDay: 31 };
  assert.equal(nextCharge(f, '2026-11-01', false).date, '2026-11-30');
  assert.equal(nextCharge(f, '2026-02-01', false).date, '2026-02-28');
});

test('sin día de cobro no hay próximo cobro', () => {
  assert.equal(nextCharge({ id: 'x' }, HOY, false), null);
});

test('un estado vacío no revienta', () => {
  assert.deepEqual(upcomingCharges({}, 7, HOY), []);
});

test('la última semana del mes anuncia lo del mes entrante', () => {
  /*
   * El caso que dejaba ciega la última semana de todos los meses. El 28, con
   * el arriendo de este mes ya pagado, el del 1 se escondía por venir de un
   * gasto "pagado" — cuando es justo la semana en que uno quiere saberlo.
   */
  const conArriendoPago = {
    ...estado,
    transactions: [{ id: 't1', type: 'gasto', amount: 300_000, date: '2026-09-05', fixedExpenseId: 'arriendo' }],
  };
  const c = upcomingCharges(conArriendoPago, 8, '2026-09-28');
  const arriendo = c.find((x) => x.id === 'arriendo');
  assert.equal(arriendo.date, '2026-10-05', 'el del mes entrante');
  assert.equal(arriendo.vencido, false);
});

test('pagar por adelantado no hace que te lo anuncien igual', () => {
  // Si el celular es el 25 y lo pagaste el 10, el 25 no se anuncia.
  const pagadoAntes = {
    ...estado,
    transactions: [{ id: 't1', type: 'gasto', amount: 53_900, date: '2026-09-10', fixedExpenseId: 'celular' }],
  };
  assert.ok(!upcomingCharges(pagadoAntes, 30, '2026-09-20').some((c) => c.id === 'celular'));
});

test('el mes entrante se anuncia aunque el de este mes se haya pagado tarde', () => {
  const pagadoTarde = {
    ...estado,
    transactions: [{ id: 't1', type: 'gasto', amount: 103_400, date: '2026-09-27', fixedExpenseId: 'gym' }],
  };
  const gym = upcomingCharges(pagadoTarde, 15, '2026-09-29').find((c) => c.id === 'gym');
  assert.equal(gym.date, '2026-10-10');
});
