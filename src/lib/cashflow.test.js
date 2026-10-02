import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cashEvents, buildCashFlow, balanceAnchor, currentBalance, pulseRange, anchorFromBank,
} from './cashflow.js';

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

/* ------------------------------------------------------------ el ancla -- */

const conAncla = {
  ...estado,
  balanceAnchor: { date: '2026-09-09', amount: 0 },
};

test('con ancla la línea deja de ser variación y pasa a ser el saldo', () => {
  const puntos = buildCashFlow(conAncla, ['2026-09']);
  const porFecha = Object.fromEntries(puntos.map((p) => [p.date, p.saldo]));

  assert.equal(porFecha['2026-09-09'], 0, 'el punto del ancla');
  assert.equal(porFecha['2026-09-10'], -446_413, 'la cuota deja la cuenta en rojo');
  assert.equal(porFecha['2026-09-15'], 1_253_587, 'la quincena levanta desde ahí');
  assert.equal(porFecha['2026-09-20'], 1_206_287);
  assert.equal(porFecha['2026-09-25'], 1_226_287);
});

test('lo anterior al primer ajuste se reconstruye hacia atrás, no se borra', () => {
  /*
   * Antes, cuadrar con el banco borraba lo anterior de la gráfica. Ahora se
   * reconstruye desde el ajuste: si el 9 cerraste en 0 y el 5 aportaste 65.000
   * al colchón, el 5 tenías 0 y el 1 tenías 65.000 — antes del arriendo.
   */
  const porFecha = Object.fromEntries(buildCashFlow(conAncla, ['2026-09']).map((p) => [p.date, p.saldo]));
  assert.equal(porFecha['2026-09-01'], 65_000);
  assert.equal(porFecha['2026-09-05'], 0);
  assert.equal(porFecha['2026-09-09'], 0, 'el día del ajuste vale lo que dijo el banco');
});

/* Un segundo ajuste, el 20: el banco dice 1.300.000 y lo registrado daba 1.206.287. */
const dosAjustes = {
  ...estado,
  balanceAnchors: [
    { id: 'a1', date: '2026-09-09', amount: 0 },
    { id: 'a2', date: '2026-09-20', amount: 1_300_000 },
  ],
};

test('el segundo ajuste pega el brinco sin borrar lo de antes', () => {
  const puntos = buildCashFlow(dosAjustes, ['2026-09']);
  const porFecha = Object.fromEntries(puntos.map((p) => [p.date, p]));
  assert.equal(porFecha['2026-09-15'].saldo, 1_253_587, 'lo de antes del ajuste sigue igual');
  assert.equal(porFecha['2026-09-20'].saldo, 1_300_000, 'el día del ajuste manda el banco');
  assert.equal(porFecha['2026-09-20'].ajuste, 93_713, 'y el brinco es lo que faltaba registrar');
  assert.equal(porFecha['2026-09-25'].saldo, 1_320_000, 'después sigue desde el ajuste');
});

test('el primer ajuste no cuenta como brinco', () => {
  // No hay nada antes contra qué corregir: es el punto de partida.
  const p = buildCashFlow(dosAjustes, ['2026-09']).find((x) => x.date === '2026-09-09');
  assert.equal(p.ajuste, 0);
});

test('el saldo de hoy sale del último ajuste', () => {
  assert.equal(currentBalance(dosAjustes, '2026-09-30'), 1_320_000);
});

test('el orden en que se guardaron los ajustes no importa', () => {
  const alReves = { ...dosAjustes, balanceAnchors: [...dosAjustes.balanceAnchors].reverse() };
  assert.deepEqual(buildCashFlow(alReves, ['2026-09']), buildCashFlow(dosAjustes, ['2026-09']));
});

test('lo que te paga un amigo de una cuenta dividida vuelve a entrar ese día', () => {
  /*
   * Pagaste 120.000 de la cena; Sofi te transfiere sus 40.000 dos días
   * después. Lo de Juanjo todavía no ha llegado, así que no entra nada.
   */
  const cena = {
    transactions: [{
      id: 'c', type: 'gasto', amount: 120_000, category: 'alimentacion', date: '2026-09-25',
      note: 'Cena',
      shares: [
        { id: 'r1', personId: 'sofi', amount: 40_000, collectedAt: '2026-09-27' },
        { id: 'r2', personId: 'juanjo', amount: 40_000, collectedAt: null },
      ],
    }],
    buckets: [], debts: [],
    balanceAnchors: [{ id: 'a', date: '2026-09-24', amount: 500_000 }],
  };
  assert.equal(currentBalance(cena, '2026-09-26'), 380_000, 'salió la cuenta completa');
  assert.equal(currentBalance(cena, '2026-09-28'), 420_000, 'y volvió lo de Sofi');
});

test('lo del mismo día del ancla ya viene contado en ella', () => {
  /*
   * El saldo que lees en el banco a las 6 de la tarde ya trae el almuerzo de
   * las 12. Volver a restarlo lo cobraría dos veces.
   */
  const mismoDia = {
    transactions: [{ id: 'x', type: 'gasto', amount: 30_000, category: 'alimentacion', date: '2026-09-09' }],
    buckets: [], debts: [],
    balanceAnchor: { date: '2026-09-09', amount: 500_000 },
  };
  assert.equal(currentBalance(mismoDia, '2026-09-30'), 500_000);
});

test('un ancla en cero es un ancla, no la falta de una', () => {
  assert.deepEqual(balanceAnchor(conAncla), { date: '2026-09-09', amount: 0 });
  assert.equal(currentBalance(conAncla, '2026-09-30'), 1_226_287);
});

