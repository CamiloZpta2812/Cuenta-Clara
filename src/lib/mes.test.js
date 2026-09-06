import test from 'node:test';
import assert from 'node:assert/strict';
import {
  miParte, parteExterna, cobrosDelMes, planDelMes, realDelMes,
  salidasDeCajaDelMes, resumenDelMes, simularCambioDePlan,
} from './mes.js';

/*
 * El estado real de Camilo, reorganizado según el modelo nuevo.
 *
 * La diferencia con su hoja: la cooperativa y los dos colchones salen de
 * "gastos fijos" y pasan a ser buckets. La prueba clave es que ese reacomodo
 * NO cambia el abono extra — solo lo hace legible.
 */
const estado = {
  fuentesIngreso: [
    { id: 'i1', nombre: 'Salario', montoEsperado: 3_400_000, variable: true },
    { id: 'i2', nombre: 'Club Aletas', montoEsperado: 200_000, variable: true },
  ],
  personas: [
    { id: 'p1', nombre: 'Juanjo', linkedUserId: null },
    { id: 'p2', nombre: 'Yeison', linkedUserId: null },
    { id: 'p3', nombre: 'Andy', linkedUserId: null },
    { id: 'p4', nombre: 'Paula', linkedUserId: null },
    { id: 'p5', nombre: 'Alex', linkedUserId: null },
  ],
  gastosFijos: [
    { id: 'f1', nombre: 'HBO Max', valorTotal: 12_450, reparto: [{ id: 's1', personaId: 'p1', monto: 4_150 }] },
    { id: 'f2', nombre: 'Spotify', valorTotal: 30_500, reparto: [
      { id: 's2', personaId: 'p2', monto: 6_100 }, { id: 's3', personaId: 'p3', monto: 6_100 },
      { id: 's4', personaId: 'p4', monto: 6_100 }, { id: 's5', personaId: 'p5', monto: 6_100 },
    ] },
    { id: 'f3', nombre: 'iCloud', valorTotal: 11_300, reparto: [] },
    { id: 'f4', nombre: 'Disney+', valorTotal: 12_000, reparto: [] },
    { id: 'f5', nombre: 'Plan Celular', valorTotal: 53_900, reparto: [] },
    { id: 'f6', nombre: 'Motilada', valorTotal: 40_000, reparto: [] },
    { id: 'f7', nombre: 'Aporte Casa', valorTotal: 300_000, reparto: [] },
    { id: 'f8', nombre: 'Gimnasio', valorTotal: 103_400, reparto: [] },
    { id: 'f9', nombre: 'Mantenimiento Moto', valorTotal: 100_000, reparto: [] },
    { id: 'f10', nombre: 'Gasolina', valorTotal: 160_000, reparto: [] },
  ],
  buckets: [
    { id: 'b1', nombre: 'Ahorro personal 1', tipo: 'meta', liquido: true, aporteMensual: 50_000 },
    { id: 'b2', nombre: 'Ahorro personal 2', tipo: 'meta', liquido: true, aporteMensual: 300_000 },
    { id: 'b3', nombre: 'Cooperativa', tipo: 'meta', liquido: false, aporteMensual: 76_000 },
    { id: 'b4', nombre: 'Colchón de gastos', tipo: 'colchon', liquido: true, aporteMensual: 65_000 },
    { id: 'b5', nombre: 'Colchón de seguridad', tipo: 'colchon', liquido: true, aporteMensual: 300_000 },
  ],
  deudas: [
    { id: 'd1', nombre: 'Libre inversión Bancolombia', saldoActual: 14_000_000,
      tasaMensual: 0.0167, cuotaFija: 446_413, modo: 'reducir-plazo' },
  ],
  plan: { variableEstimado: 830_000 },
  movimientos: [],
  pagosDeuda: [],
  aportes: [],
  cobros: [],
};

/* --------------------------------------------------- reparto de gastos --- */

test('mi parte de un gasto compartido es el total menos lo de los demás', () => {
  const spotify = estado.gastosFijos.find((g) => g.id === 'f2');
  assert.equal(miParte(spotify), 6_100);
  assert.equal(parteExterna(spotify), 24_400);
  const hbo = estado.gastosFijos.find((g) => g.id === 'f1');
  assert.equal(miParte(hbo), 8_300);
  assert.equal(parteExterna(hbo), 4_150);
});

