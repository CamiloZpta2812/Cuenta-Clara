import { daysInMonth, addMonths } from './dates.js';
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
 * La fecha en que cae un día del mes dentro de un tramo, o null si no cae.
 *
 * Un tramo puede cruzar de mes, así que el día 3 puede pertenecer al tramo que
 * arrancó el 30 del mes pasado. Se prueban las dos posibilidades y se toma la
 * que caiga dentro.
 */
function fechaEnTramo(p, dia, month) {
  if (!dia) return null;
  const candidatos = [
    fechaEn(addMonths(month, -1), dia),
    fechaEn(month, dia),
    fechaEn(addMonths(month, 1), dia),
  ];
  return candidatos.find((f) => f >= p.start && f < p.endExclusive) || null;
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

  const eventos = monthEvents(estado, month);
  const porDia = vidaDiaria(estado, month);
  const ubicados = new Set();

  const periodos = tramos.map((p) => {
    const dias = largo(p);
    const items = [];

    eventos.forEach((e) => {
      const fecha = fechaEnTramo(p, e.day, month);
      if (!fecha) return;
      ubicados.add(e);
      items.push({ ...e, date: fecha });
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

  return {
    periods: periodos,
    unscheduled: eventos.filter((e) => !ubicados.has(e)),
    daily: porDia,
  };
}
