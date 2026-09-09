import {
  CalendarClock, TrendingUp, AlertTriangle, HelpCircle, Wallet, MapPin,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthLabel } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';

/*
 * Calendario: cómo cae el mes entre un sueldo y el siguiente.
 *
 * El resto de la app juzga el mes como una unidad. Eso sirve para saber si
 * cierra y no sirve para vivirlo: el mes puede cuadrar perfecto y dejarte sin
 * plata el día 9, porque el sueldo llega en dos pedazos y los gastos no se
 * reparten parejo entre ellos.
 *
 * La pantalla existe para hacer visible una sola cosa: qué quincena va
 * apretada. Por eso cada tramo es una cascada corta —entra, sale, queda— y no
 * una tabla de todo: si hay que buscar el número, no cumplió.
 */

const dia = (d) => {
  const [y, m, x] = String(d).split('-').map(Number);
  return new Date(y, m - 1, x).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
};

/*
 * "5 sep" en vez de "5 de sept". La columna de fechas es angosta a propósito
 * —leídas en vertical se comparan solas— y el "de" la partía en dos líneas,
 * que era peor que abreviar.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const diaCorto = (d) => {
  const [, m, x] = String(d).split('-').map(Number);
  return `${x} ${MESES[m - 1]}`;
};

const COLOR_POR_TIPO = {
  ingreso: COLORS.income,
  fijo: COLORS.debt,
  deuda: COLORS.expense,
  bucket: '#3E7FB0',
};

function Tramo({ p }) {
  const enRojo = p.leftover < 0;
  const gastos = p.items.filter((i) => i.amount < 0);
  const entradas = p.items.filter((i) => i.amount > 0);

  return (
    <div className="cc-card cc-quincena">
      <div className="cc-quincena-head">
        <span className="cc-quincena-rango">
          {dia(p.start)} → {dia(p.endExclusive)}
        </span>
        <span className="cc-stat-sub">{p.days} días</span>
      </div>

      <div
        className="cc-quincena-num cc-mono"
        style={{ color: enRojo ? COLORS.expense : COLORS.ink }}
      >
        {fmtCOP(p.leftover)}
      </div>
      <p className="cc-stat-sub" style={{ marginTop: 0 }}>
        {enRojo
          ? 'No alcanza: esta quincena se queda corta.'
          : 'Queda libre al final de la quincena.'}
      </p>

      <div className="cc-quincena-lineas">
        {entradas.map((i) => (
          <div key={i.id} className="cc-quincena-linea">
            <span className="cc-quincena-dia">{diaCorto(i.date)}</span>
            <span style={{ color: COLOR_POR_TIPO[i.kind] }}>{i.name}</span>
            <span className="cc-mono" style={{ color: COLORS.income }}>{fmtCOP(i.amount)}</span>
          </div>
        ))}

        {gastos.map((i) => (
          <div key={i.id} className="cc-quincena-linea">
            <span className="cc-quincena-dia">{diaCorto(i.date)}</span>
            <span style={{ color: COLOR_POR_TIPO[i.kind] }}>{i.name}</span>
            <span className="cc-mono">{fmtCOP(i.amount)}</span>
          </div>
        ))}

        {/*
          * La vida diaria no tiene fecha —se gasta todos los días— así que va
          * al final y con el prorrateo dicho. Esconderla haría ver cada
          * quincena mucho más holgada de lo que es.
          */}
        <div className="cc-quincena-linea cc-quincena-vida">
          <span className="cc-quincena-dia">—</span>
          <span>Vida diaria ({p.days} días)</span>
          <span className="cc-mono">{fmtCOP(-p.living)}</span>
        </div>
      </div>
    </div>
  );
}


const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/* Lo que se ve al pasar el mouse por un día: el detalle sin gastar celda. */
function detalleDelDia(items, total) {
  const lineas = items.map((x) => `${x.name}: ${fmtCOP(x.amount)}`);
  return [...lineas, `= ${fmtCOP(total)}`].join('\n');
}

/*
 * El mes en cuadrícula.
 *
 * Las tarjetas de arriba responden "¿cuál quincena va apretada?". Esta
 * responde la que no se puede leer en una lista: "¿cómo se amontonan los
 * días?". Que casi todo lo fijo caiga en la primera semana es algo que en
 * columnas hay que deducir sumando, y aquí se ve de un vistazo.
 *
 * La banda de color dice a qué quincena pertenece cada día. Es lo que hace
 * visible que el sueldo del 30 paga hasta el 15 — lo que el mes calendario
 * esconde por construcción.
 */