test('mi parte se calcula, no se guarda: nunca puede descuadrar', () => {
  const g = { valorTotal: 30_500, reparto: [{ id: 'sx', personaId: 'x', monto: 10_000 }] };
  assert.equal(miParte(g) + parteExterna(g), g.valorTotal);
});

test('los gastos fijos de la hoja suman $936.000 de parte personal', () => {
  // 936.000 es el total de la hoja, que incluía cooperativa (76.000) y
  // colchón de gastos (65.000). Sin esos dos, los fijos "puros" son 795.000.
  const fijos = estado.gastosFijos.reduce((s, g) => s + miParte(g), 0);
  assert.equal(fijos, 795_000);
  assert.equal(fijos + 76_000 + 65_000, 936_000, 'cuadra con el total de la hoja');
});

test('lo por cobrar son $28.550, repartidos entre 5 personas', () => {
  const total = estado.gastosFijos.reduce((s, g) => s + parteExterna(g), 0);
  assert.equal(total, 28_550);
  const filas = cobrosDelMes(estado.gastosFijos, [], '2026-09');
  assert.equal(filas.length, 5);
  assert.ok(filas.every((f) => !f.cobrado), 'sin registro, nada está cobrado');
});

test('marcar un cobro solo afecta ese mes y esa persona', () => {
  const cobros = [{ mes: '2026-09', shareId: 's2' }];
  const sept = cobrosDelMes(estado.gastosFijos, cobros, '2026-09');
  assert.equal(sept.filter((c) => c.cobrado).length, 1);
  assert.equal(sept.find((c) => c.personaId === 'p2').cobrado, true);
  const oct = cobrosDelMes(estado.gastosFijos, cobros, '2026-10');
  assert.equal(oct.filter((c) => c.cobrado).length, 0, 'octubre arranca en cero');
});

/* --------------------------------------------------------------- plan --- */

test('el plan reproduce exactamente el abono extra de $737.587', () => {
  const p = planDelMes(estado);
  assert.equal(p.ingresos, 3_600_000);
  assert.equal(p.gastosFijos, 795_000);
  assert.equal(p.cuotaDeuda, 446_413);
  assert.equal(p.ahorro, 426_000, 'las tres metas, con cooperativa incluida');
  assert.equal(p.variable, 830_000);
  assert.equal(p.excedenteBruto, 1_102_587);
  assert.equal(p.colchon, 365_000, 'los dos colchones');
  assert.equal(p.disponibleParaAbono, 737_587);
});

test('reorganizar las categorías no cambia el resultado final', () => {
  // La hoja metía cooperativa y colchón de gastos dentro de "gastos fijos".
  // Este modelo los saca a buckets. El abono extra tiene que dar igual.
  const p = planDelMes(estado);
  const comoLaHoja = 3_600_000 - 936_000 - 446_413 - 350_000 - 830_000 - 300_000;
  assert.equal(p.disponibleParaAbono, comoLaHoja);
  assert.equal(comoLaHoja, 737_587);
});

test('el pago total mensual a la deuda son $1.184.000', () => {
  const p = planDelMes(estado);
  assert.equal(p.cuotaDeuda + p.disponibleParaAbono, 1_184_000);
});

test('el ahorro no líquido cuenta como ahorro pero se puede distinguir', () => {
  const noLiquido = estado.buckets.filter((b) => b.tipo === 'meta' && !b.liquido);
  assert.equal(noLiquido.length, 1);
  assert.equal(noLiquido[0].aporteMensual, 76_000);
  const liquido = estado.buckets
    .filter((b) => b.tipo === 'meta' && b.liquido)
    .reduce((s, b) => s + b.aporteMensual, 0);
  assert.equal(liquido, 350_000, 'lo que sí podrías tocar si hiciera falta');
});

/* --------------------------------------------------------------- real --- */

