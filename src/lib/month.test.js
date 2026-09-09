import test from 'node:test';
import assert from 'node:assert/strict';
import {
  myShare, othersShare, monthCollections, monthPlan, monthActual,
  monthCashOut, monthSummary, simulatePlanChange, targetDebt,
  firstInstallmentMonth, debtDueIn,
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
    { id: 'f10', name: 'Gasolina', totalAmount: 160_000, shares: [] },
  ],
  buckets: [
    { id: 'b1', name: 'Ahorro personal 1', kind: 'meta', liquid: true, monthlyAmount: 50_000 },
    { id: 'b2', name: 'Ahorro personal 2', kind: 'meta', liquid: true, monthlyAmount: 300_000 },
    { id: 'b3', name: 'Cooperativa', kind: 'meta', liquid: false, monthlyAmount: 76_000 },
    // Los colchones no son ahorro con destino: son plata guardada para un gasto
    // que llega sin avisar. Los gatos comen y se enferman; la moto se vara.
    { id: 'b4', name: 'Colchón gatos', kind: 'colchon', liquid: true, monthlyAmount: 65_000 },
    { id: 'b6', name: 'Colchón moto', kind: 'colchon', liquid: true, monthlyAmount: 100_000 },
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
  // 936.000 es el total de la hoja, que metía en "gastos fijos" tres cosas que
  // no lo son: la cooperativa (76.000, que es ahorro), el colchón de los gatos
  // (65.000) y el mantenimiento de la moto (100.000). Los dos últimos no son un
  // gasto que llegue cada mes: son plata guardada para cuando llegue. Sin esos
  // tres, los fijos "puros" son 695.000.
  const fijos = estado.fixedExpenses.reduce((s, g) => s + myShare(g), 0);
  assert.equal(fijos, 695_000);
  assert.equal(fijos + 76_000 + 65_000 + 100_000, 936_000, 'cuadra con el total de la hoja');
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
  assert.equal(p.fixedExpenses, 695_000);
  assert.equal(p.debtPayment, 446_413);
  assert.equal(p.savings, 426_000, 'las tres metas, con cooperativa incluida');
  assert.equal(p.variable, 830_000);
  assert.equal(p.grossSurplus, 1_202_587);
  assert.equal(p.cushion, 465_000, 'gatos, moto y el de seguridad');
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
  assert.equal(sept.fixedExpenses, 695_000);
});

test('sin plan guardado, el gasto variable estimado es cero', () => {
  const p = monthPlan(estado, '2026-12');
  assert.equal(p.variable, 0, 'no se hereda el estimado de otro mes');
  assert.equal(p.fixedExpenses, 695_000, 'lo demás sí se calcula igual');
});


/* ------------------------------------------------------------ colchones -- */

/*
 * Un colchón no es un gasto: es plata que apartas para cuando llegue. La hoja
 * los tenía dentro de "gastos fijos" y por eso no se distinguían.
 */
test('mover un gasto a colchón no cambia el abono extra, solo lo hace legible', () => {
  const comoAntes = {
    ...estado,
    fixedExpenses: [...estado.fixedExpenses,
      { id: 'f9', name: 'Mantenimiento Moto', totalAmount: 100_000, shares: [] }],
    buckets: estado.buckets.filter((b) => b.id !== 'b6'),
  };
  assert.equal(monthPlan(comoAntes, MES).fixedExpenses, 795_000);
  assert.equal(monthPlan(comoAntes, MES).cushion, 365_000);

  const ahora = monthPlan(estado, MES);
  assert.equal(ahora.fixedExpenses, 695_000, 'la moto salió de los fijos');
  assert.equal(ahora.cushion, 465_000, 'y entró a los colchones');

  assert.equal(ahora.availableForExtra, monthPlan(comoAntes, MES).availableForExtra,
               'el abono extra no se mueve: la plata sigue saliendo igual');
});

