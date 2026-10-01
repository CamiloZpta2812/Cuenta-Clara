import { CalendarClock, ArrowRight } from 'lucide-react';
import { fmtCOP } from '../lib/money.js';
import { useFinance } from '../state/financeStore';

/*
 * El mes de un vistazo, en el Resumen.
 *
 * No repite el Calendario: lo resume en una sola pregunta, "¿qué días pesan?".
 * Cada día va más oscuro según cuánto sale ese día, en un solo tono —un mapa
 * de calor, no un arcoíris—, y los días en que entra plata llevan un punto
 * verde. Lo que se ve de lejos es la forma del mes: la primera semana oscura,
 * la mitad clara. Para el detalle está el Calendario, a un toque.
 */

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/* Cuatro escalones del mismo terracota, de casi nada a mucho. */
const TONOS = ['#F5E2DB', '#EBBFAF', '#D98E78', '#BB4B34'];

function tono(sale, maximo) {
  if (sale <= 0 || maximo <= 0) return null;
  const t = sale / maximo;
  if (t > 0.6) return TONOS[3];
  if (t > 0.3) return TONOS[2];
  if (t > 0.1) return TONOS[1];
  return TONOS[0];
}

export default function MiniCalendario() {
  const { calendarioRejilla: semanas, quincenas, setActiveTab } = useFinance();
  const dias = (semanas || []).flat();
  const reales = dias.filter(Boolean);
  if (reales.length === 0) return null;

  const salidaDe = (d) => -d.items.filter((x) => x.amount < 0).reduce((s, x) => s + x.amount, 0);
  const maximo = Math.max(0, ...reales.map(salidaDe));
  const hoy = reales.find((d) => d.isToday);
  const tramo = hoy && hoy.periodIndex !== null ? (quincenas.periods || [])[hoy.periodIndex] : null;

  return (
    <div className="cc-card cc-mini-cal">
      <div className="cc-section-head" style={{ marginTop: 0, marginBottom: 8 }}>
        <p className="cc-chart-title" style={{ margin: 0 }}>
          <CalendarClock size={15} style={{ verticalAlign: '-2px' }} /> El mes de un vistazo
        </p>
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => setActiveTab('calendario')}>
          Ver calendario <ArrowRight size={13} />
        </button>
      </div>

      <div className="cc-mini-grid">
        {DIAS.map((d, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i} className="cc-mini-cab">{d}</span>
        ))}
        {dias.map((d, i) => {
          // eslint-disable-next-line react/no-array-index-key
          if (!d) return <span key={`h${i}`} />;
          const sale = salidaDe(d);
          const fondo = tono(sale, maximo);
          const entra = d.items.some((x) => x.amount > 0);
          return (
            <button
              type="button" key={d.date}
              className={`cc-mini-dia ${d.isToday ? 'hoy' : ''} ${fondo === TONOS[3] ? 'oscuro' : ''}`}
              style={fondo ? { background: fondo } : undefined}
              onClick={() => setActiveTab('calendario')}
              title={d.items.length
                ? `${d.day}: ${d.items.map((x) => x.name).join(', ')}`
                : `${d.day}: sin movimientos planeados`}
            >
              {d.day}
              {entra && <i className="cc-mini-entra" />}
            </button>
          );
        })}
      </div>

      <div className="cc-mini-pie">
        <span className="cc-mini-escala">
          menos
          {TONOS.map((t) => <i key={t} style={{ background: t }} />)}
          más sale
        </span>
        <span><i className="cc-mini-entra" style={{ position: 'static' }} /> entra plata</span>
      </div>

      {tramo && (
        <p className="cc-stat-sub" style={{ marginTop: 8 }}>
          <strong>Estás aquí:</strong> la quincena que arrancó el {Number(tramo.start.slice(8))} termina
          con <strong className="cc-mono">{fmtCOP(tramo.leftover)}</strong> libres.
        </p>
      )}
    </div>
  );
}
