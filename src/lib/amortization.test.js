import test from 'node:test';
import assert from 'node:assert/strict';
import {
  simulate, levelPayment, monthsRemaining, comparePlans, impactOfNewCommitment, replayPayments } from './amortization.js';

/*
 * El caso real: préstamo de libre inversión de Bancolombia.
 * Los valores esperados salen del plan que Camilo ya tenía calculado aparte,
 * así que esto verifica el motor contra una fuente independiente.
 */
const PRESTAMO = { principal: 14_000_000, monthlyRate: 0.0167 };
const CUOTA_MINIMA = 446_413;
const ABONO_EXTRA = 737_587;
const PAGO_TOTAL = CUOTA_MINIMA + ABONO_EXTRA;   // 1.184.000

/*
 * Se compara con tolerancia de unos pocos pesos a propósito.
 *
 * El plan de referencia redondea el saldo al peso cada mes; este motor lleva
 * precisión completa y redondea solo al mostrar. Sobre 14 meses eso da 1 o 2
 * pesos de diferencia. Ninguna de las dos está mal, son convenciones distintas,
 * y forzar una coincidencia exacta sería ajustar el motor a una hoja de cálculo
 * en vez de a la matemática. La app muestra cifras redondeadas, así que el
 * usuario nunca ve la diferencia.
 */
const TOLERANCIA = 5;
const alPeso = (a, b, msg) => assert.ok(
  Math.abs(a - b) <= TOLERANCIA,
  `${msg || ''}: esperaba ~${Math.round(b)}, dio ${Math.round(a)}`,
);

test('el pago total del plan son $1.184.000', () => {
  assert.equal(PAGO_TOTAL, 1_184_000);
});

test('reproduce el saldo mes a mes del plan, al peso', () => {
  const { schedule } = simulate({ ...PRESTAMO, payment: PAGO_TOTAL });
  const esperado = [
    13_049_800, 12_083_732, 11_101_530, 10_102_926, 9_087_645, 8_055_409,
    7_005_934, 5_938_934, 4_854_114, 3_751_178, 2_629_823, 1_489_741, 330_620, 0,
  ];
  esperado.forEach((saldo, i) => {
    alPeso(schedule[i].closing, saldo, `mes ${i + 1}`);
  });
});

test('el desglose del primer mes es interés $233.800 y capital $950.200', () => {
  const { schedule } = simulate({ ...PRESTAMO, payment: PAGO_TOTAL });
  alPeso(schedule[0].interest, 233_800);
  alPeso(schedule[0].principal, 950_200);
  alPeso(schedule[0].opening, 14_000_000);
});

test('con el plan sale en 14 meses pagando ~$1.728.141 de intereses', () => {
  const r = simulate({ ...PRESTAMO, payment: PAGO_TOTAL });
  assert.equal(r.months, 14);
  assert.ok(r.feasible);
  alPeso(r.totalInterest, 1_728_141);
});

test('la última cuota es parcial, no la cuota completa', () => {
  const { schedule } = simulate({ ...PRESTAMO, payment: PAGO_TOTAL });
  const ultima = schedule[schedule.length - 1];
  assert.ok(ultima.payment < PAGO_TOTAL, 'no se paga de más el último mes');
  alPeso(ultima.payment, 330_620 * 1.0167);
  assert.equal(ultima.closing, 0);
});

test('pagando solo la cuota mínima son ~45 meses', () => {
  const r = simulate({ ...PRESTAMO, payment: CUOTA_MINIMA });
  assert.ok(r.feasible);
  assert.ok(r.months >= 44 && r.months <= 45, `dio ${r.months} meses`);
});

test('el plan ahorra ~31 meses y más de $4 millones en intereses', () => {
  const c = comparePlans({ ...PRESTAMO, minimumPayment: CUOTA_MINIMA, extra: ABONO_EXTRA });
  assert.equal(c.withExtra.months, 14);
  assert.ok(c.monthsSaved >= 30, `ahorró ${c.mesesAhorrados} meses`);
  assert.ok(c.interestSaved > 4_000_000, `ahorró ${Math.round(c.interesAhorrado)}`);
});

test('la suma de capital de todas las cuotas devuelve el préstamo completo', () => {
  const { schedule } = simulate({ ...PRESTAMO, payment: PAGO_TOTAL });
  const capital = schedule.reduce((s, f) => s + f.principal, 0);
  alPeso(capital, 14_000_000, 'no se pierde ni se inventa capital');
});

test('pagado = capital + intereses', () => {
  const r = simulate({ ...PRESTAMO, payment: PAGO_TOTAL });
  alPeso(r.totalPaid, 14_000_000 + r.totalInterest);
});

/* ------------------------------------------------------- casos de borde --- */

test('si el pago no cubre ni los intereses, avisa en vez de colgarse', () => {
  const r = simulate({ ...PRESTAMO, payment: 100_000 });   // interés mes 1: 233.800
  assert.equal(r.feasible, false);
  assert.equal(r.months, Infinity);
  alPeso(r.minimumPayment, 233_800, 'dice cuánto haría falta como mínimo');
});

test('pagar justo el interés tampoco liquida nunca', () => {
  const r = simulate({ ...PRESTAMO, payment: 14_000_000 * 0.0167 });
  assert.equal(r.feasible, false);
});

