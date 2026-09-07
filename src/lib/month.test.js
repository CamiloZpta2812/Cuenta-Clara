import test from 'node:test';
import assert from 'node:assert/strict';
import {
  myShare, othersShare, monthCollections, monthPlan, monthActual,
  monthCashOut, monthSummary, simulatePlanChange,
} from './month.js';

/*
 * El estado real de Camilo, reorganizado según el modelo nuevo.
 *
 * La diferencia con su hoja: la cooperativa y los dos colchones salen de
 * "gastos fijos" y pasan a ser buckets. La prueba clave es que ese reacomodo
 * NO cambia el abono extra — solo lo hace legible.
 */
const estado = {
  incomeSources: [
    { id: 'i1', name: 'Salario', expected: 3_400_000, variable: true },
    { id: 'i2', name: 'Club Aletas', expected: 200_000, variable: true },
  ],
  people: [
    { id: 'p1', name: 'Juanjo', linkedUserId: null },
    { id: 'p2', name: 'Yeison', linkedUserId: null },
    { id: 'p3', name: 'Andy', linkedUserId: null },
    { id: 'p4', name: 'Paula', linkedUserId: null },
    { id: 'p5', name: 'Alex', linkedUserId: null },
  ],
  fixedExpenses: [
    { id: 'f1', name: 'HBO Max', totalAmount: 12_450, shares: [{ id: 's1', personId: 'p1', amount: 4_150 }] },
    { id: 'f2', name: 'Spotify', totalAmount: 30_500, shares: [
      { id: 's2', personId: 'p2', amount: 6_100 }, { id: 's3', personId: 'p3', amount: 6_100 },
      { id: 's4', personId: 'p4', amount: 6_100 }, { id: 's5', personId: 'p5', amount: 6_100 },
    ] },
    { id: 'f3', name: 'iCloud', totalAmount: 11_300, shares: [] },
    { id: 'f4', name: 'Disney+', totalAmount: 12_000, shares: [] },
    { id: 'f5', name: 'Plan Celular', totalAmount: 53_900, shares: [] },
    { id: 'f6', name: 'Motilada', totalAmount: 40_000, shares: [] },
    { id: 'f7', name: 'Aporte Casa', totalAmount: 300_000, shares: [] },
    { id: 'f8', name: 'Gimnasio', totalAmount: 103_400, shares: [] },
    { id: 'f9', name: 'Mantenimiento Moto', totalAmount: 100_000, shares: [] },
    { id: 'f10', name: 'Gasolina', totalAmount: 160_000, shares: [] },
  ],
  buckets: [
    { id: 'b1', name: 'Ahorro personal 1', kind: 'meta', liquid: true, monthlyAmount: 50_000 },
    { id: 'b2', name: 'Ahorro personal 2', kind: 'meta', liquid: true, monthlyAmount: 300_000 },
    { id: 'b3', name: 'Cooperativa', kind: 'meta', liquid: false, monthlyAmount: 76_000 },
    { id: 'b4', name: 'Colchón de gastos', kind: 'colchon', liquid: true, monthlyAmount: 65_000 },
    { id: 'b5', name: 'Colchón de seguridad', kind: 'colchon', liquid: true, monthlyAmount: 300_000 },
  ],
  debts: [
    // interestRate es el porcentaje MENSUAL, como lo reporta el banco.
    { id: 'd1', name: 'Libre inversión Bancolombia', currentBalance: 14_000_000,
      interestRate: 1.67, fixedPayment: 446_413, payoffMode: 'reducir-plazo', payments: [] },
  ],
  monthlyPlans: [{ month: '2026-09', variableEstimate: 830_000 }],
  transactions: [],
  collections: [],
};

const MES = '2026-09';

/* --------------------------------------------------- reparto de gastos --- */

test('mi parte de un gasto compartido es el total menos lo de los demás', () => {
  const spotify = estado.fixedExpenses.find((g) => g.id === 'f2');
  assert.equal(myShare(spotify), 6_100);
  assert.equal(othersShare(spotify), 24_400);
  const hbo = estado.fixedExpenses.find((g) => g.id === 'f1');
  assert.equal(myShare(hbo), 8_300);
  assert.equal(othersShare(hbo), 4_150);
});

test('mi parte se calcula, no se guarda: nunca puede descuadrar', () => {
  const g = { totalAmount: 30_500, shares: [{ id: 'sx', personId: 'x', amount: 10_000 }] };
  assert.equal(myShare(g) + othersShare(g), g.totalAmount);
});

