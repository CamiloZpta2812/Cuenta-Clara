import { Plus, Trash2 } from 'lucide-react';
import { PAYMENT_METHODS, getCategory } from '../../lib/categories.js';
import { fmtCOP } from '../../lib/money.js';
import { useFinance } from '../../state/financeStore';

/* Valor centinela del selector: no es una persona, es "crear una". */
const NUEVA = '__nueva__';

/*
 * Crear o editar un gasto fijo. Ver components/Modal.jsx para el porqué de la
 * ventana flotante.
 */
export default function FormGastoFijo() {
  const {
    fixedForm, setFixedForm, editingFixedId,
    handleAddFixedExpense, handleCancelFixedForm,
    allExpenseCategories, creditCards, people,
    handleAddFixedShare: onAgregarReparto,
    handleUpdateFixedShare: onCambiarReparto,
    handleRemoveFixedShare: onQuitarReparto,
    handleAddPerson: onAgregarPersona,
  } = useFinance();

  const compartido = (fixedForm.shares || []).length > 0;
  /* Tu parte no se escribe: es el total menos lo que ponen los demás. */
  const miParte = (parseFloat(fixedForm.totalAmount) || 0)
    - (fixedForm.shares || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

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
        <label>{compartido ? 'Cuánto cobran en total' : 'Monto (COP)'}</label>
        <input
          className="cc-input" type="number" min="0" step="any" placeholder="50000" required
          value={fixedForm.totalAmount}
          onChange={(e) => setFixedForm((f) => ({ ...f, totalAmount: e.target.value }))}
        />
        {compartido && (
          <span className="cc-stat-sub" style={{ fontSize: 11 }}>
            El valor completo del servicio, no tu parte. Tu parte se resta abajo.
          </span>
        )}
      </div>

      {/*
        * El reparto.
        *
        * No se podía editar en ninguna parte: existía solo porque lo había
        * creado un script, así que subirle el precio a una suscripción
        * compartida obligaba a abrir la base de datos. Y tu parte no se
        * escribe, se resta — es lo que impide que el total y el reparto se
        * contradigan entre sí.
        */}
      <div className="cc-field cc-field-full">
        <label>¿Lo compartes con alguien?</label>

        {(fixedForm.shares || []).length === 0 && (
          <span className="cc-stat-sub" style={{ fontSize: 11 }}>
            Si alguien te devuelve una parte, agrégala aquí y aparecerá en Cobros.
          </span>
        )}

        {(fixedForm.shares || []).map((r) => (
          <div key={r.id} className="cc-reparto-fila">
            <select
              className="cc-select" value={r.personId}
              onChange={(e) => {
                if (e.target.value !== NUEVA) {
                  onCambiarReparto(r.id, { personId: e.target.value });
                  return;
                }
                /*
                 * Crear la persona aquí mismo. Mandar a crearla en otra
                 * pantalla para poder repartir un gasto es el rodeo por el que
                 * uno termina no repartiéndolo.
                 */
                // eslint-disable-next-line no-alert
                const nombre = window.prompt('¿Cómo se llama?');
                const id = onAgregarPersona(nombre);
                if (id) onCambiarReparto(r.id, { personId: id });
              }}
            >
              <option value="">¿Quién?</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value={NUEVA}>Alguien más…</option>
            </select>
            <input
              className="cc-input" type="number" min="0" step="any" placeholder="Su parte"
              value={r.amount}
              onChange={(e) => onCambiarReparto(r.id, { amount: e.target.value })}
            />
            <button
              type="button" className="cc-btn cc-btn-outline cc-btn-sm"
              onClick={() => onQuitarReparto(r.id)} aria-label="Quitar del reparto"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}

        <div className="cc-reparto-pie">
          <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={onAgregarReparto}>
            <Plus size={14} /> Agregar a alguien
          </button>
          {compartido && (
            <span className={miParte < 0 ? 'cc-reparto-mal' : 'cc-stat-sub'}>
              {miParte < 0
                ? 'El reparto suma más que el total.'
                : <>Tu parte: <strong className="cc-mono">{fmtCOP(miParte)}</strong></>}
            </span>
          )}
        </div>
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
