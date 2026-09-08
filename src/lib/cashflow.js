import { monthKeyFromDate } from './dates.js';

/*
 * Cómo se ha movido tu plata, movimiento a movimiento.
 *
 * Las otras gráficas resumen por mes: sirven para comparar, no para ver el
 * pulso. Esta acumula evento por evento —sube con cada ingreso, baja con cada
 * gasto, aporte a un bucket o abono a la deuda— y deja ver la forma del mes:
 * el escalón de la quincena, la caída del arriendo, la meseta de la última
 * semana cuando ya no queda nada.
 *
 * Es una curva de VARIACIÓN, no el saldo del banco: arranca en cero porque
 * todavía no hay un saldo inicial de dónde partir. Cuando lo haya, es sumarle
 * una constante y pasa a ser el saldo de verdad.
 */

const num = (v) => Number(v) || 0;

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
  const eventos = cashEvents(estado);

  let saldo = 0;
  const puntos = [];

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