test('aportar a un colchón no cuenta como haberse pasado de ahorro', () => {
  const conColchones = {
    ...estado,
    buckets: estado.buckets.map((b) => {
      if (b.id === 'b1') return { ...b, contributions: [{ id: 'c1', amount: 50_000, date: '2026-09-05' }] };
      if (b.id === 'b4') return { ...b, contributions: [{ id: 'c2', amount: 65_000, date: '2026-09-05' }] };
      if (b.id === 'b6') return { ...b, contributions: [{ id: 'c3', amount: 100_000, date: '2026-09-05' }] };
      return b;
    }),
  };
  const r = monthActual(conColchones, MES);
  assert.equal(r.savings, 50_000, 'solo la meta');
  assert.equal(r.cushion, 165_000, 'gatos y moto van aparte');

  const desvios = monthSummary(conColchones, MES).deviations;
  assert.equal(desvios.savings, 50_000 - 426_000, 'falta aportar a las otras metas');
  assert.equal(desvios.cushion, 165_000 - 465_000, 'falta el colchón de seguridad');
});

test('sacar plata del colchón de la moto para un arreglo deja el aporte en cero', () => {
  // Guardas 100.000 y en el mismo mes sale un arreglo de 100.000: el bucket
  // queda igual que empezó, y eso es exactamente para lo que estaba.
  const conArreglo = {
    ...estado,
    buckets: estado.buckets.map((b) => (b.id === 'b6'
      ? { ...b, contributions: [
          { id: 'c1', amount: 100_000, date: '2026-09-05' },
          { id: 'c2', amount: -100_000, date: '2026-09-18' },
        ] }
      : b)),
  };
  assert.equal(monthActual(conArreglo, MES).cushion, 0);
});

test('una fuente de ingreso inactiva no se cuenta en el plan', () => {
  const sinClub = {
    ...estado,
    incomeSources: estado.incomeSources.map((f) => (f.id === 'i2' ? { ...f, active: false } : f)),
  };
  assert.equal(monthPlan(sinClub, MES).income, 3_400_000, 'solo el salario');
  assert.equal(monthPlan(estado, MES).income, 3_600_000, 'sin la marca, sigue contando');
});

/* ---------------------------------------------------------- cuál deuda -- */

test('sin decir cuál, se ataca la deuda más cara y no la primera de la lista', () => {
  const varias = {
    ...estado,
    debts: [
      { id: 'barata', interestRate: 0.9, currentBalance: 20_000_000, fixedPayment: 300_000, payments: [] },
      { id: 'cara',   interestRate: 2.4, currentBalance: 3_000_000,  fixedPayment: 200_000, payments: [] },
      { id: 'media',  interestRate: 1.67, currentBalance: 14_000_000, fixedPayment: 446_413, payments: [] },
    ],
  };
  assert.equal(targetDebt(varias).id, 'cara', 'la tasa manda, no el saldo ni el orden');
  assert.equal(targetDebt(varias, 'media').id, 'media', 'y se puede decir explícitamente');
});

test('a igual tasa gana la más grande', () => {
  const empate = {
    ...estado,
    debts: [
      { id: 'chica', interestRate: 1.67, currentBalance: 2_000_000, fixedPayment: 100_000, payments: [] },
      { id: 'grande', interestRate: 1.67, currentBalance: 9_000_000, fixedPayment: 300_000, payments: [] },
    ],
  };
  assert.equal(targetDebt(empate).id, 'grande');
});

test('el simulador puede apuntar a una deuda concreta', () => {
  const dos = {
    ...estado,
    debts: [
      ...estado.debts,
      { id: 'otra', interestRate: 3, currentBalance: 1_000_000, fixedPayment: 100_000, payments: [] },
    ],
  };
  // Sin id agarraría la del 3%; con id se respeta la que se pide.
  assert.equal(simulatePlanChange(dos, {}, MES).debtId, 'otra', 'la más cara');
  assert.equal(simulatePlanChange(dos, {}, MES, 'd1').debtId, 'd1', 'la que se pidió');
});

test('sin deudas el simulador no inventa nada', () => {
  assert.equal(targetDebt({ debts: [] }), null);
  assert.equal(simulatePlanChange({ ...estado, debts: [] }, { cushion: -100_000 }, MES), null);
});

/* ------------------------------------------------- abonos sin enlazar --- */

/*
 * Al consolidar deudas se pagan varias de golpe, y esos pagos se anotan a mano
 * sin quedar enlazados a nada. Si cuentan como gasto variable, la app dice que
 * te desbordaste el mes en que ordenaste tus deudas.
 */
