import { monthKeyFromDate, todayStr } from './dates.js';

/*
 * Cómo se ha movido tu plata, movimiento a movimiento.
 *
 * Las otras gráficas resumen por mes: sirven para comparar, no para ver el
 * pulso. Esta acumula evento por evento —sube con cada ingreso, baja con cada
 * gasto, aporte a un bucket o abono a la deuda— y deja ver la forma del mes:
 * el escalón de la quincena, la caída del arriendo, la meseta de la última
 * semana cuando ya no queda nada.
 *
 * Con un ancla es el saldo de verdad; sin ella es una curva de VARIACIÓN que
 * arranca en cero. El ancla es una sola frase —"el 9 de septiembre cerré en
 * $0"— y a partir de ahí la línea deja de decir "cuánto te moviste" y pasa a
 * decir "cuánto tienes", que es la pregunta que uno de verdad se hace.
 */

const num = (v) => Number(v) || 0;

/*
 * El punto conocido del que arranca el saldo: una fecha y el saldo con el que
 * cerró ese día.
 *
 * Hace falta porque la app no nació con tu cuenta: los movimientos empiezan el
 * día que la instalaste, y sumarlos desde cero da la variación desde entonces,
 * no lo que hay en el banco. Con el ancla, todo lo anterior a esa fecha queda
 * absorbido en un solo número y ya no hay que reconstruir la historia para que
 * el saldo cuadre.
 *
 * Un ancla en cero es un ancla válida: "hoy no tengo nada" es un dato, no la
 * ausencia de uno. Por eso se pregunta por la fecha, no por el monto.
 */
