import { CreditCard, Plus, Trash2, AlertTriangle, X } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { fmtCOP, fmtMoney } from '../lib/money.js';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';
export default function Deudas() {
  const {
    debtForm,
    debtFormError,
    debtRemainingCOP,
    debts,
    handleAddDebt,
    handleAddPayment,
    handleDeleteDebt,
    paymentInputs,
    setDebtForm,
    setDebtFormError,
    setPaymentInputs,
    setShowDebtForm,
    showDebtForm,
    usdRate,
  } = useFinance();

  return (
    <>
      <div className="cc-section-head">
        <div>
          <div className="cc-page-title">Deudas</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>Lo que debes y cómo vas pagándolo.</p>
        </div>
        <button type="button" className="cc-btn cc-btn-primary" onClick={() => { setDebtFormError(''); setShowDebtForm((v) => !v); }}>
          {showDebtForm ? <X size={15} /> : <Plus size={15} />} {showDebtForm ? 'Cancelar' : 'Nueva deuda'}
        </button>
      </div>

      {showDebtForm && (
        <form className="cc-form" onSubmit={handleAddDebt}>
          <div className="cc-field cc-field-full">
            <label>Nombre</label>
            <input className="cc-input" type="text" placeholder="Tarjeta de crédito, préstamo..." value={debtForm.name} onChange={(e) => setDebtForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="cc-field">
            <label>Moneda</label>
            <select className="cc-select" value={debtForm.currency} onChange={(e) => setDebtForm((f) => ({ ...f, currency: e.target.value }))}>
              <option value="COP">Pesos colombianos (COP)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div className="cc-field">
            <label>Monto total ({debtForm.currency})</label>
            <input className="cc-input" type="number" min="0" step="any" value={debtForm.totalAmount} onChange={(e) => setDebtForm((f) => ({ ...f, totalAmount: e.target.value }))} required />
          </div>
          {debtForm.currency === 'USD' && (
            <div className="cc-field">
              <label>Tasa de cambio (COP por USD)</label>
              <input
                className="cc-input"
                type="number"
                min="0"
                step="any"
                placeholder={usdRate ? String(Math.round(usdRate)) : 'Ej. 4050'}
                value={debtForm.exchangeRate}
                onChange={(e) => setDebtForm((f) => ({ ...f, exchangeRate: e.target.value }))}
              />
              <span className="cc-stat-sub" style={{ fontSize: 11 }}>
                {usdRate ? `Tasa del día: ≈ ${fmtCOP(usdRate)} por USD. Se usa para mostrar esta deuda junto a las demás en COP.` : 'Ingrésala manualmente.'}
              </span>
            </div>
          )}
          <div className="cc-field">
            <label>Tasa de interés (% mensual)</label>
            <input className="cc-input" type="number" min="0" step="any" placeholder="Opcional" value={debtForm.interestRate} onChange={(e) => setDebtForm((f) => ({ ...f, interestRate: e.target.value }))} />
          </div>
          <div className="cc-field">
            <label>Cuota mensual ({debtForm.currency})</label>
            <input className="cc-input" type="number" min="0" step="any" placeholder="Opcional" value={debtForm.monthlyPayment} onChange={(e) => setDebtForm((f) => ({ ...f, monthlyPayment: e.target.value }))} />
          </div>
          <div className="cc-field">
            <label>Día de pago del mes</label>
            <input className="cc-input" type="number" min="1" max="31" placeholder="Opcional" value={debtForm.dueDay} onChange={(e) => setDebtForm((f) => ({ ...f, dueDay: e.target.value }))} />
          </div>
          <div className="cc-field">
            <label>Fecha en que adquiriste la deuda</label>
            <input className="cc-input" type="date" value={debtForm.startDate} onChange={(e) => setDebtForm((f) => ({ ...f, startDate: e.target.value }))} />
          </div>
          {debtFormError && (
            <div className="cc-form-error cc-field-full" role="alert">
              <AlertTriangle size={15} /> {debtFormError}
            </div>
          )}
          <div className="cc-form-actions">
            <button type="submit" className="cc-btn cc-btn-primary">Guardar deuda</button>
          </div>
        </form>
      )}

      {debts.length === 0 ? (
        <EmptyState Icon={CreditCard} title="No tienes deudas registradas" text="Agrega una deuda para hacerle seguimiento a tus abonos y al interés que genera." />
      ) : (
        debts.map((d) => {
          const paid = d.payments.reduce((s, p) => s + p.amount, 0);
          const remaining = Math.max(0, parseFloat(d.totalAmount) - paid);
          const pct = Math.min(100, (paid / parseFloat(d.totalAmount)) * 100);
          const isUSD = d.currency === 'USD';
          return (
            <div key={d.id} className="cc-debt-card">
              <div className="cc-goal-head">
                <div>
                  <div className="cc-goal-name">{d.name}{isUSD ? ' · USD' : ''}</div>
                  <div className="cc-goal-meta">
                    {d.interestRate ? `${d.interestRate}% mensual · ` : ''}
                    {d.monthlyPayment ? `cuota ${fmtMoney(d.monthlyPayment, d.currency)} · ` : ''}
                    {d.dueDay ? `paga el día ${d.dueDay}` : 'sin fecha de pago fija'}
                  </div>
                </div>
                <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteDebt(d.id)} aria-label="Eliminar deuda"><Trash2 size={15} /></button>
              </div>
              <div className="cc-progress-track"><div className="cc-progress-fill" style={{ width: `${pct}%`, background: COLORS.debt }} /></div>
              <div className="cc-goal-nums">
                <span>Pagado: {fmtMoney(paid, d.currency)}</span>
                <span>Restante: {fmtMoney(remaining, d.currency)}</span>
                <span>Total: {fmtMoney(d.totalAmount, d.currency)}</span>
              </div>
              {isUSD && (
                <div className="cc-stat-sub" style={{ marginTop: 4 }}>
                  ≈ {fmtCOP(debtRemainingCOP(d))} restante en pesos (tasa {fmtCOP(d.exchangeRate)}/USD)
                </div>
              )}
              <div className="cc-inline-form">
                <input className="cc-input" type="number" min="0" step="any" placeholder={`Monto del abono (${d.currency})`} value={paymentInputs[d.id] || ''} onChange={(e) => setPaymentInputs((p) => ({ ...p, [d.id]: e.target.value }))} />
                <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleAddPayment(d.id)}>Registrar abono</button>
              </div>
            </div>
          );
        })
      )}
    </>
  );

}
