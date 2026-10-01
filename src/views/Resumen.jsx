import { Suspense, lazy, useState } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingBag, Check, Landmark, Sheet, AlertTriangle, Activity, Wallet,
  PiggyBank, HandCoins,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthLabel, todayStr } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import MiniCalendario from '../components/MiniCalendario';
import { RANGOS, pulseRange } from '../lib/cashflow.js';
import RecCard from '../components/RecCard';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';

/*
 * Las gráficas llegan aparte. Son 108 KB comprimidos de recharts —más que
 * todo el resto de la app junta— y esta pantalla es la que abre por defecto,
 * así que traerlas en el arranque retrasaba el saldo y los cuatro números por
 * algo que se puede pintar un instante después. Ver components/Graficas.jsx.
 */
const Pulso = lazy(() => import('../components/Graficas').then((m) => ({ default: m.Pulso })));
const Reparto = lazy(() => import('../components/Graficas').then((m) => ({ default: m.Reparto })));

/* Reserva el alto exacto de la gráfica: si no, al llegar empuja la página. */
function HuecoGrafica({ alto }) {
  return <div style={{ height: alto }} aria-hidden="true" />;
}

/*
 * Resumen: la foto de cómo va la plata.
 *
 * Tenía nueve tarjetas y cuatro gráficas, todas del mismo tamaño. Con todo
 * gritando al mismo volumen no había dónde mirar primero, y varias respondían
 * preguntas que ya responde otra pantalla mejor.
 *
 * Quedan dos gráficas y cuatro números:
 *
 *   El pulso   sube con cada ingreso, baja con cada gasto. Enseña la FORMA del
 *              mes —el escalón de la quincena, la caída del arriendo— que un
 *              promedio mensual no puede mostrar.
 *
 *   El reparto a dónde va cada peso del plan. Suma el ingreso completo, así que
 *              los porcentajes se leen sin hacer cuentas.
 */

/* "9 de septiembre" — la fecha del ancla se lee, no se descifra. */
const diaLargo = (d) => {
  const [y, m, dia] = String(d).split('-').map(Number);
  return new Date(y, m - 1, dia).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
};

/*
 * El saldo en cuenta, y de dónde sabe la app que es ese.
 *
 * La gráfica de abajo dibujaba la variación desde el primer movimiento
 * registrado, y decía "arranca en cero porque no sabemos con cuánto
 * empezaste". Era honesto pero inútil: la pregunta de la mañana no es "cuánto
 * me he movido", es "cuánto tengo".
 *
 * Anclar es escribir una vez el saldo que muestra el banco. De ahí en adelante
 * la app lo sigue sola, y cuando se desfase —una transferencia que no
 * registraste— se vuelve a anclar. Por eso el botón no dice "editar" sino
 * "cuadrar con el banco": no estás corrigiendo la app, estás volviendo a
 * medir.
 */
function SaldoEnCuenta() {
  const { saldoReal, balanceAnchor, handleAnchorBalance } = useFinance();
  const [editando, setEditando] = useState(false);
  const [monto, setMonto] = useState('');

  const guardar = (e) => {
    e.preventDefault();
    handleAnchorBalance(monto, todayStr());
    setEditando(false);
    setMonto('');
  };

  const abrir = () => {
    setMonto(saldoReal === null ? '' : String(Math.round(saldoReal)));
    setEditando(true);
  };

  if (editando) {
    return (
      <form className="cc-saldo" onSubmit={guardar}>
        <label className="cc-saldo-label" htmlFor="cc-saldo-input">
          ¿Cuánto tienes en la cuenta ahora mismo?
        </label>
        <div className="cc-saldo-fila">
          <input
            id="cc-saldo-input" className="cc-input" type="number" step="any"
            /* El foco entra solo: se abrió esto para escribir un número. */
            autoFocus placeholder="0" value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
          <button type="submit" className="cc-btn cc-btn-primary cc-btn-sm">Guardar</button>
          <button
            type="button" className="cc-btn cc-btn-outline cc-btn-sm"
            onClick={() => setEditando(false)}
          >
            Cancelar
          </button>
        </div>
        <span className="cc-stat-sub">
          El que ves en el banco, con lo de hoy ya contado. A partir de ahí la app lo sigue sola.
        </span>
      </form>
    );
  }

  if (saldoReal === null) {
    return (
      <div className="cc-saldo">
        <span className="cc-saldo-label">Saldo en cuenta</span>
        <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={abrir}>
          <Wallet size={14} /> Dile a la app cuánto tienes
        </button>
        <span className="cc-stat-sub">
          Sin esto la gráfica muestra cuánto te has movido, no cuánto tienes.
        </span>
      </div>
    );
  }

  return (
    <div className="cc-saldo">
      <span className="cc-saldo-label">Saldo en cuenta</span>
      <div className="cc-saldo-fila">
        <span
          className="cc-saldo-monto cc-mono"
          style={{ color: saldoReal < 0 ? COLORS.expense : COLORS.ink }}
        >
          {fmtCOP(saldoReal)}
        </span>
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={abrir}>
          Cuadrar con el banco
        </button>
      </div>
      <span className="cc-stat-sub">
        Contado desde los {fmtCOP(balanceAnchor.amount)} del {diaLargo(balanceAnchor.date)}.
      </span>
    </div>
  );
}

