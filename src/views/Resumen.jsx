import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { LayoutDashboard, CreditCard, PiggyBank, TrendingUp, TrendingDown, Wallet, ShoppingBag, Check, Landmark, Repeat } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { getCategory } from '../lib/categories.js';
import { monthLabel } from '../lib/dates.js';
import { fmtCOP, fmtShort } from '../lib/money.js';
import StatCard from '../components/StatCard';
import RecCard from '../components/RecCard';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';
export default function Resumen() {
  const {
    availableMonths,
    commitments,
    cashBalance,
    equityEvolution,
    monthlyIncomeExpense,
    netWorth,
    pieData,
    recommendations,
    selMonthExpense,
    selMonthFixed,
    selMonthIncome,
    selMonthVariable,
    selectedMonth,
    setSelectedMonth,
    status,
    totalCardSpendCOP,
    totalDebtRemaining,
    totalSavings,
  } = useFinance();

  return (
    <>
      <div className="cc-page-title">Resumen</div>
      <p className="cc-page-sub">Tu balance general y cómo ha evolucionado mes a mes.</p>

      <div className="cc-section-head">
        <div className="cc-stamp" style={{ color: status.color }}>
          <status.Icon size={16} /> {status.label}
        </div>
        <select className="cc-select" style={{ maxWidth: 160 }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => window.print()}>
          <Landmark size={13} /> Descargar reporte (PDF)
        </button>
      </div>

      <div className="cc-stats-grid">
        <StatCard label="Ingresos del mes" value={fmtCOP(selMonthIncome)} Icon={TrendingUp} color={COLORS.income} bg="var(--income-soft)" />
        <StatCard label="Gastos del mes" value={fmtCOP(selMonthExpense)} Icon={TrendingDown} color={COLORS.expense} bg="var(--expense-soft)" />
        <StatCard label="Gastos fijos" value={fmtCOP(selMonthFixed)} Icon={Landmark} color={COLORS.debt} bg="var(--debt-soft)" sub={selMonthExpense > 0 ? `${((selMonthFixed / selMonthExpense) * 100).toFixed(0)}% del gasto del mes` : undefined} />
        <StatCard label="Gastos variables" value={fmtCOP(selMonthVariable)} Icon={ShoppingBag} color={COLORS.savings} bg="var(--savings-soft)" />
        <StatCard label="Saldo en caja (total)" value={fmtCOP(cashBalance)} Icon={Wallet} color={COLORS.ink} bg="var(--paper)" sub="Ingresos - gastos, histórico" />
        <StatCard label="Ahorro total" value={fmtCOP(totalSavings)} Icon={PiggyBank} color={COLORS.savings} bg="var(--savings-soft)" />
        <StatCard label="Deuda pendiente" value={fmtCOP(totalDebtRemaining)} Icon={CreditCard} color={COLORS.debt} bg="var(--debt-soft)" />
        <StatCard label="Cargado a tarjetas (histórico)" value={fmtCOP(totalCardSpendCOP)} Icon={Landmark} color={COLORS.debt} bg="var(--debt-soft)" sub="Incluye tarjetas en USD, ya convertidas a COP" />
        <StatCard label="Patrimonio neto" value={fmtCOP(netWorth)} Icon={LayoutDashboard} color={COLORS.ink} bg="var(--paper)" sub="Caja + ahorro - deuda" />
      </div>

      <div className="cc-charts-grid">
        <div className="cc-card">
          <p className="cc-chart-title">Ingresos vs. gastos</p>
          <p className="cc-chart-sub">Últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthlyIncomeExpense} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={46} />
              <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Ingresos" fill={COLORS.income} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Gastos" fill={COLORS.expense} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="cc-card">
          <p className="cc-chart-title">Gastos por categoría</p>
          <p className="cc-chart-sub">{monthLabel(selectedMonth)}</p>
          {pieData.length === 0 ? (
            <EmptyState Icon={ShoppingBag} title="Sin gastos este mes" text="Registra un gasto para ver la distribución." />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                  {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11.5 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="cc-card" style={{ gridColumn: '1 / -1' }}>
          <p className="cc-chart-title">Ahorro acumulado vs. deuda pendiente</p>
          <p className="cc-chart-sub">Últimos 6 meses</p>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={equityEvolution} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={46} />
              <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Ahorro" stroke={COLORS.income} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Deuda" stroke={COLORS.debt} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/*
        Lo que ya está comprometido hacia adelante. Antes una compra a 12 cuotas
        solo mostraba la cuota registrada: nunca se veía que marzo ya venía con
        plata separada.
      */}
      <div className="cc-card" style={{ marginBottom: 22 }}>
        <p className="cc-chart-title">Lo que ya tienes comprometido</p>
        <p className="cc-chart-sub">Cuotas pendientes y gastos fijos de los próximos 6 meses</p>
        {commitments.every((c) => c.total === 0) ? (
          <EmptyState
            Icon={Repeat}
            title="Nada comprometido todavía"
            text="Cuando registres gastos fijos o compras a cuotas, aquí verás cuánto de cada mes que viene ya está apartado."
          />
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={commitments.map((c) => ({
                label: monthLabel(c.monthKey), Cuotas: c.installments, 'Gastos fijos': c.fixed,
              }))} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={46} />
                <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Gastos fijos" stackId="c" fill={COLORS.debt} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Cuotas" stackId="c" fill={COLORS.savings} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="cc-commit-list">
              {commitments.filter((c) => c.items.length > 0).map((c) => (
                <div key={c.monthKey} className="cc-commit-row">
                  <span className="cc-commit-month">{monthLabel(c.monthKey)}</span>
                  <span className="cc-commit-detail">
                    {c.items.map((it) => `${it.note || getCategory(it.category).label} (cuota ${it.cuota}/${it.de})`).join(' · ')}
                  </span>
                  <span className="cc-commit-total">{fmtCOP(c.total)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="cc-card">
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