const conMovimientos = {
  ...estado,
  movimientos: [
    { id: 't1', tipo: 'ingreso', monto: 3_400_000, categoria: 'salario', fecha: '2026-09-30' },
    { id: 't2', tipo: 'ingreso', monto: 200_000, categoria: 'otros_ingreso', fecha: '2026-09-15' },
    { id: 't3', tipo: 'gasto', monto: 300_000, categoria: 'vivienda', fecha: '2026-09-01', gastoFijoId: 'f7', medioPago: 'debito' },
    { id: 't4', tipo: 'gasto', monto: 160_000, categoria: 'transporte', fecha: '2026-09-02', gastoFijoId: 'f10', medioPago: 'debito' },
    { id: 't5', tipo: 'gasto', monto: 420_000, categoria: 'alimentacion', fecha: '2026-09-10', medioPago: 'debito' },
    { id: 't6', tipo: 'gasto', monto: 180_000, categoria: 'entretenimiento', fecha: '2026-09-20',
      medioPago: 'credito', cardId: 'c1', fechaSalidaCaja: '2026-11-05' },
  ],
  pagosDeuda: [{ id: 'pd1', deudaId: 'd1', monto: 1_184_000, fecha: '2026-09-10' }],
  aportes: [{ id: 'ap1', bucketId: 'b1', monto: 50_000, fecha: '2026-09-05' }],
};

test('lo real se clasifica en las mismas líneas del plan', () => {
  const r = realDelMes(conMovimientos, '2026-09');
  assert.equal(r.ingresos, 3_600_000);
  assert.equal(r.gastosFijos, 460_000, 'solo los dos fijos registrados');
  assert.equal(r.cuotaDeuda, 1_184_000);
  assert.equal(r.ahorro, 50_000);
  assert.equal(r.variable, 600_000, 'los que no son fijo, ni deuda, ni ahorro');
});

test('una compra con tarjeta es gasto del mes de la compra', () => {
  const r = realDelMes(conMovimientos, '2026-09');
  assert.ok(r.variable >= 180_000, 'la compra de sept cuenta en sept, aunque se pague en nov');
  const nov = realDelMes(conMovimientos, '2026-11');
  assert.equal(nov.variable, 0, 'en noviembre no hay gasto nuevo, solo salida de caja');
});

test('la salida de caja sí ocurre en el mes en que se paga la tarjeta', () => {
  const sept = salidasDeCajaDelMes(conMovimientos, '2026-09');
  assert.equal(sept.conTarjeta, 0, 'en sept no salió plata por la tarjeta');
  assert.equal(sept.sinTarjeta, 880_000);

  const nov = salidasDeCajaDelMes(conMovimientos, '2026-11');
  assert.equal(nov.conTarjeta, 180_000, 'la plata sale cuando llega la factura');
  assert.equal(nov.total, 180_000);
});

test('gasto y salida de caja coinciden cuando pagas con débito', () => {
  const soloDebito = {
    movimientos: [{ id: 'x', tipo: 'gasto', monto: 50_000, categoria: 'alimentacion',
                    fecha: '2026-09-10', medioPago: 'debito' }],
  };
  assert.equal(realDelMes(soloDebito, '2026-09').variable, 50_000);
  assert.equal(salidasDeCajaDelMes(soloDebito, '2026-09').total, 50_000);
});

/* ------------------------------------------------------------ alertas --- */

test('avisa de los cobros pendientes con el costo anual', () => {
  const r = resumenDelMes(conMovimientos, '2026-09');
  const a = r.alertas.find((x) => x.tipo === 'cobro');
  assert.ok(a);
  assert.equal(a.monto, 28_550);
  assert.ok(a.detalle.includes('342.600'), 'lo que pesa es el año, no el mes');
});

test('no avisa de cobros si ya se cobraron todos', () => {
  const todoCobrado = {
    ...conMovimientos,
    cobros: ['s1', 's2', 's3', 's4', 's5'].map((shareId) => ({ mes: '2026-09', shareId })),
  };
  const r = resumenDelMes(todoCobrado, '2026-09');
  assert.equal(r.alertas.filter((a) => a.tipo === 'cobro').length, 0);
});

