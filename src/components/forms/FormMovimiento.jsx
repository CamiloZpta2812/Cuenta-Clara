import { AlertTriangle } from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from '../../lib/categories.js';
import { formatDateHuman } from '../../lib/dates.js';
import { fmtCOP } from '../../lib/money.js';
import { useFinance } from '../../state/financeStore';

/*
 * Registrar un ingreso o un gasto.
 *
 * Vivía dentro de Movimientos, empujando la lista fuera de la vista al abrirlo.
 * Ahora es una ventana y se puede abrir desde cualquier pantalla: registrar un
 * gasto es lo que uno hace diez veces al día, y no debería obligar a navegar.
 */
export default function FormMovimiento() {
  const {
    txForm, setTxForm, txFormError, editingTxId,
    handleAddTransaction, handleCancelTxForm,
    creditCards, usdRate,
    txFormCategories, txIsUSD, txEffectiveRate, txChargeDate,
  } = useFinance();

  return (
    <form className="cc-form" onSubmit={handleAddTransaction}>
      <div className="cc-type-toggle">
        <button type="button" className={`cc-type-btn ${txForm.type === 'gasto' ? 'active-gasto' : ''}`} onClick={() => setTxForm((f) => ({ ...f, type: 'gasto', category: EXPENSE_CATEGORIES[0].id }))}>Gasto</button>
        <button type="button" className={`cc-type-btn ${txForm.type === 'ingreso' ? 'active-ingreso' : ''}`} onClick={() => setTxForm((f) => ({ ...f, type: 'ingreso', category: INCOME_CATEGORIES[0].id }))}>Ingreso</button>
      </div>
      <div className="cc-field">
        <label>
          {txForm.isInstallment
            ? `Monto total de la compra (${txIsUSD ? 'USD' : 'COP'})`
            : `Monto (${txIsUSD ? 'USD' : 'COP'})`}
        </label>
        <input className="cc-input" type="number" min="0" step="any" placeholder="50000" value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))} required />
        {txIsUSD && txForm.amount && txEffectiveRate > 0 && (
          <span className="cc-stat-sub" style={{ fontSize: 11 }}>
            ≈ {fmtCOP(parseFloat(txForm.amount) * txEffectiveRate)}{txForm.isInstallment && txForm.totalInstallments ? ` en total · cuota ≈ ${fmtCOP((parseFloat(txForm.amount) * txEffectiveRate) / parseInt(txForm.totalInstallments, 10))}` : ''}
          </span>
        )}
        {!txIsUSD && txForm.isInstallment && txForm.amount && txForm.totalInstallments && (
          <span className="cc-stat-sub" style={{ fontSize: 11 }}>
            Cuota mensual ≈ {fmtCOP(parseFloat(txForm.amount) / parseInt(txForm.totalInstallments, 10))}
          </span>
        )}
      </div>
      <div className="cc-field">
        <label>Categoría</label>
        <select className="cc-select" value={txForm.category} onChange={(e) => setTxForm((f) => ({ ...f, category: e.target.value }))}>
          {txFormCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="cc-field">
        <label>Fecha</label>
        <input className="cc-input" type="date" value={txForm.date} onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))} />
      </div>
      <div className="cc-field">
        <label>Nota (opcional)</label>
        <input className="cc-input" type="text" placeholder="Detalle breve" value={txForm.note} onChange={(e) => setTxForm((f) => ({ ...f, note: e.target.value }))} />
      </div>
      {txForm.type === 'gasto' && (
        <>
          <div className="cc-field">
            <label>Medio de pago</label>
            <select className="cc-select" value={txForm.paymentMethod} onChange={(e) => setTxForm((f) => ({ ...f, paymentMethod: e.target.value, cardId: e.target.value === 'credito' ? f.cardId : '', isInstallment: e.target.value === 'credito' ? f.isInstallment : false }))}>
              {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {txForm.paymentMethod === 'credito' && (
            <>
              <div className="cc-field">
                <label>Tarjeta</label>
                {creditCards.length === 0 ? (
                  <div className="cc-stat-sub">Sin tarjetas registradas. Agrégalas en la pestaña Tarjetas.</div>
                ) : (
                  <select className="cc-select" value={txForm.cardId} onChange={(e) => setTxForm((f) => ({ ...f, cardId: e.target.value }))}>
                    <option value="">Selecciona una tarjeta</option>
                    {creditCards.map((c) => <option key={c.id} value={c.id}>{c.name} *{c.lastFour}{c.currency === 'USD' ? ' (USD)' : ''}</option>)}
                  </select>
                )}
                {txChargeDate && (
                  <span className="cc-stat-sub" style={{ fontSize: 11 }}>Se cobraría el {formatDateHuman(txChargeDate)}</span>
                )}
              </div>
              {txIsUSD && (
                <div className="cc-field">
                  <label>Tasa de cambio (COP por USD)</label>
                  <input
                    className="cc-input"
                    type="number"
                    min="0"
                    step="any"
                    placeholder={usdRate ? String(Math.round(usdRate)) : 'Ej. 4050'}
                    value={txForm.exchangeRate}
                    onChange={(e) => setTxForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                  />
                  <span className="cc-stat-sub" style={{ fontSize: 11 }}>
                    {usdRate ? `Tasa del día: ≈ ${fmtCOP(usdRate)} por USD. Puedes ajustarla si tu banco usa otra.` : 'No se pudo obtener la tasa automáticamente, ingrésala manualmente.'}
                  </span>
                </div>
              )}
              <div className="cc-field" style={{ justifyContent: 'flex-end' }}>
                <label className="cc-checkbox-field" style={{ textTransform: 'none' }}>
                  <input type="checkbox" checked={txForm.isInstallment} onChange={(e) => setTxForm((f) => ({ ...f, isInstallment: e.target.checked }))} />
                  Es una compra en cuotas
                </label>
              </div>
              {txForm.isInstallment && (
                <>
                  <div className="cc-field">
                    <label>Número total de cuotas</label>
                    <input className="cc-input" type="number" min="1" step="1" placeholder="12" value={txForm.totalInstallments} onChange={(e) => setTxForm((f) => ({ ...f, totalInstallments: e.target.value }))} />
                  </div>
                  <div className="cc-field">
                    <label>Cuota actual</label>
                    <input className="cc-input" type="number" min="1" step="1" placeholder="1" value={txForm.currentInstallment} onChange={(e) => setTxForm((f) => ({ ...f, currentInstallment: e.target.value }))} />
                    <span className="cc-stat-sub" style={{ fontSize: 11 }}>Si es una compra vieja y ya vas en la cuota 7 de 10, escribe 7 aquí.</span>
                  </div>
                  <div className="cc-field">
                    <label>Tasa de interés mensual % (opcional)</label>
                    <input className="cc-input" type="number" min="0" step="any" placeholder="2.08" value={txForm.interestRate} onChange={(e) => setTxForm((f) => ({ ...f, interestRate: e.target.value }))} />
                    <span className="cc-stat-sub" style={{ fontSize: 11 }}>Cada compra puede tener su propia tasa, distinta a la de otras compras.</span>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
      {txFormError && (
        <div className="cc-form-error cc-field-full" role="alert">
          <AlertTriangle size={15} /> {txFormError}
        </div>
      )}
      <div className="cc-form-actions">
        <button type="submit" className="cc-btn cc-btn-primary">{editingTxId ? 'Guardar cambios' : 'Guardar movimiento'}</button>
        {editingTxId && <button type="button" className="cc-btn cc-btn-outline" onClick={handleCancelTxForm}>Cancelar edición</button>}
      </div>
    </form>
  );
}