test('los gastos fijos de la hoja suman $936.000 de parte personal', () => {
  // 936.000 es el total de la hoja, que incluía cooperativa (76.000) y
  // colchón de gastos (65.000). Sin esos dos, los fijos "puros" son 795.000.
  const fijos = estado.fixedExpenses.reduce((s, g) => s + myShare(g), 0);
  assert.equal(fijos, 795_000);
  assert.equal(fijos + 76_000 + 65_000, 936_000, 'cuadra con el total de la hoja');
});

test('lo por cobrar son $28.550, repartidos entre 5 personas', () => {
  const total = estado.fixedExpenses.reduce((s, g) => s + othersShare(g), 0);
  assert.equal(total, 28_550);
  const filas = monthCollections(estado.fixedExpenses, [], '2026-09');
  assert.equal(filas.length, 5);
  assert.ok(filas.every((f) => !f.collected), 'sin registro, nada está cobrado');
});

test('marcar un cobro solo afecta ese mes y esa persona', () => {
  const collections = [{ month: '2026-09', shareId: 's2' }];
  const sept = monthCollections(estado.fixedExpenses, collections, '2026-09');
  assert.equal(sept.filter((c) => c.collected).length, 1);
  assert.equal(sept.find((c) => c.personId === 'p2').collected, true);
  const oct = monthCollections(estado.fixedExpenses, collections, '2026-10');
  assert.equal(oct.filter((c) => c.collected).length, 0, 'octubre arranca en cero');
});

/* --------------------------------------------------------------- plan --- */

test('el plan reproduce exactamente el abono extra de $737.587', () => {
  const p = monthPlan(estado, MES);
  assert.equal(p.income, 3_600_000);
  assert.equal(p.fixedExpenses, 795_000);
  assert.equal(p.debtPayment, 446_413);
  assert.equal(p.savings, 426_000, 'las tres metas, con cooperativa incluida');
  assert.equal(p.variable, 830_000);
  assert.equal(p.grossSurplus, 1_102_587);
  assert.equal(p.cushion, 365_000, 'los dos colchones');
  assert.equal(p.availableForExtra, 737_587);
});

test('reorganizar las categorías no cambia el resultado final', () => {
  // La hoja metía cooperativa y colchón de gastos dentro de "gastos fijos".
  // Este modelo los saca a buckets. El abono extra tiene que dar igual.
  const p = monthPlan(estado, MES);
  const comoLaHoja = 3_600_000 - 936_000 - 446_413 - 350_000 - 830_000 - 300_000;
  assert.equal(p.availableForExtra, comoLaHoja);
  assert.equal(comoLaHoja, 737_587);
});

test('el pago total mensual a la deuda son $1.184.000', () => {
  const p = monthPlan(estado, MES);
  assert.equal(p.debtPayment + p.availableForExtra, 1_184_000);
});

test('el ahorro no líquido cuenta como ahorro pero se puede distinguir', () => {
  const noLiquido = estado.buckets.filter((b) => b.kind === 'meta' && !b.liquid);
  assert.equal(noLiquido.length, 1);
  assert.equal(noLiquido[0].monthlyAmount, 76_000);
  const liquid = estado.buckets
    .filter((b) => b.kind === 'meta' && b.liquid)
    .reduce((s, b) => s + b.monthlyAmount, 0);
  assert.equal(liquid, 350_000, 'lo que sí podrías tocar si hiciera falta');
});

/* --------------------------------------------------------------- real --- */

const conMovimientos = {
  ...estado,
  transactions: [
    { id: 't1', type: 'ingreso', amount: 3_400_000, category: 'salario', date: '2026-09-30' },
    { id: 't2', type: 'ingreso', amount: 200_000, category: 'otros_ingreso', date: '2026-09-15' },
    { id: 't3', type: 'gasto', amount: 300_000, category: 'vivienda', date: '2026-09-01', fixedExpenseId: 'f7', paymentMethod: 'debito' },
    { id: 't4', type: 'gasto', amount: 160_000, category: 'transporte', date: '2026-09-02', fixedExpenseId: 'f10', paymentMethod: 'debito' },
    { id: 't5', type: 'gasto', amount: 420_000, category: 'alimentacion', date: '2026-09-10', paymentMethod: 'debito' },
    { id: 't6', type: 'gasto', amount: 180_000, category: 'entretenimiento', date: '2026-09-20',
      paymentMethod: 'credito', cardId: 'c1', cashOutDate: '2026-11-05' },
  ],
  // Los abonos y aportes viven dentro de su deuda y su bucket, no sueltos.
  debts: estado.debts.map((d) => ({
    ...d, payments: [{ id: 'pd1', amount: 1_184_000, date: '2026-09-10' }],
  })),
  buckets: estado.buckets.map((b) => (b.id === 'b1'
    ? { ...b, contributions: [{ id: 'ap1', amount: 50_000, date: '2026-09-05' }] }
    : b)),
};

