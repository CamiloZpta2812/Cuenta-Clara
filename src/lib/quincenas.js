import { daysInMonth, addMonths, todayStr } from './dates.js';
import { myShare, myBucketShare, plannedBucketShare, debtDueIn } from './month.js';

/*
 * El mes partido en quincenas, con lo que entra y lo que sale en cada una.
 *
 * El resto de la app juzga el mes como una unidad: entra tanto, sale tanto,
 * sobra tanto. Eso sirve para saber si el mes cierra y no sirve para vivirlo.
 * Un mes puede cuadrar perfecto y dejarte sin plata el día 9, porque el sueldo
 * llega en dos pedazos y los gastos no se reparten parejo entre ellos.
 *
 * Una quincena no es "del 1 al 15". Es el tiempo entre un pago y el siguiente:
 * la plata que te cae el 30 tiene que aguantar hasta el 15, y por eso paga los
 * gastos del 1 al 14 aunque sean de otro mes. Verlo así es lo que hace obvio
 * dónde está apretado — y verlo por mes calendario es lo que lo esconde.
 *
 * Todo es puro: recibe el estado, devuelve números. Ver quincenas.test.js.
 */

const num = (v) => Number(v) || 0;
const iso = (y, mes, d) => `${y}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/* El día `dia` del mes 'YYYY-MM', recortado si el mes es más corto. */
function fechaEn(month, dia) {
  const [y, mes] = month.split('-').map(Number);
  return iso(y, mes, Math.min(dia, daysInMonth(y, mes - 1)));
}

/*
 * Los días que abren quincena.
 *
 * No hay que configurar las quincenas aparte: una quincena es el tiempo entre
 * dos sueldos, así que las fronteras ya están dichas en cuándo te pagan.
 *
 * Pero no todo ingreso abre una: el Club Aletas son 200.000 que caen el 5, y
 * tomarlo como frontera partía el mes en tres pedazos que no corresponden a
 * nada —el arriendo del 1 en un tramo, la cuota del 8 en otro— escondiendo
 * justo la concentración que esta pantalla existe para mostrar. Un ingreso
 * chico cae DENTRO de una quincena, no la abre.
 *
 * Si nadie ha marcado ninguna, se usan todos los días de ingreso: más vale un
 * calendario aproximado que una pantalla vacía mientras se configura.
 */
export function paydays(estado) {
  const activas = (estado.incomeSources || []).filter((f) => f.active !== false && f.day);
  const marcadas = activas.filter((f) => f.startsPeriod);
  const dias = (marcadas.length > 0 ? marcadas : activas).map((f) => num(f.day));
  return [...new Set(dias)].sort((a, b) => a - b);
}

/*
 * Las quincenas que tocan `month`, cada una de un sueldo al siguiente.
 *
 * Se incluye la que arrancó a fin del mes pasado, porque es la que paga los
 * primeros días de este: sin ella, los días 1 al 14 no aparecerían en ninguna
 * parte y la primera semana —la cara— quedaría fuera de la pantalla.
 *
 * Y la última se estira hasta el mes entrante en vez de cortarse el 31, por lo
 * mismo al revés: cortada mostraría una quincena que recibe plata y no gasta
 * nada, que es la manera más fácil de creerse rico.
 */
export function periods(estado, month) {
  const dias = paydays(estado);
  if (dias.length === 0) return [];

  const arranques = [
    { month: addMonths(month, -1), day: dias[dias.length - 1], fromPrevious: true },
    ...dias.map((d) => ({ month, day: d, fromPrevious: false })),
  ];

  return arranques.map((a, i) => {
    const sig = arranques[i + 1] || { month: addMonths(month, 1), day: dias[0] };
    return {
      startDay: a.day,
      fromPreviousMonth: a.fromPrevious,
      start: fechaEn(a.month, a.day),
      endExclusive: fechaEn(sig.month, sig.day),
    };
  });
}

/* Cuántos días cubre el tramo, para prorratear lo que no tiene fecha propia. */
function largo(p) {
  const a = new Date(`${p.start}T12:00:00`);
  const b = new Date(`${p.endExclusive}T12:00:00`);
  return Math.max(1, Math.round((b - a) / 86400000));
}

/*
 * Los meses que toca un tramo. Casi siempre dos, porque un tramo cruza de mes
 * por definición: el sueldo del 30 paga hasta el 15 del siguiente.
 *
 * Importa más de lo que parece. Lo que se mueve en un mes no es lo mismo que
 * en otro —una deuda desembolsada en septiembre no cobra cuota hasta octubre,
 * un colchón puede estar ajustado solo para este mes— así que cada ocurrencia
 * hay que resolverla contra SU mes, no contra el que esté seleccionado en la
 * pantalla. Incluir el mes de la fecha de corte de más es inofensivo: nada que
 * caiga ahí pasa el filtro del rango.
 */
function mesesDe(p) {
  return [...new Set([p.start.slice(0, 7), p.endExclusive.slice(0, 7)])];
}

/*
 * Todo lo que se mueve en un mes, con su fecha si la tiene.
 *
 * Los montos son SIEMPRE tu parte: de un gasto fijo compartido, lo que pones
 * tú; de un pote común, tu mitad. Es la plata que sale de tu cuenta, que es la
 * única que importa para saber si la quincena aguanta.
 */
export function monthEvents(estado, month) {
  const eventos = [];

  (estado.incomeSources || [])
    .filter((f) => f.active !== false && num(f.expected) > 0)
    .forEach((f) => eventos.push({
      kind: 'ingreso', id: f.id, name: f.name, amount: num(f.expected), day: num(f.day) || null,
    }));

  (estado.fixedExpenses || []).forEach((f) => {
    const monto = myShare(f);
    if (monto <= 0) return;
    eventos.push({
      kind: 'fijo', id: f.id, name: f.name, amount: -monto, day: num(f.dueDay) || null,
    });
  });

  (estado.debts || []).filter((d) => debtDueIn(d, month)).forEach((d) => {
    const monto = num(d.fixedPayment);
    if (monto <= 0) return;
    eventos.push({
      kind: 'deuda', id: d.id, name: `Cuota ${d.name}`, amount: -monto, day: num(d.dueDay) || null,
    });
  });

  /*
   * Una reserva no se aparta, se va gastando, así que no es un evento con
   * fecha: entra en el prorrateo de la vida diaria junto con el variable.
   */
  (estado.buckets || []).filter((b) => b.movesCash !== false).forEach((b) => {
    const monto = plannedBucketShare(estado, b, month);
    if (monto <= 0) return;
    eventos.push({
      kind: 'bucket', id: b.id, name: b.name, amount: -monto, day: num(b.depositDay) || null,
    });
  });

  return eventos;
}

/* Lo que se gasta día a día sin fecha fija: el variable estimado y las reservas. */
function vidaDiaria(estado, month) {
  const plan = (estado.monthlyPlans || []).find((p) => p.month === month);
  const variable = num(plan && plan.variableEstimate);
  const reservas = (estado.buckets || [])
    .filter((b) => b.movesCash === false)
    .reduce((s, b) => s + myBucketShare(b), 0);
  const [y, mes] = month.split('-').map(Number);
  return (variable + reservas) / daysInMonth(y, mes - 1);
}

/*
 * El calendario completo: cada quincena con lo que entra, lo que sale y lo que
 * queda, más lo que no se pudo ubicar por no tener fecha.
 *
 * Lo sin fecha se muestra aparte en vez de repartirse a ojo. Un gasto puesto
 * en la quincena equivocada haría ver holgada la que no lo es, que es
 * exactamente el error que esta pantalla existe para no cometer.
 */
export function buildQuincenas(estado, month) {
  const tramos = periods(estado, month);
  if (tramos.length === 0) return { periods: [], unscheduled: [], daily: 0 };

  const porDia = vidaDiaria(estado, month);

  const periodos = tramos.map((p) => {
    const dias = largo(p);
    const items = [];

    /*
     * Cada mes que toca el tramo se resuelve por separado. Antes se resolvía
     * una sola vez contra el mes seleccionado, y por eso la cuota del crédito
     * desaparecía del calendario de septiembre: el crédito se desembolsó el 8
     * de septiembre, no cobra cuota hasta octubre, y el tramo que va del 30 de
     * septiembre al 15 de octubre —que sí la incluye— se quedaba sin ella. Se
     * perdía justo la salida más grande del mes.
     */
    mesesDe(p).forEach((mes) => {
      monthEvents(estado, mes).forEach((e) => {
        if (!e.day) return;
        const fecha = fechaEn(mes, e.day);
        if (fecha < p.start || fecha >= p.endExclusive) return;
        items.push({ ...e, date: fecha });
      });
    });

    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const income = items.filter((i) => i.amount > 0).reduce((s, i) => s + i.amount, 0);
    const outflow = items.filter((i) => i.amount < 0).reduce((s, i) => s + i.amount, 0);
    const vida = porDia * dias;

    return {
      ...p,
      days: dias,
      items,
      income,
      outflow: -outflow,
      living: vida,
      leftover: income + outflow - vida,
    };
  });

  /*
   * Lo que no se pudo ubicar, de TODOS los meses que tocan los tramos.
   *
   * Antes se buscaba solo en el mes seleccionado, y ahí se abría un hueco por
   * el que se cayó justo la cuota del crédito: en septiembre no hay cuota
   * —la primera es de octubre— así que no salía en "sin fecha"; y como no
   * tenía día de cobro, tampoco caía en ningún tramo. Invisible en las dos
   * listas a la vez, que es la peor forma de faltar: sin rastro de que falta.
   *
   * Se deduplica por id porque un gasto sin día es el mismo gasto en los tres
   * meses; listarlo tres veces sería ruido, no información.
   */
  const sueltos = new Map();
  tramos.flatMap(mesesDe).forEach((mes) => {
    monthEvents(estado, mes)
      .filter((e) => !e.day)
      .forEach((e) => { if (!sueltos.has(e.id)) sueltos.set(e.id, e); });
  });

  return {
    periods: periodos,
    unscheduled: [...sueltos.values()],
    daily: porDia,
  };
}

/*
 * El mes en cuadrícula, para verlo como calendario.
 *
 * Las tarjetas de arriba responden "¿cuál quincena va apretada?". Esta
 * responde otra que no se puede leer en una lista: "¿cómo se amontonan los
 * días?". Que el 89% de lo fijo caiga entre el 1 y el 7 es un hecho que en
 * columnas hay que deducir sumando, y en una cuadrícula se ve de un vistazo.
 *
 * Cada día sabe a qué quincena pertenece, y de ahí sale la banda de color: es
 * lo que hace visible que el sueldo del 30 paga hasta el 15, algo que el mes
 * calendario esconde por construcción.
 */
export function monthGrid(estado, month, hoy = todayStr()) {
  const { periods: tramos } = buildQuincenas(estado, month);
  const [y, mes] = month.split('-').map(Number);
  const total = daysInMonth(y, mes - 1);

  const porFecha = new Map();
  tramos.forEach((p, i) => p.items.forEach((it) => {
    if (!porFecha.has(it.date)) porFecha.set(it.date, { items: [], periodIndex: i });
    porFecha.get(it.date).items.push(it);
  }));

  /* A qué tramo pertenece un día, tenga movimientos o no. */
  const tramoDe = (fecha) => {
    const i = tramos.findIndex((p) => fecha >= p.start && fecha < p.endExclusive);
    return i === -1 ? null : i;
  };

  const dias = [];
  for (let d = 1; d <= total; d += 1) {
    const fecha = iso(y, mes, d);
    const info = porFecha.get(fecha);
    dias.push({
      date: fecha,
      day: d,
      items: info ? info.items : [],
      periodIndex: tramoDe(fecha),
      isToday: fecha === hoy,
      startsPeriod: tramos.some((p) => p.start === fecha),
    });
  }

  /*
   * Se rellena hasta cuadrar semanas de lunes a domingo. Los huecos van como
   * null y no como días del mes vecino: esos días pertenecen a otra
   * cuadrícula, y pintarlos invitaría a leerlos como parte de esta.
   */
  const primerDia = new Date(y, mes - 1, 1).getDay();
  const relleno = (primerDia + 6) % 7;
  const celdas = [...Array(relleno).fill(null), ...dias];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}
