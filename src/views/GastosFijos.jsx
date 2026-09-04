import { Plus, Trash2, Check, X, Pencil, Repeat } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { PAYMENT_METHODS, getCategory, getPaymentMethod } from '../lib/categories.js';
import { fmtCOP } from '../lib/money.js';
import IconCircle from '../components/IconCircle';
import StatCard from '../components/StatCard';
import { useFinance } from '../state/financeStore';
export default function GastosFijos() {
  const {
    allExpenseCategories,
    cardLabel,
    creditCards,
    editingFixedId,
    findFixedExpensePaidThisMonth,
    fixedExpenses,
    fixedForm,
    handleAddFixedExpense,
    handleCancelFixedForm,
    handleDeleteFixedExpense,
    handleEditFixedExpense,
    handleMarkFixedExpensePaid,
    handleUndoFixedExpensePaid,
    setFixedForm,
    setShowFixedForm,
    showFixedForm,
  } = useFinance();

  const totalMensual = fixedExpenses.reduce((s, f) => s + f.amount, 0);
  const pagadosCount = fixedExpenses.filter((f) => findFixedExpensePaidThisMonth(f.id)).length;
  return (
    <>
      <div className="cc-page-title">Gastos fijos</div>
      <p className="cc-page-sub">Tus gastos que se repiten cada mes (gimnasio, mensualidades, suscripciones). Márcalos como pagados en vez de crear un movimiento nuevo cada vez.</p>

      <div className="cc-stats-grid" style={{ marginBottom: 18 }}>
        <StatCard label="Total en gastos fijos" value={fmtCOP(totalMensual)} Icon={Repeat} color={COLORS.debt} bg="var(--debt-soft)" sub={`${fixedExpenses.length} gasto(s) registrados`} />
        <StatCard label="Pagados este mes" value={`${pagadosCount}/${fixedExpenses.length}`} Icon={Check} color={COLORS.income} bg="var(--income-soft)" />
      </div>

      <button type="button" className="cc-btn cc-btn-primary" onClick={() => (showFixedForm ? handleCancelFixedForm() : setShowFixedForm(true))}>
        {showFixedForm ? <X size={15} /> : <Plus size={15} />} {showFixedForm ? 'Cancelar' : 'Nuevo gasto fijo'}
      </button>

      {showFixedForm && (
        <form className="cc-form" onSubmit={handleAddFixedExpense}>
          <div className="cc-field">
            <label>Nombre</label>
            <input className="cc-input" type="text" placeholder="Gimnasio, Netflix, arriendo..." value={fixedForm.name} onChange={(e) => setFixedForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="cc-field">
            <label>Categoría</label>
            <select className="cc-select" value={fixedForm.category} onChange={(e) => setFixedForm((f) => ({ ...f, category: e.target.value }))}>
              {allExpenseCategories.map((c) => <option key={c.id} value={c.id}>{getCategory(c.id).label}</option>)}
            </select>
          </div>
          <div className="cc-field">
            <label>Monto (COP)</label>
            <input className="cc-input" type="number" min="0" step="any" placeholder="50000" value={fixedForm.amount} onChange={(e) => setFixedForm((f) => ({ ...f, amount: e.target.value }))} required />
          </div>
          <div className="cc-field">
            <label>Día de pago (opcional)</label>
            <input className="cc-input" type="number" min="1" max="31" placeholder="5" value={fixedForm.dueDay} onChange={(e) => setFixedForm((f) => ({ ...f, dueDay: e.target.value }))} />
          </div>
          <div className="cc-field">
            <label>Medio de pago</label>
            <select className="cc-select" value={fixedForm.paymentMethod} onChange={(e) => setFixedForm((f) => ({ ...f, paymentMethod: e.target.value, cardId: e.target.value === 'credito' ? f.cardId : '' }))}>
              {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {fixedForm.paymentMethod === 'credito' && (
            <div className="cc-field">
              <label>Tarjeta</label>
              {creditCards.length === 0 ? (
                <div className="cc-stat-sub">Sin tarjetas registradas.</div>
              ) : (
                <select className="cc-select" value={fixedForm.cardId} onChange={(e) => setFixedForm((f) => ({ ...f, cardId: e.target.value }))}>
                  <option value="">Selecciona una tarjeta</option>
                  {creditCards.map((c) => <option key={c.id} value={c.id}>{c.name} *{c.lastFour}</option>)}
                </select>
              )}
            </div>
          )}
          <div className="cc-form-actions">
            <button type="submit" className="cc-btn cc-btn-primary">{editingFixedId ? 'Guardar cambios' : 'Guardar gasto fijo'}</button>
            {editingFixedId && <button type="button" className="cc-btn cc-btn-outline" onClick={handleCancelFixedForm}>Cancelar edición</button>}
          </div>
        </form>
      )}

      {fixedExpenses.length === 0 ? (
        <p className="cc-stat-sub">Aún no tienes gastos fijos registrados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {fixedExpenses.map((fe) => {
            const cat = getCategory(fe.category);
            const paidTx = findFixedExpensePaidThisMonth(fe.id);
            return (
              <div key={fe.id} className="cc-fixed-row">
                <div className="cc-fixed-row-main">
                  <IconCircle Icon={cat.icon} color={cat.color} bg="var(--expense-soft)" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="cc-tx-cat">{fe.name}</div>
                    <div className="cc-tx-note">
                      {cat.label} · <span className="cc-mono">{fmtCOP(fe.amount)}</span>
                      {fe.dueDay ? ` · paga el día ${fe.dueDay}` : ''}
                    </div>
                    <div className="cc-tx-tags">
                      <span className="cc-tag">{getPaymentMethod(fe.paymentMethod).label}{fe.cardId ? ` · ${cardLabel(fe.cardId)}` : ''}</span>
                      {paidTx && <span className="cc-tag" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}>Pagado este mes ✓</span>}
                    </div>
                  </div>
                </div>
                <div className="cc-fixed-row-actions">
                  {paidTx ? (
                    <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleUndoFixedExpensePaid(fe)}>Deshacer</button>
                  ) : (
                    <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleMarkFixedExpensePaid(fe)}>Marcar como pagado</button>
                  )}
                  <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleEditFixedExpense(fe)} aria-label="Editar gasto fijo">
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteFixedExpense(fe.id)} aria-label="Eliminar gasto fijo">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

}
