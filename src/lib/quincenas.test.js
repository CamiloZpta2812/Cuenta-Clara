import test from 'node:test';
import assert from 'node:assert/strict';
import { paydays, periods, monthEvents, buildQuincenas } from './quincenas.js';

const MES = '2026-10';

/*
 * El mes de Camilo, ya con las fechas reales: le pagan el 15 y el 30, la cuota
 * del crédito se cobra el 8, y los gastos fijos se amontonan en la primera
 * semana.
 */
const estado = {
  incomeSources: [
    { id: 'q1', name: 'Salario 1ª quincena', expected: 1_700_000, day: 15, active: true, startsPeriod: true },
    { id: 'q2', name: 'Salario 2ª quincena', expected: 1_700_000, day: 30, active: true, startsPeriod: true },
    { id: 'aletas', name: 'Club Aletas', expected: 200_000, day: 5, active: true },
  ],
  fixedExpenses: [
    { id: 'casa', name: 'Aporte Casa', totalAmount: 300_000, dueDay: 1, shares: [] },
    { id: 'gym', name: 'Gimnasio', totalAmount: 103_400, dueDay: 1, shares: [] },
    { id: 'celular', name: 'Plan Celular', totalAmount: 53_900, dueDay: 4, shares: [] },
    { id: 'hbo', name: 'HBO Max', totalAmount: 12_450, shares: [{ id: 's', personId: 'p1', amount: 4_150 }] },
  ],
  debts: [
    { id: 'li', name: 'Libre inversión', fixedPayment: 446_413, dueDay: 8,
      currentBalance: 14_000_000, startDate: '2026-09-08', payments: [] },
  ],
  buckets: [
    { id: 'seg', name: 'Colchón de seguridad', kind: 'colchon', monthlyAmount: 300_000,
      depositDay: 15, movesCash: true, shares: [], contributions: [] },
    { id: 'gatos', name: 'Colchón gatos', kind: 'colchon', monthlyAmount: 130_000,
      depositDay: 15, movesCash: true,
      shares: [{ id: 'sg', personId: 'p-sofi', amount: 65_000 }], contributions: [] },
    { id: 'gasolina', name: 'Gasolina', kind: 'colchon', monthlyAmount: 150_000,
      movesCash: false, shares: [], contributions: [] },
    { id: 'natillera', name: 'Natillera', kind: 'meta', monthlyAmount: 50_000,
      movesCash: true, shares: [], contributions: [] },
  ],
  monthlyPlans: [{ month: MES, variableEstimate: 620_000 }],
  transactions: [],
};

/* --------------------------------------------------------- las fronteras -- */

test('los días de pago salen de las fuentes, no de una configuración aparte', () => {
  assert.deepEqual(paydays(estado), [15, 30]);
});

test('un ingreso chico cae dentro de una quincena, no la abre', () => {
  /*
   * El Club Aletas cae el 5. Tomarlo como frontera partía el mes en pedazos
   * que no corresponden a nada: el arriendo del 1 en un tramo y la cuota del 8
   * en otro, escondiendo la concentración que esta pantalla existe para ver.
   */
  assert.ok(!paydays(estado).includes(5));
  const q = buildQuincenas(estado, MES).periods[0];
  assert.ok(q.items.some((i) => i.id === 'aletas'), 'pero su plata sí entra');
});

test('sin ninguna marcada se usan todos los días, antes que no mostrar nada', () => {
  const sinMarcar = {
    ...estado,
    incomeSources: estado.incomeSources.map((f) => ({ ...f, startsPeriod: false })),
  };
  assert.deepEqual(paydays(sinMarcar), [5, 15, 30]);
});

test('una fuente inactiva no marca frontera', () => {
  const conInactiva = {
    ...estado,
    incomeSources: [...estado.incomeSources,
      { id: 'viejo', name: 'Contrato que se acabó', expected: 500_000, day: 20,
        active: false, startsPeriod: true }],
  };
  assert.ok(!paydays(conInactiva).includes(20));
});

test('cada tramo va de un sueldo al día antes del siguiente', () => {
  assert.deepEqual(
    periods(estado, MES).map((x) => [x.start, x.endExclusive]),
    [
      ['2026-09-30', '2026-10-15'],
      ['2026-10-15', '2026-10-30'],
      ['2026-10-30', '2026-11-15'],
    ],
  );
});

test('el primer tramo viene del mes pasado, porque es el que paga el día 1', () => {
  /*
   * Sin él, los días 1 al 14 no aparecerían en ninguna parte y la primera
   * semana —la cara— quedaría fuera de la pantalla.
   */
  const ps = periods(estado, MES);
  assert.equal(ps[0].start, '2026-09-30');
  assert.equal(ps[0].fromPreviousMonth, true);
  assert.equal(ps[1].fromPreviousMonth, false);
});

test('un día 31 se recorta en los meses de 30', () => {
  const conDia31 = {
    ...estado,
    incomeSources: [{ id: 'x', name: 'Sueldo', expected: 1_000_000, day: 31, active: true }],
  };
  assert.equal(periods(conDia31, '2026-11').at(-1).start, '2026-11-30');
});

test('sin días de pago no hay calendario que armar', () => {
  const sinDias = {
    ...estado,
    incomeSources: [{ id: 'x', name: 'Sueldo', expected: 1_000_000, active: true }],
  };
  assert.deepEqual(periods(sinDias, MES), []);
  assert.deepEqual(buildQuincenas(sinDias, MES).periods, []);
});