test('un abono anotado a mano cuenta como deuda, no como gasto variable', () => {
  const consolido = {
    ...estado,
    transactions: [
      { id: 'c1', type: 'gasto', amount: 1_000_000, category: 'deudas', date: '2026-09-01', note: 'Deuda Doña Natalia' },
      { id: 'c2', type: 'gasto', amount: 250_000, category: 'deudas', date: '2026-09-04', note: 'Abono Sofi' },
      { id: 'c3', type: 'gasto', amount: 47_300, category: 'alimentacion', date: '2026-09-30' },
    ],
  };
  const r = monthActual(consolido, MES);
  assert.equal(r.variable, 47_300, 'solo el granizado');
  assert.equal(r.debtPayment, 1_250_000, 'los dos abonos');
});

test('un abono enlazado no se cuenta dos veces', () => {
  const conAbono = {
    ...estado,
    debts: estado.debts.map((d) => ({
      ...d, payments: [{ id: 'pd1', amount: 446_413, date: '2026-09-10' }],
    })),
    transactions: [
      // El movimiento que deja la pantalla de deuda, enlazado a su abono.
      { id: 'mv1', type: 'gasto', amount: 446_413, category: 'deudas', date: '2026-09-10',
        debtId: 'd1', debtPaymentId: 'pd1' },
    ],
  };
  const r = monthActual(conAbono, MES);
  assert.equal(r.debtPayment, 446_413, 'una sola vez, no 892.826');
  assert.equal(r.variable, 0);
});

/* ------------------------------------ buckets compartidos y reservas --- */

/*
 * El colchón de los gatos son 130.000 al mes entre dos. Sale de tu cuenta la
 * mitad, pero el veterinario cobra del pote completo.
 */
const compartido = {
  ...estado,
  people: [...estado.people, { id: 'p6', name: 'Sofi' }],
  buckets: [
    { id: 'gatos', name: 'Colchón gatos', kind: 'colchon', liquid: true,
      monthlyAmount: 130_000, movesCash: true,
      shares: [{ id: 's-gatos', personId: 'p6', amount: 65_000 }], contributions: [] },
    { id: 'fondo', name: 'Fondo Sofi', kind: 'meta', liquid: true,
      monthlyAmount: 600_000, movesCash: true,
      shares: [{ id: 's-fondo', personId: 'p6', amount: 300_000 }], contributions: [] },
    { id: 'gasolina', name: 'Gasolina', kind: 'colchon', liquid: true,
      monthlyAmount: 160_000, movesCash: false, shares: [], contributions: [] },
  ],
};

test('de un bucket compartido, el plan solo cuenta tu parte', () => {
  const p = monthPlan(compartido, MES);
  assert.equal(p.cushion, 65_000 + 160_000, 'la mitad de los gatos, y la gasolina entera');
  assert.equal(p.savings, 300_000, 'la mitad del fondo con Sofi');
});

test('una reserva resta en el plan igual que un colchón', () => {
  // No mueve plata, pero es cupo que no está disponible: resta igual.
  const sinGasolina = {
    ...compartido,
    buckets: compartido.buckets.filter((b) => b.id !== 'gasolina'),
  };
  assert.equal(
    monthPlan(compartido, MES).cushion - monthPlan(sinGasolina, MES).cushion,
    160_000,
  );
});

test('un aporte al pote cuenta solo por tu fracción', () => {
  const conAporte = {
    ...compartido,
    buckets: compartido.buckets.map((b) => (b.id === 'gatos'
      ? { ...b, contributions: [{ id: 'a1', amount: 130_000, date: '2026-09-05' }] }
      : b)),
  };
  // Al pote entraron 130.000, pero de tu cuenta salieron 65.000.
  assert.equal(monthActual(conAporte, MES).cushion, 65_000);
});