function Rejilla({ semanas, tramos }) {
  const hoy = semanas.flat().find((d) => d && d.isToday);

  return (
    <div className="cc-card" style={{ marginTop: 14 }}>
      <p className="cc-chart-title">El mes de un vistazo</p>
      <p className="cc-chart-sub">
        Cada punto es un movimiento. El color de fondo dice de qué quincena es el día.
      </p>

      <div className="cc-cal">
        {DIAS_SEMANA.map((d, i) => (
          /* eslint-disable-next-line react/no-array-index-key */
          <div key={i} className="cc-cal-cabecera">{d}</div>
        ))}

        {semanas.flat().map((d, i) => {
          if (!d) return <div key={`hueco-${i}`} className="cc-cal-hueco" />;
          const sale = d.items.filter((x) => x.amount < 0);
          const entra = d.items.filter((x) => x.amount > 0);
          const total = d.items.reduce((s, x) => s + x.amount, 0);
          const clases = [
            'cc-cal-dia',
            d.periodIndex !== null ? `q${d.periodIndex % 2}` : '',
            d.isToday ? 'hoy' : '',
            d.startsPeriod ? 'arranque' : '',
          ].filter(Boolean).join(' ');

          return (
            <div
              key={d.date} className={clases}
              /* El título nativo da el detalle sin gastar espacio en la celda. */
              title={d.items.length ? detalleDelDia(d.items, total) : undefined}
            >
              <span className="cc-cal-num">{d.day}</span>
              {d.isToday && <span className="cc-cal-hoy">hoy</span>}
              <span className="cc-cal-puntos">
                {entra.map((x) => <i key={x.id} className="cc-cal-punto entra" />)}
                {sale.map((x) => <i key={x.id} className={`cc-cal-punto ${x.kind}`} />)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="cc-cal-leyenda">
        <span><i className="cc-cal-punto entra" /> entra</span>
        <span><i className="cc-cal-punto fijo" /> gasto fijo</span>
        <span><i className="cc-cal-punto deuda" /> cuota</span>
        <span><i className="cc-cal-punto bucket" /> apartas</span>
      </div>

      {/*
        * El "estás aquí" en palabras. El recuadro en la cuadrícula dice QUÉ día
        * es hoy; esto dice lo que de verdad se quiere saber: en cuál quincena
        * estás parado y cuánto falta para la siguiente.
        */}
      {hoy && hoy.periodIndex !== null && (() => {
        const t = tramos[hoy.periodIndex];
        const faltan = Math.max(0, Math.round(
          (new Date(`${t.endExclusive}T12:00:00`) - new Date(`${hoy.date}T12:00:00`)) / 86400000,
        ));
        return (
          <p className="cc-page-sub" style={{ marginTop: 10, marginBottom: 0 }}>
            <MapPin size={13} style={{ verticalAlign: '-2px' }} />{' '}
            <strong>Estás aquí:</strong> en la quincena del {dia(t.start)}, que tiene que
            aguantar {faltan === 0 ? 'hasta hoy' : `${faltan} día${faltan === 1 ? '' : 's'} más`}.
            Al final te quedan <strong className="cc-mono">{fmtCOP(t.leftover)}</strong>.
          </p>
        );
      })()}
    </div>
  );
}

export default function Calendario() {
  const {
    quincenas, calendarioRejilla, availableMonths, selectedMonth, setSelectedMonth,
  } = useFinance();

  const { periods: tramos, unscheduled, daily } = quincenas;

  return (
    <>
      <div className="cc-page-title">Calendario</div>
      <p className="cc-page-sub">
        Cómo cae el mes entre un sueldo y el siguiente. Una quincena no es del 1 al 15:
        es lo que tiene que aguantar la plata desde que te pagan hasta que te vuelven a pagar.
      </p>

      <div className="cc-section-head">
        <select
          className="cc-select" style={{ maxWidth: 160 }}
          value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {tramos.length === 0 ? (
        <EmptyState
          Icon={CalendarClock}
          title="Falta decir qué día te pagan"
          text="En Configuración → Ingresos, ponle el día a cada fuente y marca cuál abre quincena. Sin eso no hay cómo partir el mes."
        />
      ) : (
        <>
          <div className="cc-quincenas-grid">
            {tramos.map((p) => <Tramo key={p.start} p={p} />)}
          </div>

          <Rejilla semanas={calendarioRejilla} tramos={tramos} />

          <p className="cc-page-sub" style={{ marginTop: 10 }}>
            <Wallet size={13} style={{ verticalAlign: '-2px' }} />{' '}
            La vida diaria sale de tu estimado de gasto variable más las reservas:{' '}
            <strong className="cc-mono">{fmtCOP(daily)}</strong> al día.
            {' '}El primer tramo arranca en el mes pasado a propósito — es el sueldo
            que paga los primeros días de {monthLabel(selectedMonth)}.
          </p>
        </>
      )}

      {/*
        * Lo sin fecha va aparte y no repartido a ojo: meterlo en la quincena
        * equivocada haría ver holgada la que no lo es, que es justo el error
        * que esta pantalla existe para no cometer.
        */}
      {unscheduled.length > 0 && (
        <div className="cc-card" style={{ marginTop: 14 }}>
          <p className="cc-chart-title">
            <HelpCircle size={15} style={{ verticalAlign: '-2px' }} /> Sin fecha todavía
          </p>
          <p className="cc-chart-sub">
            No sabemos en qué quincena caen, así que no están contados arriba. Ponles
            el día y el reparto se acomoda solo.
          </p>
          <div className="cc-commit-list">
            {unscheduled.map((e) => (
              <div key={e.id} className="cc-quincena-linea">
                <span style={{ color: COLOR_POR_TIPO[e.kind] }}>{e.name}</span>
                <span className="cc-mono">{fmtCOP(e.amount)}</span>
              </div>
            ))}
          </div>
          <p className="cc-stat-sub" style={{ marginTop: 8 }}>
            Total sin ubicar:{' '}
            <strong className="cc-mono">
              {fmtCOP(unscheduled.reduce((s, e) => s + e.amount, 0))}
            </strong>
          </p>
        </div>
      )}

      {tramos.length > 1 && (
        <Balance tramos={tramos} />
      )}
    </>
  );
}

/*
 * El veredicto, que es lo que se venía a preguntar.
 *
 * Un mes puede cerrar bien y estar mal repartido, y esa diferencia no se ve en
 * ninguna otra pantalla: lo que sobra en la primera quincena no sobra, está
 * reservado para la segunda — pero durante dos semanas se ve en la cuenta como
 * si sobrara.
 */
function Balance({ tramos }) {
  const flojo = tramos.reduce((a, b) => (a.leftover < b.leftover ? a : b));
  const holgado = tramos.reduce((a, b) => (a.leftover > b.leftover ? a : b));
  const brecha = holgado.leftover - flojo.leftover;
  const alguienEnRojo = flojo.leftover < 0;

  return (
    <div className="cc-card" style={{ marginTop: 14 }}>
      <p className="cc-chart-title">
        {alguienEnRojo
          ? <><AlertTriangle size={15} style={{ verticalAlign: '-2px' }} /> Una quincena no cierra</>
          : <><TrendingUp size={15} style={{ verticalAlign: '-2px' }} /> Cómo está el reparto</>}
      </p>
      <p className="cc-chart-sub" style={{ marginBottom: 0 }}>
        {alguienEnRojo ? (
          <>
            La del <strong>{dia(flojo.start)}</strong> queda en{' '}
            <strong className="cc-mono">{fmtCOP(flojo.leftover)}</strong> mientras la del{' '}
            <strong>{dia(holgado.start)}</strong> deja{' '}
            <strong className="cc-mono">{fmtCOP(holgado.leftover)}</strong>. Mueve a la
            holgada algo de lo que apartas — es lo único que decides tú solo, sin
            negociar la fecha con nadie.
          </>
        ) : (
          <>
            Entre la más apretada y la más holgada hay{' '}
            <strong className="cc-mono">{fmtCOP(brecha)}</strong>. Ojo con lo que sobra en
            la holgada: no sobra, está reservado para la siguiente — pero hasta que
            llegue se ve en la cuenta como si sobrara.
          </>
        )}
      </p>
    </div>
  );
}