/* ------------------------------------------------------------ los montos -- */

test('de un gasto compartido se cuenta solo tu parte', () => {
  const hbo = monthEvents(estado, MES).find((e) => e.id === 'hbo');
  assert.equal(hbo.amount, -8_300, '12.450 menos los 4.150 de Juanjo');
});

test('de un pote compartido, tu mitad', () => {
  const gatos = monthEvents(estado, MES).find((e) => e.id === 'gatos');
  assert.equal(gatos.amount, -65_000);
});

test('un ajuste del mes manda sobre el monto de siempre', () => {
  const ajustado = {
    ...estado,
    bucketAdjustments: [{ id: 'aj', month: MES, bucketId: 'seg', amount: 150_000 }],
  };
  assert.equal(monthEvents(ajustado, MES).find((e) => e.id === 'seg').amount, -150_000);
});

test('una deuda todavía sin primera cuota no entra', () => {
  const reciente = {
    ...estado,
    debts: estado.debts.map((d) => ({ ...d, startDate: '2026-10-03' })),
  };
  assert.ok(!monthEvents(reciente, MES).some((e) => e.kind === 'deuda'));
});

test('una reserva no es un evento: se gasta, no se aparta', () => {
  assert.ok(!monthEvents(estado, MES).some((e) => e.id === 'gasolina'));
});

/* -------------------------------------------------------- el reparto real -- */

test('la quincena que arranca el 30 paga la primera semana del mes entrante', () => {
  /*
   * El corazón de la pantalla. La plata del 30 de septiembre paga el arriendo
   * del 1 de octubre y la cuota del 8. Verlo por mes calendario lo escondía.
   */
  const q = buildQuincenas(estado, MES).periods[0];
  assert.equal(q.items.find((i) => i.name === 'Aporte Casa').date, '2026-10-01');
  assert.equal(q.items.find((i) => i.name === 'Cuota Libre inversión').date, '2026-10-08');
  assert.equal(q.items.find((i) => i.id === 'q2').date, '2026-09-30', 'y el sueldo que la paga');
});

test('los primeros ocho días se comen medio sueldo', () => {
  // Lo que Camilo sentía y no podía ver.
  const q = buildQuincenas(estado, MES).periods[0];
  const hastaEl8 = q.items
    .filter((i) => i.amount < 0 && i.date <= '2026-10-08')
    .reduce((s, i) => s - i.amount, 0);
  assert.equal(hastaEl8, 300_000 + 103_400 + 53_900 + 446_413);
  assert.equal(q.income, 1_700_000 + 200_000);
});

test('lo que se aparta el 15 cae en la quincena del 15', () => {
  const q = buildQuincenas(estado, MES).periods.find((p) => p.start === '2026-10-15');
  const ids = q.items.map((i) => i.id);
  assert.ok(ids.includes('seg'));
  assert.ok(ids.includes('gatos'));
  assert.ok(ids.includes('q1'), 'y el sueldo que la financia');
});

test('dentro de una quincena nada se cuenta dos veces', () => {
  buildQuincenas(estado, MES).periods.forEach((p) => {
    const ids = p.items.map((i) => i.id);
    assert.equal(ids.length, new Set(ids).size, `repetido en el tramo de ${p.start}`);
  });
});

test('lo que no tiene fecha se muestra aparte, no se reparte a ojo', () => {
  /*
   * Ponerlo en la quincena equivocada haría ver holgada la que no lo es, que
   * es justo el error que esta pantalla existe para no cometer.
   */
  const { unscheduled } = buildQuincenas(estado, MES);
  assert.deepEqual(unscheduled.map((e) => e.id), ['hbo', 'natillera']);
});

test('todo lo que tiene fecha queda ubicado, y solo lo demás queda suelto', () => {
  const { periods: ps, unscheduled } = buildQuincenas(estado, MES);
  const ubicados = new Set();
  ps.forEach((p) => p.items.forEach((i) => ubicados.add(i.id)));

  monthEvents(estado, MES)
    .filter((e) => e.day)
    .forEach((e) => assert.ok(ubicados.has(e.id), `${e.name} no quedó en ningún tramo`));

  unscheduled.forEach((e) => assert.equal(e.day, null, `${e.name} tenía fecha y quedó suelto`));
});

test('lo que queda en una quincena es lo que entró menos todo lo que sale', () => {
  const q = buildQuincenas(estado, MES).periods.find((p) => p.start === '2026-10-15');
  assert.equal(q.income, 1_700_000);
  assert.equal(q.outflow, 300_000 + 65_000, 'los dos colchones del 15');
  assert.equal(Math.round(q.leftover), Math.round(q.income - q.outflow - q.living));
});

test('la vida diaria se prorratea por los días del tramo, no por mes', () => {
  const { periods: ps, daily } = buildQuincenas(estado, MES);
  assert.equal(Math.round(daily), Math.round((620_000 + 150_000) / 31), 'variable + reservas');
  ps.forEach((p) => assert.equal(Math.round(p.living), Math.round(daily * p.days)));
});

test('un estado vacío no revienta', () => {
  assert.deepEqual(buildQuincenas({}, MES), { periods: [], unscheduled: [], daily: 0 });
  assert.deepEqual(monthEvents({}, MES), []);
  assert.deepEqual(paydays({}), []);
});
