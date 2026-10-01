import { monthKeyFromDate, daysInMonth, addMonths, todayStr } from './dates.js';
import { monthPlan, myTransactionShare } from './month.js';

/*
 * El análisis del mes: cómo vas, no cuánto te queda para la deuda.
 *
 * El mes vivía alrededor de un número —lo que puedes abonarle de más al
 * crédito— y eso respondía una pregunta que uno se hace una vez al mes. La que
 * se hace todos los días es otra: "¿voy bien o voy gastando de más?". Para
 * eso hace falta ver el RITMO, no el saldo final.
 *
 * Todo es puro: recibe el estado, devuelve números. Ver analisis.test.js.
 */

const num = (v) => Number(v) || 0;

/*
 * Si un gasto es variable: lo que no es un gasto fijo, ni un abono, ni plata
 * que va a un colchón. Es la única línea del mes que se decide en el día a
 * día, y por eso es la que tiene sentido seguirle el ritmo.
 */
export function isVariable(t) {
  return t.type === 'gasto' && !t.fixedExpenseId && !t.debtId && !t.bucketId
    && t.category !== 'deudas';
}

/* Qué día del mes es "hoy" para un mes dado: el último si ya pasó, 0 si no ha llegado. */
function diaDeHoy(month, hoy) {
  const mesHoy = monthKeyFromDate(hoy);
  const [y, m] = month.split('-').map(Number);
  const total = daysInMonth(y, m - 1);
  if (mesHoy > month) return total;
  if (mesHoy < month) return 0;
  return Number(hoy.slice(8, 10));
}

/*
 * El ritmo del gasto variable: lo que llevas, día a día, contra lo que
 * deberías llevar si gastaras parejo.
 *
 * "Parejo" es una línea recta del cero al estimado del mes. No es que haya que
 * gastar lo mismo todos los días —nadie lo hace—, pero es la referencia que
 * deja ver si vas adelante o atrás: ir por encima de la recta el día 10 es
 * llegar al 30 sin plata para comer.
 *
 * La proyección es lineal a propósito: "si sigues así". Es una advertencia, no
 * un pronóstico, y una fórmula más lista sería más difícil de creer.
 */
export function monthPace(estado, month, hoy = todayStr()) {
  const [y, m] = month.split('-').map(Number);
  const totalDias = daysInMonth(y, m - 1);
  const planMes = monthPlan(estado, month).variable;
  const hoyDia = diaDeHoy(month, hoy);

  const porDia = new Array(totalDias + 1).fill(0);
  (estado.transactions || [])
    .filter((t) => isVariable(t) && monthKeyFromDate(t.date) === month)
    .forEach((t) => {
      const d = Number(String(t.date).slice(8, 10));
      if (d >= 1 && d <= totalDias) porDia[d] += myTransactionShare(t);
    });

  let acumulado = 0;
  const dias = [];
  for (let d = 1; d <= totalDias; d += 1) {
    acumulado += porDia[d];
    dias.push({
      day: d,
      /* Del futuro no hay dato: dibujar ceros diría que no vas a gastar nada. */
      real: d <= hoyDia ? acumulado : null,
      plan: Math.round((planMes * d) / totalDias),
    });
  }

  const gastado = hoyDia > 0 ? dias[hoyDia - 1].real : 0;
  const deberias = hoyDia > 0 ? dias[hoyDia - 1].plan : 0;
  const proyeccion = hoyDia === 0 ? 0
    : hoyDia === totalDias ? gastado
      : Math.round((gastado / hoyDia) * totalDias);

  return {
    dias,
    totalDias,
    hoyDia,
    gastado,
    deberias,
    planMes,
    proyeccion,
    /* Positivo = vas por encima del ritmo. */
    adelanto: gastado - deberias,
    cerrado: hoyDia === totalDias,
  };
}

/*
 * En qué se fue el variable, por categoría, con el mes anterior al lado.
 *
 * El número solo no dice nada: "180.000 en comida" es mucho o poco según lo
 * que gastaste el mes pasado. La comparación es lo que lo vuelve una decisión.
 */
export function variableByCategory(estado, month) {
  const previo = addMonths(month, -1);
  const suma = (mes) => {
    const out = {};
    (estado.transactions || [])
      .filter((t) => isVariable(t) && monthKeyFromDate(t.date) === mes)
      .forEach((t) => { out[t.category] = (out[t.category] || 0) + myTransactionShare(t); });
    return out;
  };
  const ahora = suma(month);
  const antes = suma(previo);
  return Object.keys({ ...ahora, ...antes })
    .map((category) => ({
      category,
      amount: num(ahora[category]),
      previous: num(antes[category]),
    }))
    .filter((x) => x.amount > 0 || x.previous > 0)
    .sort((a, b) => b.amount - a.amount || b.previous - a.previous);
}
