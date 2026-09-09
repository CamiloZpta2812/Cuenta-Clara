import { daysInMonth, monthKeyFromDate, todayStr } from './dates.js';
import { myShare } from './month.js';

/*
 * Qué te van a cobrar en los próximos días.
 *
 * El día de cobro de un gasto fijo estaba guardado desde siempre, pero solo se
 * usaba para escribir "día 5" en la lista. Saber que el arriendo es el día 5 no
 * sirve de nada el día 3 si nadie te lo dice: la información estaba, la
 * pregunta no.
 *
 * La pregunta es "¿qué se me viene esta semana?", y se responde con dos cosas
 * que la app ya sabe: el día de cobro, y si el mes ya está pago.
 */

/* El día `dia` dentro del mes de `ref`, recortado si el mes es más corto. */
function fechaEnMes(ref, dia) {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = Math.min(dia, daysInMonth(y, m));
  return new Date(y, m, d);
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/*
 * El próximo cobro de un gasto fijo a partir de `desde`. Si el día de este mes
 * ya pasó, es el del mes entrante — salvo que el de este mes siga sin pagarse,
 * en cuyo caso lo que se viene no es el próximo: es el que ya se te pasó.
 */
export function nextCharge(fijo, desde, pagadoEsteMes) {
  if (!fijo.dueDay) return null;
  const hoy = new Date(`${desde}T12:00:00`);
  const esteMes = fechaEnMes(hoy, fijo.dueDay);

  if (esteMes >= hoy) return { date: iso(esteMes), vencido: false };
  if (!pagadoEsteMes) return { date: iso(esteMes), vencido: true };

  const siguiente = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
  return { date: iso(fechaEnMes(siguiente, fijo.dueDay)), vencido: false };
}

/*
 * Los gastos fijos que se cobran de aquí a `dias`, más los que ya se vencieron
 * sin pagar. Ordenados por fecha, que es como los vas a enfrentar.
 *
 * Los gastos sin día de cobro no aparecen: sin ese dato no hay nada que
 * anticipar, y meterlos con una fecha inventada sería peor que no mostrarlos.
 */
export function upcomingCharges(estado, dias = 7, desde = todayStr()) {
  const mes = monthKeyFromDate(desde);
  const limite = new Date(`${desde}T12:00:00`);
  limite.setDate(limite.getDate() + dias);

  const pagados = new Set(
    (estado.transactions || [])
      .filter((t) => t.fixedExpenseId && monthKeyFromDate(t.date) === mes)
      .map((t) => t.fixedExpenseId),
  );

  return (estado.fixedExpenses || [])
    .map((f) => {
      const pagado = pagados.has(f.id);
      const cobro = nextCharge(f, desde, pagado);
      if (!cobro) return null;
      if (cobro.date > iso(limite)) return null;

      /*
       * Un gasto pagado se esconde solo si el cobro que salió cae en el mes
       * que sabemos pago. Antes se escondía CUALQUIER cobro de un gasto
       * pagado, y eso dejaba ciega la última semana de todos los meses: el 28
       * de septiembre, con el arriendo de septiembre ya pagado, el del 1 de
       * octubre —que sí entra en la ventana— no aparecía. Justo la semana en
       * que uno quiere saber qué se le viene.
       *
       * Lo que ya se sabe pago es el mes de referencia, y nada más: de octubre
       * todavía no hay nada registrado, así que su cobro se anuncia.
       */
      if (pagado && monthKeyFromDate(cobro.date) === mes) return null;

      return {
        id: f.id,
        name: f.name,
        amount: myShare(f),
        date: cobro.date,
        vencido: cobro.vencido,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