test('lo real se clasifica en las mismas líneas del plan', () => {
  const r = monthActual(conMovimientos, '2026-09');
  assert.equal(r.income, 3_600_000);
  assert.equal(r.fixedExpenses, 460_000, 'solo los dos fijos registrados');
  assert.equal(r.debtPayment, 1_184_000);
  assert.equal(r.savings, 50_000);
  assert.equal(r.variable, 600_000, 'los que no son fijo, ni deuda, ni ahorro');
});

test('una compra con tarjeta es gasto del mes de la compra', () => {
  const r = monthActual(conMovimientos, '2026-09');
  assert.ok(r.variable >= 180_000, 'la compra de sept cuenta en sept, aunque se pague en nov');
  const nov = monthActual(conMovimientos, '2026-11');
  assert.equal(nov.variable, 0, 'en noviembre no hay gasto nuevo, solo salida de caja');
});

test('la salida de caja sí ocurre en el mes en que se paga la tarjeta', () => {
  const sept = monthCashOut(conMovimientos, '2026-09');
  assert.equal(sept.conTarjeta, 0, 'en sept no salió plata por la tarjeta');
  assert.equal(sept.sinTarjeta, 880_000);

  const nov = monthCashOut(conMovimientos, '2026-11');
  assert.equal(nov.conTarjeta, 180_000, 'la plata sale cuando llega la factura');
  assert.equal(nov.total, 180_000);
});

test('gasto y salida de caja coinciden cuando pagas con débito', () => {
  const soloDebito = {
    transactions: [{ id: 'x', type: 'gasto', amount: 50_000, category: 'alimentacion',
                    date: '2026-09-10', paymentMethod: 'debito' }],
  };
  assert.equal(monthActual(soloDebito, '2026-09').variable, 50_000);
  assert.equal(monthCashOut(soloDebito, '2026-09').total, 50_000);
});

/* ------------------------------------------------------------ alertas --- */

test('avisa de los cobros pendientes con el costo anual', () => {
  const r = monthSummary(conMovimientos, '2026-09');
  const a = r.alerts.find((x) => x.type === 'cobro');
  assert.ok(a);
  assert.equal(a.amount, 28_550);
  assert.ok(a.detail.includes('342.600'), 'lo que pesa es el año, no el mes');
});

test('no avisa de cobros si ya se cobraron todos', () => {
  const todoCobrado = {
    ...conMovimientos,
    collections: ['s1', 's2', 's3', 's4', 's5'].map((shareId) => ({ month: '2026-09', shareId })),
  };
  const r = monthSummary(todoCobrado, '2026-09');
  assert.equal(r.alerts.filter((a) => a.type === 'cobro').length, 0);
});

test('avisa si el gasto variable se pasa del estimado', () => {
  const pasado = {
    ...conMovimientos,
    transactions: [...conMovimientos.transactions,
      { id: 'cena', type: 'gasto', amount: 490_000, category: 'entretenimiento', date: '2026-09-22', paymentMethod: 'debito' }],
  };
  const r = monthSummary(pasado, '2026-09');
  const a = r.alerts.find((x) => x.type === 'variable');
  assert.ok(a, 'el gasto variable llegó a 1.090.000 contra 830.000 estimados');
  assert.equal(a.amount, 260_000);
  assert.equal(a.severity, 'alerta', 'pasarse más del 20% no es un simple aviso');
});

test('no avisa si el gasto variable va por debajo del estimado', () => {
  const r = monthSummary(conMovimientos, '2026-09');
  assert.equal(r.alerts.filter((a) => a.type === 'variable').length, 0);
});

test('avisa si entró menos ingreso del planeado', () => {
  const menos = {
    ...conMovimientos,
    transactions: conMovimientos.transactions.filter((t) => t.id !== 't2'),
  };
  const r = monthSummary(menos, '2026-09');
  const a = r.alerts.find((x) => x.type === 'ingreso');
  assert.ok(a, 'faltó el Club Aletas');
  assert.equal(a.amount, 200_000);
});