test('avisa si el gasto variable se pasa del estimado', () => {
  const pasado = {
    ...conMovimientos,
    movimientos: [...conMovimientos.movimientos,
      { id: 'cena', tipo: 'gasto', monto: 490_000, categoria: 'entretenimiento', fecha: '2026-09-22', medioPago: 'debito' }],
  };
  const r = resumenDelMes(pasado, '2026-09');
  const a = r.alertas.find((x) => x.tipo === 'variable');
  assert.ok(a, 'el gasto variable llegó a 1.090.000 contra 830.000 estimados');
  assert.equal(a.monto, 260_000);
  assert.equal(a.severidad, 'alerta', 'pasarse más del 20% no es un simple aviso');
});

test('no avisa si el gasto variable va por debajo del estimado', () => {
  const r = resumenDelMes(conMovimientos, '2026-09');
  assert.equal(r.alertas.filter((a) => a.tipo === 'variable').length, 0);
});

test('avisa si entró menos ingreso del planeado', () => {
  const menos = {
    ...conMovimientos,
    movimientos: conMovimientos.movimientos.filter((t) => t.id !== 't2'),
  };
  const r = resumenDelMes(menos, '2026-09');
  const a = r.alertas.find((x) => x.tipo === 'ingreso');
  assert.ok(a, 'faltó el Club Aletas');
  assert.equal(a.monto, 200_000);
});

/* -------------------------------------------------------------- desvíos -- */

test('el resumen señala en qué línea se desvió el mes', () => {
  const r = resumenDelMes(conMovimientos, '2026-09');
  assert.equal(r.desvios.ingresos, 0, 'entró lo planeado');
  assert.equal(r.desvios.variable, 600_000 - 830_000, 'va por debajo del estimado');
  assert.ok(r.desvios.gastosFijos < 0, 'faltan fijos por registrar en el mes');
});

test('un mes sin nada registrado no revienta', () => {
  const r = resumenDelMes(estado, '2026-09');
  assert.equal(r.real.ingresos, 0);
  assert.equal(r.real.variable, 0);
  assert.equal(r.plan.disponibleParaAbono, 737_587, 'el plan sigue en pie');
});

test('la app arranca sin datos sin romperse', () => {
  const r = resumenDelMes({}, '2026-09');
  assert.equal(r.plan.ingresos, 0);
  assert.equal(r.plan.disponibleParaAbono, 0);
  assert.deepEqual(r.cobros, []);
});


/* ------------------------------------------------------------ simulador -- */

test('bajar el colchón acorta la deuda, y dice en cuánto', () => {
  const r = simularCambioDePlan(estado, { colchon: -150_000 });
  assert.equal(r.abonoAntes, 737_587);
  assert.equal(r.abonoDespues, 887_587);
  assert.equal(r.antes.months, 14);
  assert.equal(r.despues.months, 12);
  assert.equal(r.mesesDiferencia, 2);
  assert.ok(r.interesDiferencia > 200_000, 'y se ahorra en intereses');
});

test('subir el colchón alarga la deuda, y también lo dice', () => {
  const r = simularCambioDePlan(estado, { colchon: 100_000 });
  assert.equal(r.abonoDespues, 637_587);
  assert.equal(r.mesesDiferencia, -1, 'un mes más');
  assert.ok(r.interesDiferencia < 0, 'y cuesta más intereses');
});

test('varios cambios a la vez se acumulan', () => {
  const r = simularCambioDePlan(estado, { colchon: -100_000, variable: -50_000 });
  assert.equal(r.abonoDespues, 737_587 + 150_000);
});

test('un gasto que se come el excedente deja el plan en déficit', () => {
  // Si los fijos suben 1,5 millones, el abono extra queda en negativo: no
  // alcanza ni para la cuota mínima. La app tiene que decirlo, no fingir
  // que simplemente "no abonas extra".
  const r = simularCambioDePlan(estado, { gastosFijos: 1_500_000 });
  assert.equal(r.deficit, true);
  assert.ok(r.abonoDespues < 0, `abono quedó en ${r.abonoDespues}`);
  assert.equal(r.dejaDeSerViable, true, 'con menos que la cuota, la deuda no se acaba');
  assert.equal(r.mesesDiferencia, null);
});

test('un plan holgado no se marca en déficit', () => {
  const r = simularCambioDePlan(estado, { colchon: -150_000 });
  assert.equal(r.deficit, false);
});

test('sin deudas no hay nada que simular', () => {
  assert.equal(simularCambioDePlan({ ...estado, deudas: [] }, { colchon: -100_000 }), null);
});
