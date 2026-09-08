import { PAYMENT_METHODS, getCategory } from '../../lib/categories.js';
import { useFinance } from '../../state/financeStore';

/*
 * Crear o editar un gasto fijo. Ver components/Modal.jsx para el porqué de la
 * ventana flotante.
 */
export default function FormGastoFijo() {
  const {
    fixedForm, setFixedForm, editingFixedId,
    handleAddFixedExpense, handleCancelFixedForm,
    allExpenseCategories, creditCards,
  } = useFinance();

  return (
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
  );
}