/*
 * El saldo, como la gráfica del dólar.
 *
 * Arriba el número grande y cuánto cambió en el rango elegido; debajo la
 * curva, verde si subiste y roja si bajaste. El rango es lo que le da sentido
 * a la pregunta: "¿voy bien?" no se responde igual mirando la semana que el
 * año.
 */
const TEXTO_RANGO = {
  '1S': 'en la última semana',
  '1M': 'en el último mes',
  '3M': 'en los últimos 3 meses',
  '1A': 'en el último año',
  todo: 'desde que empezaste',
};

function leerRango() {
  try { return localStorage.getItem('aldia-rango') || '1M'; } catch { return '1M'; }
}

function Saldo() {
  const { cashFlowTodo, saldoReal, balanceAnchor } = useFinance();
  const [rango, setRango] = useState(leerRango);
  const elegir = (id) => {
    setRango(id);
    try { localStorage.setItem('aldia-rango', id); } catch { /* sin almacenamiento */ }
  };

  const r = pulseRange(cashFlowTodo, rango, todayStr());
  const subio = r.cambio >= 0;
  const largo = rango === '1A' || rango === 'todo';

  return (
    <div className="cc-card cc-hero-saldo">
      <SaldoEnCuenta />

      {r.puntos.length > 1 && (
        <div className={`cc-cambio ${subio ? 'sube' : 'baja'}`}>
          {subio ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          <strong className="cc-mono">
            {subio ? '+' : '−'}{fmtCOP(Math.abs(r.cambio))}
            {r.pct !== null && ` (${subio ? '+' : '−'}${Math.abs(Math.round(r.pct * 100))}%)`}
          </strong>
          <span>{TEXTO_RANGO[rango]}</span>
        </div>
      )}

      {/* El rango va en una sola fila arriba de la curva, como en Google. */}
      <div className="cc-rangos" role="tablist" aria-label="Rango de la gráfica">
        {RANGOS.map((x) => (
          <button
            key={x.id} type="button" role="tab" aria-selected={rango === x.id}
            className={`cc-rango ${rango === x.id ? 'on' : ''}`}
            onClick={() => elegir(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {r.puntos.length < 2 ? (
        <EmptyState
          Icon={Activity}
          title="Todavía no hay con qué dibujar"
          text="Registra un ingreso o un gasto y aquí verás cómo se mueve tu plata."
        />
      ) : (
        <Suspense fallback={<HuecoGrafica alto={240} />}>
          <Pulso data={r.puntos} subio={subio} largo={largo} />
        </Suspense>
      )}

      <p className="cc-stat-sub" style={{ marginTop: 4 }}>
        {balanceAnchor
          ? 'Los puntos con borde son los días en que cuadraste con el banco: el brinco es lo que no estaba registrado.'
          : 'Sin cuadrar con el banco, la línea muestra cuánto te has movido, no cuánto tienes.'}
        {saldoReal !== null && saldoReal < 0 && ' Ojo: según lo registrado, la cuenta está en rojo.'}
      </p>
    </div>
  );
}

/* Un número grande con su fondo de color: se lee de lejos, como un tablero. */
function Kpi({ label, value, sub, Icon, tono }) {
  return (
    <div className={`cc-kpi cc-kpi-${tono}`}>
      <div className="cc-kpi-label"><Icon size={15} /> {label}</div>
      <div className="cc-kpi-valor cc-mono">{value}</div>
      {sub && <div className="cc-kpi-sub">{sub}</div>}
    </div>
  );
}

export default function Resumen() {
  const {
    availableMonths, exporting, handleExportExcel,
    planDistribution, monthReport, pendingSplits, expectedIncomes,
    selMonthExpense, selMonthIncome,
    selectedMonth, setSelectedMonth, status, recommendations,
  } = useFinance();

  const totalPlan = planDistribution.reduce((s, x) => s + x.value, 0);
  const { plan, real, collections } = monthReport;

  const teDebenCobros = collections.filter((c) => !c.collected).reduce((s, c) => s + c.amount, 0);
  const teDebenCuentas = (pendingSplits || []).reduce((s, x) => s + x.amount, 0);
  const porCobrarProyecto = (expectedIncomes || [])
    .filter((x) => !x.transactionId).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const apartado = real.savings + real.cushion;
  const planApartar = plan.savings + plan.cushion;

  return (
    <>
      <div className="cc-section-head" style={{ marginTop: 0 }}>
        <div>
          <div className="cc-page-title">Resumen</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>Cómo se ha movido tu plata y a dónde se va.</p>
        </div>
        <div className="cc-cabecera-acciones">
          <span className="cc-sello" style={{ color: status.color, borderColor: status.color }}>
            <status.Icon size={13} /> {status.label}
          </span>
          <select
            className="cc-select cc-select-sm" style={{ maxWidth: 140 }}
            value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => window.print()} title="Reporte del mes en PDF">
            <Landmark size={13} /> PDF
          </button>
          <button
            type="button" className="cc-btn cc-btn-outline cc-btn-sm"
            onClick={handleExportExcel} disabled={exporting === 'trabajando'}
          >
            <Sheet size={13} /> {exporting === 'trabajando' ? 'Generando…' : 'Excel'}
          </button>
        </div>
      </div>

      {exporting && exporting !== 'trabajando' && (
        <div className="cc-banner"><AlertTriangle size={15} /> No se pudo generar el Excel: {exporting}</div>
      )}

      <Saldo />

      <div className="cc-kpis">
        <Kpi
          tono="verde" Icon={TrendingUp} label={`Entró en ${monthLabel(selectedMonth)}`}
          value={fmtCOP(selMonthIncome)}
          sub={plan.income > 0 ? `de ${fmtCOP(plan.income)} esperados` : null}
        />
        <Kpi
          tono="rojo" Icon={ShoppingBag} label="Gastaste"
          value={fmtCOP(selMonthExpense)}
          sub={teDebenCuentas > 0 ? 'solo tu parte de las cuentas divididas' : null}
        />
        <Kpi
          tono="azul" Icon={PiggyBank} label="Apartaste"
          value={fmtCOP(apartado)}
          sub={planApartar > 0 ? `de ${fmtCOP(planApartar)} planeados` : null}
        />
        <Kpi
          tono="ambar" Icon={HandCoins} label="Te deben"
          value={fmtCOP(teDebenCobros + teDebenCuentas)}
          sub={porCobrarProyecto > 0 ? `+ ${fmtCOP(porCobrarProyecto)} de proyectos por cobrar` : null}
        />
      </div>

      <div className="cc-resumen-fila">
        <MiniCalendario />

        <div className="cc-card">
          <p className="cc-chart-title">A dónde va cada peso</p>
          <p className="cc-chart-sub">Según el plan de {monthLabel(selectedMonth)}</p>
          {planDistribution.length === 0 ? (
            <EmptyState
              Icon={ShoppingBag}
              title="Todavía no hay un plan"
              text="Cuando tengas ingresos y gastos fijos registrados, aquí verás cómo se reparte lo que entra."
            />
          ) : (
            <>
              <Suspense fallback={<HuecoGrafica alto={200} />}>
                <Reparto data={planDistribution} alto={200} />
              </Suspense>
              <div className="cc-leyenda-reparto">
                {planDistribution.map((x) => (
                  <div key={x.name}>
                    <i style={{ background: x.color }} />
                    <span>{x.name}</span>
                    <span className="cc-mono">{totalPlan > 0 ? `${Math.round((x.value / totalPlan) * 100)}%` : '—'}</span>
                    <span className="cc-mono">{fmtCOP(x.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">Recomendaciones para este mes</p>
        <div className="cc-rec-list">
          {recommendations.length === 0
            ? <EmptyState Icon={Check} title="Todo en orden" text="No tenemos ninguna alerta para ti en este momento." />
            : recommendations.map((r, i) => <RecCard key={i} kind={r.kind} text={r.text} />)}
        </div>
      </div>
    </>
  );
}
