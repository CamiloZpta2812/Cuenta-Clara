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
export function balanceAnchor(estado) {
  const a = estado && estado.balanceAnchor;
  if (!a || !a.date) return null;
  return { date: String(a.date).slice(0, 10), amount: num(a.amount) };
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
  const ancla = balanceAnchor(estado);

  /*
   * Lo anterior al ancla no se suma ni se dibuja: ya está contado dentro de
   * ella. Y lo del mismo día tampoco, porque el ancla es el saldo con el que
   * CERRÓ ese día — el que lees en el banco, que ya trae lo de hoy.
   */
  const eventos = cashEvents(estado).filter((e) => !ancla || e.date > ancla.date);

  let saldo = ancla ? ancla.amount : 0;
  const puntos = [];

  /*
   * Con ancla, la línea nace en ella: sin ese punto la gráfica arrancaría en el
   * primer movimiento posterior y el salto de la quincena parecería el saldo.
   */
  if (ancla && (ventana.size === 0 || ventana.has(monthKeyFromDate(ancla.date)))) {
    puntos.push({ date: ancla.date, saldo, delta: 0, kind: 'ancla', label: 'Saldo en cuenta' });
  }

  eventos.forEach((e) => {
    saldo += e.delta;
    if (ventana.size > 0 && !ventana.has(monthKeyFromDate(e.date))) return;
    puntos.push({ date: e.date, saldo, delta: e.delta, kind: e.kind, label: e.label });
  });

  /*
   * Varios movimientos del mismo día se colapsan en un punto: la gráfica es de
   * días, y dibujar cinco puntos sobre la misma vertical solo la ensucia. Se
   * conserva el último saldo del día, que es con el que te acuestas.
   */
  const porDia = new Map();
  puntos.forEach((p) => porDia.set(p.date, p));

  return [...porDia.values()];
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