test('sin ancla el saldo es null, no cero', () => {
  // Cero diría "no tienes nada"; lo cierto es que nadie ha dicho de cuánto parte.
  assert.equal(balanceAnchor(estado), null);
  assert.equal(currentBalance(estado, '2026-09-30'), null);
  assert.equal(currentBalance({}), null);
});

test('el saldo de hoy no cuenta lo que viene después', () => {
  assert.equal(currentBalance(conAncla, '2026-09-16'), 1_253_587, 'la quincena sí, el granizado no');
});

test('sin ancla la curva sigue arrancando en cero, como antes', () => {
  assert.equal(buildCashFlow(estado, ['2026-09'])[0].saldo, -300_000);
});

test('un aporte a un pote compartido baja el saldo por lo tuyo, no por el pote', () => {
  /*
   * Antes la curva restaba el monto guardado tal cual, y como ese monto era el
   * del pote, un aporte a los gatos bajaba el saldo el doble de lo que salió
   * de la cuenta. Ahora el aporte YA viene en plata tuya.
   */
  const conPote = {
    transactions: [],
    debts: [],
    buckets: [{ id: 'gatos', name: 'Colchón gatos', monthlyAmount: 130_000,
      shares: [{ id: 's', personId: 'p-sofi', amount: 65_000 }],
      contributions: [{ id: 'a1', amount: 65_000, date: '2026-09-15' }] }],
    balanceAnchor: { date: '2026-09-08', amount: 357_000 },
  };
  assert.equal(currentBalance(conPote, '2026-09-30'), 292_000);
});

/* ------------------------------------------------------- los rangos -- */

const curva = [
  { date: '2026-09-01', saldo: 100_000 },
  { date: '2026-09-20', saldo: 400_000 },
  { date: '2026-09-28', saldo: 300_000 },
];

test('la semana arranca en el borde con el saldo que traías', () => {
  const r = pulseRange(curva, '1S', '2026-09-30');
  assert.equal(r.puntos[0].date, '2026-09-23');
  assert.equal(r.puntos[0].saldo, 400_000, 'lo que había antes del rango');
  assert.equal(r.cambio, -100_000, 'se mide desde el borde, no desde el primer gasto');
  assert.equal(r.pct, -0.25);
});

test('la línea llega hasta hoy aunque hoy no haya pasado nada', () => {
  const r = pulseRange(curva, '1M', '2026-09-30');
  const ultimo = r.puntos[r.puntos.length - 1];
  assert.equal(ultimo.date, '2026-09-30');
  assert.equal(ultimo.saldo, 300_000);
});

test('todo arranca en el primer punto', () => {
  const r = pulseRange(curva, 'todo', '2026-09-30');
  assert.equal(r.desde, '2026-09-01');
  assert.equal(r.cambio, 200_000);
});

test('sin porcentaje cuando se parte de cero o de rojo', () => {
  const r = pulseRange([{ date: '2026-09-01', saldo: 0 }, { date: '2026-09-05', saldo: 50_000 }], 'todo', '2026-09-06');
  assert.equal(r.pct, null);
});

test('lo del futuro no se dibuja', () => {
  const r = pulseRange([...curva, { date: '2026-10-15', saldo: 2_000_000 }], 'todo', '2026-09-30');
  assert.ok(r.puntos.every((p) => p.date <= '2026-09-30'));
});

test('sin puntos no revienta', () => {
  assert.deepEqual(pulseRange([], '1M', '2026-09-30').puntos, []);
});

/* ------------------------------------------- cuadrar con el banco hoy -- */

test('cuadrar hoy no congela lo que registres después hoy', () => {
  /*
   * El bug que vio Camilo: cuadró con el banco y después registró un gasto de
   * hoy, y el saldo no se movió. El ajuste se guardaba como cierre de hoy y se
   * tragaba todo lo de hoy, incluso lo que venía después.
   */
  const antes = {
    transactions: [{ id: 'a', type: 'gasto', amount: 20_000, category: 'alimentacion', date: '2026-10-02' }],
    buckets: [], debts: [],
  };
  const ancla = anchorFromBank(antes, 500_000, '2026-10-02');
  assert.deepEqual(ancla, { date: '2026-10-01', amount: 520_000 }, 'ayer, sumándole lo que ya salió hoy');

  const conAncla = { ...antes, balanceAnchors: [{ id: 'x', ...ancla }] };
  assert.equal(currentBalance(conAncla, '2026-10-02'), 500_000, 'hoy da lo que dijo el banco');

  const despues = {
    ...conAncla,
    transactions: [...antes.transactions,
      { id: 'b', type: 'gasto', amount: 15_000, category: 'transporte', date: '2026-10-02' }],
  };
  assert.equal(currentBalance(despues, '2026-10-02'), 485_000, 'y lo que registras después sí baja');
});

test('un reintegro con su movimiento no sube el saldo dos veces', () => {
  const cena = {
    transactions: [
      { id: 'c', type: 'gasto', amount: 120_000, category: 'alimentacion', date: '2026-09-25',
        shares: [{ id: 'r1', personId: 'sofi', amount: 40_000, collectedAt: '2026-09-27' }] },
      { id: 'reintegro-r1', type: 'ingreso', amount: 40_000, category: 'reintegro', date: '2026-09-27' },
    ],
    buckets: [], debts: [],
    balanceAnchors: [{ id: 'a', date: '2026-09-24', amount: 500_000 }],
  };
  assert.equal(currentBalance(cena, '2026-09-28'), 420_000);
});