export function balanceAnchors(estado) {
  const lista = (estado && estado.balanceAnchors)
    || (estado && estado.balanceAnchor ? [estado.balanceAnchor] : []);
  return lista
    .filter((a) => a && a.date)
    .map((a) => ({ date: String(a.date).slice(0, 10), amount: num(a.amount) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* El ajuste más reciente, que es el que manda sobre el saldo de hoy. */
export function balanceAnchor(estado) {
  const lista = balanceAnchors(estado);
  return lista.length ? lista[lista.length - 1] : null;
}

/*
 * Todo lo que mueve plata, en una sola lista.
 *
 * Un abono registrado desde la pantalla de deuda deja DOS rastros: la fila en
 * `payments` y un movimiento enlazado por debtPaymentId. Se cuenta el
 * movimiento y se descarta la fila, o la gráfica bajaría el doble.
 */
export function cashEvents(estado) {
  const eventos = [];

  const abonosYaEnMovimientos = new Set(
    (estado.transactions || []).map((t) => t.debtPaymentId).filter(Boolean),
  );

  (estado.transactions || []).forEach((t) => {
    const monto = num(t.amount);
    if (monto === 0) return;
    eventos.push({
      date: t.date,
      delta: t.type === 'ingreso' ? monto : -monto,
      kind: t.type === 'ingreso' ? 'ingreso' : 'gasto',
      label: t.note || '',
    });
  });

  /*
   * Una cuenta dividida sale completa de tu cuenta —pagaste tú— y lo de cada
   * amigo vuelve a entrar el día en que te lo transfiere. Mientras no te
   * pague, no entra nada: esa plata está en la calle, no en el banco.
   */
  /*
   * Desde que marcar "ya me pagó" crea su propio ingreso, ese movimiento es
   * el que sube la línea. Este camino queda solo para lo cobrado antes de
   * eso, que no tiene movimiento: sin él, esos pagos desaparecerían del saldo.
   */
  const ids = new Set((estado.transactions || []).map((t) => t.id));
  (estado.transactions || []).forEach((t) => {
    (t.shares || []).forEach((r) => {
      const monto = num(r.amount);
      if (!r.collectedAt || monto === 0) return;
      if (ids.has(`reintegro-${r.id}`)) return;
      eventos.push({
        date: r.collectedAt, delta: monto, kind: 'reintegro',
        label: t.note ? `Te pagaron: ${t.note}` : 'Te pagaron tu parte',
      });
    });
  });

  /*
   * Aportar a un bucket sí saca la plata de la cuenta, aunque siga siendo tuya:
   * dejarlo fuera haría ver el mes más holgado de lo que fue. Un retiro entra
   * con signo contrario porque el aporte viene en negativo.
   */
  (estado.buckets || []).forEach((b) => {
    (b.contributions || []).forEach((c) => {
      const monto = num(c.amount);
      if (monto === 0) return;
      eventos.push({ date: c.date, delta: -monto, kind: 'bucket', label: b.name });
    });
  });

  (estado.debts || []).forEach((d) => {
    (d.payments || []).forEach((p) => {
      if (abonosYaEnMovimientos.has(p.id)) return;
      const monto = num(p.amount);
      if (monto === 0) return;
      eventos.push({ date: p.date, delta: -monto, kind: 'deuda', label: d.name });
    });
  });

  return eventos
    .filter((e) => e.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/*
 * La curva acumulada. `months` son las claves 'YYYY-MM' que se quieren ver;
 * lo anterior a la ventana no se dibuja pero sí cuenta, para que la línea no
 * arranque en un escalón falso.
 */
export function buildCashFlow(estado, months) {
  const ventana = new Set(months || []);
  const anclas = balanceAnchors(estado);
  const eventos = cashEvents(estado);

  /*
   * Por tramos, no desde un solo punto.
   *
   * Con un ancla sola, cuadrar con el banco reiniciaba la gráfica: lo de antes
   * del ajuste desaparecía y la línea arrancaba de nuevo desde ese día. Se
   * perdía la historia justo cuando más sentido tenía mirarla.
   *
   * Ahora cada ajuste vale desde su día hasta el siguiente. Se lleva la suma
   * cruda de todo lo registrado, y a cada tramo se le suma la diferencia entre
   * lo que dijo el banco y lo que decía esa suma. En el día de un ajuste la
   * línea pega el brinco, y ese brinco es justo lo que no habías registrado.
   *
   * Lo anterior al primer ajuste se reconstruye hacia atrás desde él. Un ajuste
   * es el saldo con el que CERRÓ el día, así que lo de ese día ya viene adentro.
   */
  const deltaPorDia = new Map();
  const ultimoDelDia = new Map();
  eventos.forEach((e) => {
    deltaPorDia.set(e.date, (deltaPorDia.get(e.date) || 0) + e.delta);
    ultimoDelDia.set(e.date, e);
  });
  const anclaPorDia = new Map(anclas.map((a) => [a.date, a]));
  const fechas = [...new Set([...deltaPorDia.keys(), ...anclaPorDia.keys()])].sort();

  /* La suma cruda al cierre de cada día, para sacar el desfase de cada ajuste. */
  let crudo = 0;
  const crudoAl = new Map();
  fechas.forEach((d) => { crudo += deltaPorDia.get(d) || 0; crudoAl.set(d, crudo); });
  const desfases = anclas.map((a) => ({ date: a.date, valor: a.amount - crudoAl.get(a.date) }));

  /* El desfase que manda en una fecha: el del último ajuste hasta ese día. */
  const desfaseEn = (d) => {
    if (desfases.length === 0) return 0;
    let actual = desfases[0].valor;
    desfases.forEach((x) => { if (x.date <= d) actual = x.valor; });
    return actual;
  };

  let desfasePrevio = desfases.length ? desfases[0].valor : 0;
  const puntos = [];

  fechas.forEach((d) => {
    const ancla = anclaPorDia.get(d);
    const desfase = desfaseEn(d);
    const saldo = crudoAl.get(d) + desfase;
    /* Cuánto corrigió el banco lo que tenías registrado. El primero no corrige nada. */
    const ajuste = ancla ? desfase - desfasePrevio : 0;
    desfasePrevio = desfase;

    if (ventana.size > 0 && !ventana.has(monthKeyFromDate(d))) return;
    const ev = ultimoDelDia.get(d);
    puntos.push({
      date: d,
      saldo,
      delta: deltaPorDia.get(d) || 0,
      kind: ancla ? 'ancla' : ev.kind,
      label: ancla ? 'Cuadraste con el banco' : ev.label,
      ajuste: Math.round(ajuste),
    });
  });

  return puntos;
}

/*
 * El saldo a día de hoy: el ancla más todo lo que se movió después.
 *
 * Sin ancla no se devuelve cero, se devuelve null. Cero es una respuesta —"no
 * tienes nada"— y darla cuando lo que pasa es que nadie ha dicho de cuánto
 * parte sería mentir con una cifra en vez de admitir que falta el dato.
 */
export function currentBalance(estado, hasta) {
  const ancla = balanceAnchor(estado);
  if (!ancla) return null;
  const tope = hasta || todayStr();
  return cashEvents(estado)
    .filter((e) => e.date > ancla.date && e.date <= tope)
    .reduce((s, e) => s + e.delta, ancla.amount);
}

/*
 * Los rangos del pulso, como la gráfica del dólar en Google: semana, mes, tres
 * meses, año, todo. Los días son hacia atrás desde hoy, no meses calendario:
 * "el último mes" el 3 de octubre incluye septiembre casi entero, que es lo
 * que uno espera ver.
 */
export const RANGOS = [
  { id: '1S', label: '1S', dias: 7 },
  { id: '1M', label: '1M', dias: 30 },
  { id: '3M', label: '3M', dias: 90 },
  { id: '1A', label: '1A', dias: 365 },
  { id: 'todo', label: 'Todo', dias: null },
];

const restarDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/*
 * Recorta la curva a un rango y dice cuánto cambió en él.
 *
 * Dos detalles que hacen que se lea como la del dólar y no como un recorte:
 *
 *   La línea arranca en el borde izquierdo con el saldo que traías, aunque ese
 *   día no haya pasado nada. Sin ese punto, la semana empezaría en el primer
 *   movimiento y el cambio se mediría desde ahí, no desde el inicio del rango.
 *
 *   Y llega hasta hoy con el último saldo, para que la línea no se corte en el
 *   último gasto y parezca que la historia termina ahí.
 */
export function pulseRange(puntos, rangoId, hoy = todayStr()) {
  const rango = RANGOS.find((r) => r.id === rangoId) || RANGOS[1];
  const todos = (puntos || []).filter((p) => p.date <= hoy);
  if (todos.length === 0) return { puntos: [], cambio: 0, pct: null, desde: null, base: null };

  const desde = rango.dias === null ? todos[0].date : restarDias(hoy, rango.dias);
  const previos = todos.filter((p) => p.date < desde);
  const adentro = todos.filter((p) => p.date >= desde);
  const traido = previos.length ? previos[previos.length - 1].saldo : null;

  const out = [];
  if (traido !== null && (!adentro.length || adentro[0].date !== desde)) {
    out.push({ date: desde, saldo: traido, delta: 0, kind: 'borde', label: '', ajuste: 0 });
  }
  out.push(...adentro);
  const ultimo = out.length ? out[out.length - 1] : previos[previos.length - 1];
  if (ultimo && ultimo.date !== hoy) {
    out.push({ date: hoy, saldo: ultimo.saldo, delta: 0, kind: 'hoy', label: 'Hoy', ajuste: 0 });
  }

  const base = out[0].saldo;
  const cambio = out[out.length - 1].saldo - base;
  return {
    puntos: out,
    cambio,
    /* Sin porcentaje si se parte de cero o de rojo: "subió 300%" desde 0 no dice nada. */
    pct: base > 0 ? cambio / base : null,
    desde: out[0].date,
    base,
  };
}

/*
 * El ajuste que hay que guardar cuando el banco dice "tienes X" hoy.
 *
 * Un ajuste es el saldo con el que CERRÓ un día, así que guardarlo con la
 * fecha de hoy congelaba el resto del día: todo lo que registraras después
 * con fecha de hoy quedaba "absorbido" dentro del ajuste y la línea ya no se
 * movía. Parecía que la gráfica se había bloqueado.
 *
 * Se guarda entonces como el cierre de AYER: lo que dice el banco menos lo que
 * ya tenías registrado hoy. Lo de hoy que ya estaba sigue contando, y lo que
 * registres después también.
 */
export function anchorFromBank(estado, monto, hoy = todayStr()) {
  const ayer = restarDias(hoy, 1);
  const deHoy = cashEvents(estado)
    .filter((e) => e.date === hoy)
    .reduce((s, e) => s + e.delta, 0);
  return { date: ayer, amount: Number(monto) - deHoy };
}
