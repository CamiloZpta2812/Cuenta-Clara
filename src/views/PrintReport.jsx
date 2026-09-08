import { getCategory } from '../lib/categories.js';
import { monthKeyFromDate, monthLabel, formatDateHuman } from '../lib/dates.js';
import { fmtCOP, fmtMoney } from '../lib/money.js';
import { useFinance } from '../state/financeStore';
export default function PrintReport() {
  const {
    cashBalance,
    debtRemainingCOP,
    debts,
    netWorth,
    pieData,
    recommendations,
    buckets,
    selMonthExpense,
    selMonthFixed,
    selMonthIncome,
    selMonthVariable,
    selectedMonth,
    totalDebtRemaining,
    totalSavings,
    transactions,
  } = useFinance();

  const monthTx = transactions
    .filter((t) => monthKeyFromDate(t.date) === selectedMonth)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const netMonth = selMonthIncome - selMonthExpense;
  return (
    <div className="cc-print-report">
      <h1>AlDía — Reporte financiero</h1>
      <p className="cc-print-sub">Mes: {monthLabel(selectedMonth)} · Generado el {formatDateHuman(new Date())}</p>

      <h2>Resumen del mes</h2>
      <table className="cc-print-table">
        <tbody>
          <tr><td>Ingresos</td><td>{fmtCOP(selMonthIncome)}</td></tr>
          <tr><td>Gastos totales</td><td>{fmtCOP(selMonthExpense)}</td></tr>
          <tr><td>&nbsp;&nbsp;Gastos fijos</td><td>{fmtCOP(selMonthFixed)}</td></tr>
          <tr><td>&nbsp;&nbsp;Gastos variables</td><td>{fmtCOP(selMonthVariable)}</td></tr>
          <tr><td><strong>Balance del mes</strong></td><td><strong>{fmtCOP(netMonth)}</strong></td></tr>
        </tbody>
      </table>

      <h2>Posición general</h2>
      <table className="cc-print-table">
        <tbody>
          <tr><td>Saldo en caja (histórico)</td><td>{fmtCOP(cashBalance)}</td></tr>
          <tr><td>Ahorro total</td><td>{fmtCOP(totalSavings)}</td></tr>
          <tr><td>Deuda pendiente</td><td>{fmtCOP(totalDebtRemaining)}</td></tr>
          <tr><td><strong>Patrimonio neto</strong></td><td><strong>{fmtCOP(netWorth)}</strong></td></tr>
        </tbody>
      </table>

      {pieData.length > 0 && (
        <>
          <h2>Gastos por categoría</h2>
          <table className="cc-print-table">
            <tbody>
              {pieData.map((p) => (
                <tr key={p.name}><td>{p.name}</td><td>{fmtCOP(p.value)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {debts.length > 0 && (
        <>
          <h2>Deudas</h2>
          <table className="cc-print-table">
            <thead><tr><th>Deuda</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Pendiente (COP)</th></tr></thead>
            <tbody>
              {debts.map((d) => {
                const paid = (d.payments || []).reduce((s, p) => s + p.amount, 0);
                const remaining = Math.max(0, d.totalAmount - paid);
                return (
                  <tr key={d.id}>
                    <td>{d.name}{d.currency === 'USD' ? ' (USD)' : ''}</td>
                    <td>{fmtMoney(d.totalAmount, d.currency)}</td>
                    <td>{fmtMoney(paid, d.currency)}</td>
                    <td>{fmtMoney(remaining, d.currency)}</td>
                    <td>{d.currency === 'USD' ? fmtCOP(debtRemainingCOP(d)) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {buckets.length > 0 && (
        <>
          <h2>Ahorro y colchones</h2>
          <table className="cc-print-table">
            <thead>
              <tr><th>Nombre</th><th>Tipo</th><th>Al mes (tu parte)</th><th>Acumulado</th></tr>
            </thead>
            <tbody>
              {buckets.map((b) => {
                const acumulado = (b.contributions || []).reduce((s, c) => s + c.amount, 0);
                const mio = (Number(b.monthlyAmount) || 0)
                  - (b.shares || []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
                return (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>
                      {b.kind === 'colchon' ? 'Colchón' : 'Meta'}
                      {b.movesCash === false ? ' (reserva)' : ''}
                      {b.liquid === false ? ' · amarrado' : ''}
                    </td>
                    <td>{fmtCOP(mio)}</td>
                    {/* Una reserva no acumula: la plata nunca se movió de la cuenta. */}
                    <td>{b.movesCash === false ? '—' : fmtCOP(acumulado)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {recommendations.length > 0 && (
        <>
          <h2>Recomendaciones</h2>
          <ul className="cc-print-list">
            {recommendations.map((r, i) => <li key={i}>{r.text}</li>)}
          </ul>
        </>
      )}

      <h2>Movimientos del mes ({monthTx.length})</h2>
      <table className="cc-print-table cc-print-table-tx">
        <thead><tr><th>Fecha</th><th>Categoría</th><th>Nota</th><th>Monto</th></tr></thead>
        <tbody>
          {monthTx.map((t) => (
            <tr key={t.id}>
              <td>{t.date}</td>
              <td>{getCategory(t.category).label}</td>
              <td>{t.note || '—'}</td>
              <td>{t.type === 'ingreso' ? '+' : '-'}{fmtCOP(t.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

}
