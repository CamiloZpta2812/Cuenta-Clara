import { AlertTriangle, Users, Plus } from 'lucide-react';
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

/*
 * Dividir la cuenta.
 *
 * Pagas tú la cuenta del restaurante y los demás te transfieren su parte. El
 * movimiento guarda el total —es lo que salió de tu cuenta—, cada amigo queda
 * debiéndote lo suyo en Cobros, y para juzgar el mes solo cuenta lo tuyo.
 */
function DividirCuenta({ txForm, setTxForm, people, onAgregarPersona }) {
  const split = txForm.split || { personIds: [], mode: 'iguales', includeMe: true, amounts: {} };
  const abierto = split.personIds.length > 0 || split.abierto;
  const total = parseFloat(txForm.amount) || 0;
  const set = (cambios) => setTxForm((f) => ({ ...f, split: { ...split, ...cambios } }));

  const alternar = (id) => set({
    personIds: split.personIds.includes(id)
      ? split.personIds.filter((x) => x !== id)
      : [...split.personIds, id],
  });

  const partes = split.personIds.length + (split.includeMe === false ? 0 : 1);
  const cadaUno = partes > 0 ? Math.round(total / partes) : 0;
  const deEllos = split.mode === 'montos'
    ? split.personIds.reduce((s, id) => s + (parseFloat((split.amounts || {})[id]) || 0), 0)
    : cadaUno * split.personIds.length;
  const tuParte = total - deEllos;

  if (!abierto) {
    return (
      <div className="cc-field cc-field-full">
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => set({ abierto: true })}>
          <Users size={14} /> Dividir la cuenta
        </button>
      </div>
    );
  }

  return (
    <div className="cc-field cc-field-full cc-dividir">
      <label>¿Con quién la divides?</label>
      <div className="cc-chips">
        {people.map((p) => (
          <button
            key={p.id} type="button"
            className={`cc-chip ${split.personIds.includes(p.id) ? 'on' : ''}`}
            onClick={() => alternar(p.id)}
          >
            {p.name}
          </button>
        ))}
        <button
          type="button" className="cc-chip cc-chip-nueva"
          onClick={() => {
            // eslint-disable-next-line no-alert
            const id = onAgregarPersona(window.prompt('¿Cómo se llama?'));
            if (id && !split.personIds.includes(id)) set({ personIds: [...split.personIds, id] });
          }}
        >
          <Plus size={12} /> Alguien más
        </button>
      </div>

      {split.personIds.length > 0 && (
        <>
          <div className="cc-type-toggle" style={{ marginTop: 10 }}>
            <button type="button" className={`cc-type-btn ${split.mode !== 'montos' ? 'active-ingreso' : ''}`}
              onClick={() => set({ mode: 'iguales' })}>Partes iguales</button>
            <button type="button" className={`cc-type-btn ${split.mode === 'montos' ? 'active-ingreso' : ''}`}
              onClick={() => set({ mode: 'montos' })}>Montos a mano</button>
          </div>

          {split.mode !== 'montos' ? (
            <>
              <label className="cc-checkbox-field" style={{ textTransform: 'none', marginTop: 8 }}>
                <input type="checkbox" checked={split.includeMe !== false}
                  onChange={(e) => set({ includeMe: e.target.checked })} />
                Yo también entro en la cuenta
              </label>
              <span className="cc-stat-sub">
                {partes} parte{partes === 1 ? '' : 's'} de <strong className="cc-mono">{fmtCOP(cadaUno)}</strong>
              </span>
            </>
          ) : (
            <div className="cc-dividir-montos">
              {split.personIds.map((id) => (
                <div key={id} className="cc-dividir-fila">
                  <span>{(people.find((p) => p.id === id) || {}).name}</span>
                  <input className="cc-input" type="number" min="0" step="any" placeholder="0"
                    value={(split.amounts || {})[id] || ''}
                    onChange={(e) => set({ amounts: { ...split.amounts, [id]: e.target.value } })} />
                </div>
              ))}
            </div>
          )}

          <div className={tuParte < 0 ? 'cc-reparto-mal' : 'cc-stat-sub'} style={{ marginTop: 8 }}>
            {tuParte < 0
              ? 'El reparto suma más que la cuenta.'
              : <>Te deben <strong className="cc-mono">{fmtCOP(deEllos)}</strong> · tu parte, <strong className="cc-mono">{fmtCOP(tuParte)}</strong></>}
          </div>
        </>
      )}

      <button type="button" className="cc-icon-btn" style={{ marginTop: 6, opacity: 0.8 }}
        onClick={() => set({ personIds: [], abierto: false })}>
        No dividir
      </button>
    </div>
  );
}

export default function FormMovimiento() {
  const {
    txForm, setTxForm, txFormError, editingTxId,
    handleAddTransaction, handleCancelTxForm,
    creditCards, usdRate,
    txFormCategories, txIsUSD, txEffectiveRate, txChargeDate,
    people, handleAddPerson,
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
      {txForm.type === 'gasto' && !txForm.isInstallment && (
        <DividirCuenta
          txForm={txForm} setTxForm={setTxForm}
          people={people || []} onAgregarPersona={handleAddPerson}
        />
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