/* -------------------------------------------------------------- desvíos -- */

test('el resumen señala en qué línea se desvió el mes', () => {
  const r = monthSummary(conMovimientos, '2026-09');
  assert.equal(r.deviations.income, 0, 'entró lo planeado');
  assert.equal(r.deviations.variable, 600_000 - 830_000, 'va por debajo del estimado');
  assert.ok(r.deviations.fixedExpenses < 0, 'faltan fijos por registrar en el mes');
});

test('un mes sin nada registrado no revienta', () => {
  const r = monthSummary(estado, '2026-09');
  assert.equal(r.real.income, 0);
  assert.equal(r.real.variable, 0);
  assert.equal(r.plan.availableForExtra, 737_587, 'el plan sigue en pie');
});

test('la app arranca sin datos sin romperse', () => {
  const r = monthSummary({}, '2026-09');
  assert.equal(r.plan.income, 0);
  assert.equal(r.plan.availableForExtra, 0);
  assert.deepEqual(r.collections, []);
});


/* ------------------------------------------------------------ simulador -- */

test('bajar el colchón acorta la deuda, y dice en cuánto', () => {
  const r = simulatePlanChange(estado, { cushion: -150_000 }, MES);
  assert.equal(r.extraBefore, 737_587);
  assert.equal(r.extraAfter, 887_587);
  assert.equal(r.before.months, 14);
  assert.equal(r.after.months, 12);
  assert.equal(r.monthsDifference, 2);
  assert.ok(r.interestDifference > 200_000, 'y se ahorra en intereses');
});

test('subir el colchón alarga la deuda, y también lo dice', () => {
  const r = simulatePlanChange(estado, { cushion: 100_000 }, MES);
  assert.equal(r.extraAfter, 637_587);
  assert.equal(r.monthsDifference, -1, 'un mes más');
  assert.ok(r.interestDifference < 0, 'y cuesta más intereses');
});

test('varios cambios a la vez se acumulan', () => {
  const r = simulatePlanChange(estado, { cushion: -100_000, variable: -50_000 }, MES);
  assert.equal(r.extraAfter, 737_587 + 150_000);
});

test('un gasto que se come el excedente deja el plan en déficit', () => {
  // Si los fijos suben 1,5 millones, el abono extra queda en negativo: no
  // alcanza ni para la cuota mínima. La app tiene que decirlo, no fingir
  // que simplemente "no abonas extra".
  const r = simulatePlanChange(estado, { fixedExpenses: 1_500_000 }, MES);
  assert.equal(r.deficit, true);
  assert.ok(r.extraAfter < 0, `abono quedó en ${r.abonoDespues}`);
  assert.equal(r.becomesUnpayable, true, 'con menos que la cuota, la deuda no se acaba');
  assert.equal(r.monthsDifference, null);
});

test('un plan holgado no se marca en déficit', () => {
  const r = simulatePlanChange(estado, { cushion: -150_000 }, MES);
  assert.equal(r.deficit, false);
});

test('sin deudas no hay nada que simular', () => {
  assert.equal(simulatePlanChange({ ...estado, debts: [] }, { cushion: -100_000 }, MES), null);
});

/* ---------------------------------------------------------- mes cerrado -- */

test('un mes cerrado se juzga contra el plan que tenía, no contra el de hoy', () => {
  const cerrado = {
    ...estado,
    monthlyPlans: [
      ...estado.monthlyPlans,
      { month: '2026-08', expectedIncome: 3_600_000, fixedExpenses: 700_000,
        debtPayment: 446_413, savings: 426_000, variableEstimate: 900_000,
        cushion: 365_000, locked: true },
    ],
  };
  const agosto = monthPlan(cerrado, '2026-08');
  assert.equal(agosto.locked, true);
  assert.equal(agosto.fixedExpenses, 700_000, 'los fijos de agosto, no los de hoy');
  assert.equal(agosto.variable, 900_000);
  assert.equal(agosto.availableForExtra, 762_587);

  // Septiembre sigue vivo y se recalcula con los gastos actuales.
  const sept = monthPlan(cerrado, MES);
  assert.equal(sept.locked, false);
  assert.equal(sept.fixedExpenses, 795_000);
});

test('sin plan guardado, el gasto variable estimado es cero', () => {
  const p = monthPlan(estado, '2026-12');
  assert.equal(p.variable, 0, 'no se hereda el estimado de otro mes');
  assert.equal(p.fixedExpenses, 795_000, 'lo demás sí se calcula igual');
});