test('una reserva se mide por lo gastado, no por lo aportado', () => {
  const tanqueadas = {
    ...compartido,
    transactions: [
      { id: 'g1', type: 'gasto', amount: 60_000, category: 'transporte', date: '2026-09-04', bucketId: 'gasolina' },
      { id: 'g2', type: 'gasto', amount: 58_000, category: 'transporte', date: '2026-09-18', bucketId: 'gasolina' },
    ],
  };
  const r = monthActual(tanqueadas, MES);
  assert.equal(r.cushion, 118_000, 'llevas 118.000 de los 160.000');
  assert.equal(r.variable, 0, 'tanquear no es gasto variable: sale de su reserva');
});

test('un colchón real no cuenta doble el aporte y el gasto', () => {
  // La plata se movió al aportar. Gastarla después no vuelve a salir de la
  // cuenta, así que el gasto etiquetado no suma otra vez.
  const gatosConVet = {
    ...compartido,
    buckets: compartido.buckets.map((b) => (b.id === 'gatos'
      ? { ...b, contributions: [{ id: 'a1', amount: 130_000, date: '2026-09-05' }] }
      : b)),
    transactions: [
      { id: 'vet', type: 'gasto', amount: 200_000, category: 'salud', date: '2026-09-12', bucketId: 'gatos' },
    ],
  };
  assert.equal(monthActual(gatosConVet, MES).cushion, 65_000, 'solo el aporte');
});

test('sin reparto, todo el bucket es tuyo', () => {
  const solo = {
    ...estado,
    buckets: [{ id: 'x', name: 'Mio', kind: 'colchon', liquid: true, monthlyAmount: 100_000,
                movesCash: true, shares: [], contributions: [] }],
  };
  assert.equal(monthPlan(solo, MES).cushion, 100_000);
});

/* ------------------------------------------------ cuándo empieza a cobrar --- */

/*
 * El crédito de Camilo se desembolsó el 8 de septiembre y la primera cuota es
 * la de octubre. El plan de septiembre le restaba igual los 446.413: un mes
 * que el banco nunca cobró.
 */
const desembolsadoEnSeptiembre = {
  ...estado,
  debts: estado.debts.map((d) => ({ ...d, startDate: '2026-09-08' })),
  /* Los dos meses con el mismo estimado, para que la única diferencia sea la cuota. */
  monthlyPlans: [
    { month: '2026-09', variableEstimate: 830_000 },
    { month: '2026-10', variableEstimate: 830_000 },
  ],
};

test('la primera cuota es la del mes siguiente al desembolso', () => {
  assert.equal(firstInstallmentMonth({ startDate: '2026-09-08' }), '2026-10');
  assert.equal(firstInstallmentMonth({ startDate: '2026-12-20' }), '2027-01', 'y cruza el año');
});

test('el mes del desembolso no lleva cuota; el siguiente sí', () => {
  assert.equal(monthPlan(desembolsadoEnSeptiembre, '2026-09').debtPayment, 0);
  assert.equal(monthPlan(desembolsadoEnSeptiembre, '2026-10').debtPayment, 446_413);
});

test('no cobrar la cuota que no existe deja más disponible, no menos', () => {
  const sept = monthPlan(desembolsadoEnSeptiembre, '2026-09');
  const oct = monthPlan(desembolsadoEnSeptiembre, '2026-10');
  assert.equal(sept.availableForExtra - oct.availableForExtra, 446_413);
});

test('una deuda sin fecha de desembolso se sigue cobrando', () => {
  // Es la lectura segura: una deuda vieja sin fecha registrada sí tiene cuota.
  assert.equal(firstInstallmentMonth({ id: 'x' }), null);
  assert.equal(monthPlan(estado, '2026-09').debtPayment, 446_413);
});

test('una deuda ya pagada deja de restar del plan', () => {
  const saldada = { ...estado, debts: estado.debts.map((d) => ({ ...d, currentBalance: 0 })) };
  assert.equal(debtDueIn({ currentBalance: 0, startDate: '2020-01-01' }, '2026-09'), false);
  assert.equal(monthPlan(saldada, '2026-09').debtPayment, 0);
});

test('un saldo sin reportar no se lee como deuda pagada', () => {
  // currentBalance null es "el banco no me lo ha dicho", no "ya no debo nada".
  assert.equal(debtDueIn({ currentBalance: null, fixedPayment: 100 }, '2026-09'), true);
  assert.equal(debtDueIn({ fixedPayment: 100 }, '2026-09'), true);
});
