import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { useState } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingBag, Check, Landmark, Sheet, AlertTriangle, Activity, Wallet,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthLabel, todayStr } from '../lib/dates.js';
import { fmtCOP, fmtShort } from '../lib/money.js';
import StatCard from '../components/StatCard';
import RecCard from '../components/RecCard';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';

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

const ejeFecha = (d) => {
  const [, m, dia] = String(d).split('-');
  return `${parseInt(dia, 10)}/${parseInt(m, 10)}`;
};

const tooltipStyle = {
  fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}`,
};

/*
 * Qué está mirando el usuario cambia según si hay ancla: con ella la línea es
 * el saldo, sin ella es la variación. Decirlo mal es peor que no decir nada.
 */
function PieDeLaGrafica() {
  const { balanceAnchor } = useFinance();
  return (
    <p className="cc-page-sub" style={{ marginTop: 6 }}>
      {balanceAnchor
        ? 'Es el saldo de la cuenta día a día. Lo apartado en colchones ya está descontado, aunque siga siendo tuyo.'
        : 'Es cuánto te has movido en la ventana, no el saldo del banco: arranca en cero porque todavía no le has dicho con cuánto cuentas.'}
    </p>
  );
}

function PulsoTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div className="cc-card" style={{ padding: '8px 12px', fontSize: 12.5 }}>
      <div style={{ fontWeight: 600 }}>{p.date}</div>
      <div className="cc-mono">{fmtCOP(p.saldo)}</div>
      {p.label && <div style={{ color: COLORS.inkSoft }}>{p.label}</div>}
    </div>
  );
}


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

export default function Resumen() {
  const {
    availableMonths, exporting, handleExportExcel,
    cashFlow, planDistribution,
    selMonthExpense, selMonthFixed, selMonthIncome, selMonthVariable,
    selectedMonth, setSelectedMonth, status, recommendations,
  } = useFinance();

  const totalPlan = planDistribution.reduce((s, x) => s + x.value, 0);

  return (
    <>
      <div className="cc-page-title">Resumen</div>
      <p className="cc-page-sub">Cómo se ha movido tu plata y a dónde se va.</p>

      <div className="cc-section-head">
        <div className="cc-stamp" style={{ color: status.color }}>
          <status.Icon size={16} /> {status.label}
        </div>
        <select
          className="cc-select" style={{ maxWidth: 160 }}
          value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => window.print()}>
          <Landmark size={13} /> Reporte del mes (PDF)
        </button>
        <button
          type="button" className="cc-btn cc-btn-outline cc-btn-sm"
          onClick={handleExportExcel} disabled={exporting === 'trabajando'}
        >
          <Sheet size={13} /> {exporting === 'trabajando' ? 'Generando…' : 'Todo en Excel'}
        </button>
      </div>

      {exporting && exporting !== 'trabajando' && (
        <div className="cc-banner"><AlertTriangle size={15} /> No se pudo generar el Excel: {exporting}</div>
      )}

      <div className="cc-stats-grid">
        <StatCard label="Ingresos del mes" value={fmtCOP(selMonthIncome)} Icon={TrendingUp} color={COLORS.income} bg="var(--income-soft)" />
        <StatCard label="Gastos del mes" value={fmtCOP(selMonthExpense)} Icon={TrendingDown} color={COLORS.expense} bg="var(--expense-soft)" />
        <StatCard label="Gastos fijos" value={fmtCOP(selMonthFixed)} Icon={Landmark} color={COLORS.debt} bg="var(--debt-soft)" />
        <StatCard label="Gastos variables" value={fmtCOP(selMonthVariable)} Icon={ShoppingBag} color={COLORS.savings} bg="var(--savings-soft)" />
      </div>

      {/* ----------------------------------------------------------- el pulso */}
      <div className="cc-card" style={{ marginTop: 18 }}>
        <SaldoEnCuenta />
        <p className="cc-chart-title" style={{ marginTop: 16 }}>El pulso de tu plata</p>
        <p className="cc-chart-sub">
          Sube con cada ingreso y baja con cada gasto, aporte y abono · últimos 3 meses
        </p>
        {cashFlow.length === 0 ? (
          <EmptyState
            Icon={Activity}
            title="Todavía no hay movimientos"
            text="Registra un ingreso o un gasto y aquí verás la forma que va tomando el mes."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={cashFlow} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="pulso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.income} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={COLORS.income} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis
                  dataKey="date" tickFormatter={ejeFecha} minTickGap={28}
                  tick={{ fontSize: 11, fill: COLORS.inkSoft }}
                  axisLine={{ stroke: COLORS.line }} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false}
                  tickLine={false} tickFormatter={fmtShort} width={46}
                />
                <ReferenceLine y={0} stroke={COLORS.inkSoft} strokeDasharray="4 4" />
                <Tooltip content={<PulsoTooltip />} />
                <Area
                  type="monotone" dataKey="saldo" stroke={COLORS.income}
                  strokeWidth={2.5} fill="url(#pulso)" dot={false} activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <PieDeLaGrafica />
          </>
        )}
      </div>

      {/* ---------------------------------------------------------- el reparto */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">A dónde va cada peso</p>
        <p className="cc-chart-sub">Según el plan de {monthLabel(selectedMonth)}</p>
        {planDistribution.length === 0 ? (
          <EmptyState
            Icon={ShoppingBag}
            title="Todavía no hay un plan"
            text="Cuando tengas ingresos y gastos fijos registrados, aquí verás cómo se reparte lo que entra."
          />
        ) : (
          <div className="cc-split">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={planDistribution} dataKey="value" nameKey="name"
                  innerRadius={60} outerRadius={98} paddingAngle={2}
                >
                  {planDistribution.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>

            {/*
              La leyenda va como lista y no dentro de la gráfica: con seis
              porciones, los rótulos de recharts se pisan entre sí y el
              porcentaje —que es lo que se vino a leer— queda ilegible.
            */}
            <div className="cc-commit-list" style={{ alignSelf: 'center' }}>
              {planDistribution.map((x) => (
                <div key={x.name} className="cc-plan-row" style={{ gridTemplateColumns: '1fr 96px 52px' }}>
                  <span className="cc-plan-concept">
                    <span style={{
                      width: 10, height: 10, borderRadius: 3, background: x.color, flexShrink: 0,
                    }}
                    />
                    {x.name}
                  </span>
                  <span className="cc-mono">{fmtCOP(x.value)}</span>
                  <span className="cc-mono" style={{ color: COLORS.inkSoft }}>
                    {totalPlan > 0 ? `${Math.round((x.value / totalPlan) * 100)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
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
