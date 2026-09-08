import { Plus, Trash2, Check, X, Pencil, Repeat, CalendarClock, AlertTriangle } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { PAYMENT_METHODS, getCategory, getPaymentMethod } from '../lib/categories.js';
import { fmtCOP } from '../lib/money.js';
import { todayStr, formatDateHuman } from '../lib/dates.js';
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
    proximosCobros,
    paidDateInputs,
    setPaidDateInputs,
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
        <>
        {/*
          * Lo que se viene. Va arriba de la lista completa porque es la
          * pregunta con fecha: la lista dice qué pagas cada mes, esto dice qué
          * te cobran esta semana.
          */}
        {proximosCobros.length > 0 && (
          <div className="cc-card" style={{ marginBottom: 14 }}>
            <p className="cc-chart-title">Esta semana te cobran</p>
            <div className="cc-commit-list">
              {proximosCobros.map((c) => (
                <div
                  key={c.id} className="cc-plan-row"
                  style={{ gridTemplateColumns: '1fr 120px 120px' }}
                >
                  <span className="cc-plan-concept">
                    {c.vencido
                      ? <AlertTriangle size={14} color={COLORS.expense} />
                      : <CalendarClock size={14} />}
                    {c.name}
                  </span>
                  <span className="cc-mono">{fmtCOP(c.amount)}</span>
                  <span style={{ color: c.vencido ? COLORS.expense : COLORS.inkSoft }}>
                    {c.vencido ? 'Se venció el ' : ''}
                    {formatDateHuman(new Date(`${c.date}T12:00:00`))}
                  </span>
                </div>
              ))}
            </div>
            <p className="cc-page-sub" style={{ marginTop: 10 }}>
              Solo aparecen los que tienen día de cobro puesto y no has marcado como
              pagados este mes. De un gasto compartido se anuncia tu parte.
            </p>
          </div>
        )}

        <div className="cc-fixed-list">
          {fixedExpenses.map((fe) => {
            const cat = getCategory(fe.category);
            const paidTx = findFixedExpensePaidThisMonth(fe.id);
            return (
              <div key={fe.id} className={`cc-fixed-card ${paidTx ? 'pagado' : ''}`}>
                <IconCircle Icon={cat.icon} color={cat.color} bg="var(--expense-soft)" />

                <div className="cc-fixed-info">
                  <div className="cc-fixed-name">{fe.name}</div>
                  <div className="cc-fixed-meta">
                    {cat.label} · {getPaymentMethod(fe.paymentMethod).label}
                    {fe.cardId ? ` · ${cardLabel(fe.cardId)}` : ''}
                    {fe.dueDay ? ` · día ${fe.dueDay}` : ''}
                  </div>
                </div>

                <div className="cc-fixed-monto cc-mono">{fmtCOP(fe.amount)}</div>

                <div className="cc-fixed-acciones">
                  {paidTx ? (
                    <>
                      <span className="cc-tag cc-tag-ok">
                        <Check size={12} /> Pagado el {paidTx.date.slice(8)}
                      </span>
                      <button
                        type="button" className="cc-btn cc-btn-outline cc-btn-sm"
                        onClick={() => handleUndoFixedExpensePaid(fe)}
                      >
                        Deshacer
                      </button>
                    </>
                  ) : (
                    <>
                      {/*
                        La fecha arranca en hoy, que es lo normal, pero se puede
                        mover: a veces uno marca al otro día lo que pagó ayer, y
                        registrarlo como hoy corre los pagos de fin de mes al mes
                        siguiente sin que nadie lo note.
                      */}
                      <input
                        type="date" className="cc-input cc-input-fecha"
                        value={paidDateInputs[fe.id] || todayStr()}
                        onChange={(e) => setPaidDateInputs((p) => ({ ...p, [fe.id]: e.target.value }))}
                        aria-label={`Fecha de pago de ${fe.name}`}
                      />
                      <button
                        type="button" className="cc-btn cc-btn-primary cc-btn-sm"
                        onClick={() => handleMarkFixedExpensePaid(fe, paidDateInputs[fe.id] || todayStr())}
                      >
                        <Check size={14} /> Pagado
                      </button>
                    </>
                  )}
                  <button
                    type="button" className="cc-btn cc-btn-outline cc-btn-sm"
                    onClick={() => handleEditFixedExpense(fe)} aria-label="Editar gasto fijo"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button" className="cc-btn cc-btn-danger"
                    onClick={() => handleDeleteFixedExpense(fe.id)} aria-label="Eliminar gasto fijo"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </>
  );

}