test('una deuda sin intereses se divide simple', () => {
  const r = simulate({ principal: 1_200_000, monthlyRate: 0, payment: 100_000 });
  assert.equal(r.months, 12);
  assert.equal(r.totalInterest, 0);
});

test('una deuda ya pagada no genera cronograma', () => {
  const r = simulate({ principal: 0, monthlyRate: 0.0167, payment: 100_000 });
  assert.equal(r.months, 0);
  assert.ok(r.feasible);
});

test('pagar todo de una liquida en un mes', () => {
  const r = simulate({ ...PRESTAMO, payment: 20_000_000 });
  assert.equal(r.months, 1);
  alPeso(r.totalPaid, 14_000_000 * 1.0167);
});

/* ----------------------------------------------------------- fórmulas ----- */

test('levelPayment reproduce la cuota mínima del préstamo', () => {
  const installment = levelPayment(14_000_000, 0.0167, 45);
  assert.ok(Math.abs(installment - CUOTA_MINIMA) < 2000, `dio ${Math.round(installment)}`);
});

test('monthsRemaining coincide con lo que da la simulación', () => {
  assert.equal(monthsRemaining(14_000_000, 0.0167, PAGO_TOTAL), 14);
  assert.equal(monthsRemaining(14_000_000, 0.0167, 100_000), null, 'cuota insuficiente');
});

/* --------------------------------------------------------- guardarraíl ---- */

test('una compra a 12 cuotas de $128.000 atrasa la liquidación', () => {
  const r = impactOfNewCommitment({
    ...PRESTAMO, payment: PAGO_TOTAL, monthlyCommitment: 128_000,
  });
  assert.equal(r.before.months, 14);
  assert.ok(r.extraMonths >= 1, `atrasó ${r.mesesExtra} meses`);
  assert.ok(r.extraInterest > 0, 'y cuesta más intereses');
});

test('un compromiso que se come el abono entero vuelve impagable la deuda', () => {
  // Con $1.000.000 comprometido quedarían $184.000/mes para el préstamo, y el
  // interés del primer mes solo ya es $233.800: la deuda crecería sola.
  const r = impactOfNewCommitment({
    ...PRESTAMO, payment: PAGO_TOTAL, monthlyCommitment: 1_000_000,
  });
  assert.equal(r.after.feasible, false);
  assert.equal(r.becomesUnpayable, true, 'la app tiene que poder avisar esto');
  assert.equal(r.extraMonths, null, 'no hay "cuántos meses más": nunca se acaba');
});

test('un compromiso moderado sí es viable, solo más lento', () => {
  const r = impactOfNewCommitment({
    ...PRESTAMO, payment: PAGO_TOTAL, monthlyCommitment: 400_000,
  });
  assert.equal(r.becomesUnpayable, false);
  assert.ok(r.after.feasible);
  assert.ok(r.extraMonths > 0 && r.extraMonths < 20, `atrasó ${r.mesesExtra} meses`);
});

/* --------------------------------------------------- lo que ya pagaste --- */

test('reconstruye el interés y el capital de los abonos hechos', () => {
  const filas = replayPayments({
    principal: 14_000_000,
    monthlyRate: 0.0167,
    payments: [
      { id: 'p1', amount: 1_133_000, date: '2026-10-15' },
      { id: 'p2', amount: 1_133_000, date: '2026-11-15' },
    ],
  });

  assert.equal(filas.length, 2);
  assert.equal(Math.round(filas[0].interest), 233_800);
  assert.equal(Math.round(filas[0].principal), 899_200);
  assert.equal(Math.round(filas[0].closing), 13_100_800);
  // El segundo mes se va menos plata en intereses: ese es todo el punto.
  assert.ok(filas[1].interest < filas[0].interest);
});

test('el saldo que reporta el banco manda sobre el modelo', () => {
  const filas = replayPayments({
    principal: 14_000_000,
    monthlyRate: 0.0167,
    payments: [
      // El banco cobró un seguro: quedan 20.000 más de lo que dice el modelo.
      { id: 'p1', amount: 1_133_000, date: '2026-10-15', balanceAfter: 13_120_800 },
      { id: 'p2', amount: 1_133_000, date: '2026-11-15' },
    ],
  });
  assert.equal(filas[0].closing, 13_120_800);
  assert.equal(filas[0].anchored, true);
  // Y la diferencia no se arrastra: el mes siguiente parte del saldo real.
  assert.equal(filas[1].opening, 13_120_800);
  assert.equal(filas[1].anchored, false);
});

test('los abonos se ordenan por fecha aunque entren revueltos', () => {
  const filas = replayPayments({
    principal: 1_000_000, monthlyRate: 0.01,
    payments: [
      { id: 'b', amount: 100_000, date: '2026-11-01' },
      { id: 'a', amount: 100_000, date: '2026-10-01' },
    ],
  });
  assert.deepEqual(filas.map((f) => f.date), ['2026-10-01', '2026-11-01']);
});

test('sin abonos no hay historia', () => {
  assert.deepEqual(replayPayments({ principal: 1_000_000, monthlyRate: 0.01, payments: [] }), []);
  assert.deepEqual(replayPayments({ principal: 1_000_000, monthlyRate: 0.01 }), []);
});
