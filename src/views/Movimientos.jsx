import { ArrowLeftRight, Plus, Trash2, AlertTriangle, X, Pencil } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, getCategory, getPaymentMethod } from '../lib/categories.js';
import { monthLabel, computeChargeDate, formatDateHuman } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import IconCircle from '../components/IconCircle';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';
export default function Movimientos() {
  const {
    availableMonths,
    cardLabel,
    creditCards,
    editingTxId,
    filteredTx,
    handleAddTransaction,
    handleCancelTxForm,
    handleDeleteTransaction,
    handleEditTransaction,
    setShowTxForm,
    setTxFilters,
    setTxForm,
    showTxForm,
    txChargeDate,
    txEffectiveRate,
    txFilterCategories,
    txFilters,
    txForm,
    txFormCategories,
    txFormError,
    txIsUSD,
    usdRate,
  } = useFinance();

  return (
    <>
      <div className="cc-section-head">
        <div>
          <div className="cc-page-title">Movimientos</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>Todos tus ingresos y gastos registrados.</p>
        </div>
        <button type="button" className="cc-btn cc-btn-primary" onClick={() => (showTxForm ? handleCancelTxForm() : setShowTxForm(true))}>
          {showTxForm ? <X size={15} /> : <Plus size={15} />} {showTxForm ? 'Cancelar' : 'Nuevo movimiento'}
        </button>
      </div>

      {showTxForm && (
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
      )}

      <div className="cc-filters">
        <select className="cc-select" value={txFilters.type} onChange={(e) => setTxFilters((f) => ({ ...f, type: e.target.value, category: 'todas' }))}>
          <option value="todos">Todos los tipos</option>
          <option value="ingreso">Ingresos</option>
          <option value="gasto">Gastos</option>
        </select>
        <select className="cc-select" value={txFilters.month} onChange={(e) => setTxFilters((f) => ({ ...f, month: e.target.value }))}>
          <option value="todos">Todos los meses</option>
          {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select className="cc-select" value={txFilters.category} onChange={(e) => setTxFilters((f) => ({ ...f, category: e.target.value }))}>
          <option value="todas">Todas las categorías</option>
          {txFilterCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select className="cc-select" value={txFilters.paymentMethod} onChange={(e) => setTxFilters((f) => ({ ...f, paymentMethod: e.target.value }))}>
          <option value="todos">Todos los medios de pago</option>
          {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <select className="cc-select" value={txFilters.fixed} onChange={(e) => setTxFilters((f) => ({ ...f, fixed: e.target.value }))}>
          <option value="todos">Fijos y variables</option>
          <option value="fijo">Solo fijos</option>
          <option value="variable">Solo variables</option>
        </select>
        <div className="cc-day-filter">
          <input
            type="date"
            value={txFilters.day}
            onChange={(e) => setTxFilters((f) => ({ ...f, day: e.target.value }))}
          />
          {!txFilters.day && <span className="cc-day-filter-placeholder">Filtrar por día</span>}
          {txFilters.day && (
            <button type="button" className="cc-day-filter-clear" onClick={() => setTxFilters((f) => ({ ...f, day: '' }))} aria-label="Quitar filtro de día">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {filteredTx.length === 0 ? (
        <EmptyState Icon={ArrowLeftRight} title="No hay movimientos" text="Agrega tu primer ingreso o gasto para empezar a llevar el registro." />
      ) : (
        <div className="cc-tx-list">
          {filteredTx.map((t) => {
            const cat = getCategory(t.category);
            return (
              <div key={t.id} className="cc-tx-row">
                <IconCircle Icon={cat.icon} color={cat.color} bg={t.type === 'ingreso' ? 'var(--income-soft)' : 'var(--expense-soft)'} />
                <div>
                  <div className="cc-tx-cat">{cat.label}</div>
                  <div className="cc-tx-note">
                    {t.note || '—'} · <span className="cc-tx-date">{t.date}</span>
                  </div>
                  {(t.type === 'gasto' && t.paymentMethod) || t.isFixed || t.isInstallment || t.currency === 'USD' ? (
                    <div className="cc-tx-tags">
                      {t.type === 'gasto' && t.paymentMethod && (
                        <span className="cc-tag">{getPaymentMethod(t.paymentMethod).label}{t.cardId ? ` · ${cardLabel(t.cardId)}` : ''}</span>
                      )}
                      {t.isFixed && <span className="cc-tag cc-tag-fixed">Fijo</span>}
                      {t.isInstallment && (
                        <span className="cc-tag cc-tag-installment">
                          Cuota {t.currentInstallment || '?'}/{t.totalInstallments || '?'}
                          {t.interestRate != null ? ` · ${t.interestRate}% mensual` : ''}
                        </span>
                      )}
                      {t.currency === 'USD' && (
                        <span className="cc-tag">
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(t.originalAmount || 0)}
                          {t.exchangeRateUsed ? ` · tasa ${fmtCOP(t.exchangeRateUsed)}` : ''}
                        </span>
                      )}
                      {(() => {
                        const c = t.cardId ? creditCards.find((cc) => cc.id === t.cardId) : null;
                        const chargeDate = c && c.cutDay && c.paymentDay ? computeChargeDate(t.date, c.cutDay, c.paymentDay) : null;
                        return chargeDate ? <span className="cc-tag">Se cobra: {formatDateHuman(chargeDate)}</span> : null;
                      })()}
                    </div>
                  ) : null}
                </div>
                <div className="cc-tx-amount" style={{ color: t.type === 'ingreso' ? COLORS.income : COLORS.expense }}>
                  {t.type === 'ingreso' ? '+' : '-'}{fmtCOP(t.amount)}
                </div>
                <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleEditTransaction(t)} aria-label="Editar movimiento">
                  <Pencil size={14} />
                </button>
                <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteTransaction(t.id)} aria-label="Eliminar movimiento">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

}
