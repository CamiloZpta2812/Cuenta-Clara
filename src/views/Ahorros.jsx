import { PiggyBank, Plus, Trash2, X } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { fmtCOP } from '../lib/money.js';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';
export default function Ahorros() {
  const {
    contributionInputs,
    goalForm,
    handleAddGoal,
    handleContribution,
    handleDeleteGoal,
    savingsGoals,
    setContributionInputs,
    setGoalForm,
    setShowGoalForm,
    showGoalForm,
  } = useFinance();

  return (
    <>
      <div className="cc-section-head">
        <div>
          <div className="cc-page-title">Ahorros</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>Tus metas y cuánto llevas acumulado.</p>
        </div>
        <button type="button" className="cc-btn cc-btn-primary" onClick={() => setShowGoalForm((v) => !v)}>
          {showGoalForm ? <X size={15} /> : <Plus size={15} />} {showGoalForm ? 'Cancelar' : 'Nueva meta'}
        </button>
      </div>

      {showGoalForm && (
        <form className="cc-form" onSubmit={handleAddGoal}>
          <div className="cc-field cc-field-full">
            <label>Nombre de la meta</label>
            <input className="cc-input" type="text" placeholder="Fondo de emergencia, viaje..." value={goalForm.name} onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="cc-field">
            <label>Monto objetivo (opcional)</label>
            <input className="cc-input" type="number" min="0" step="any" placeholder="Déjalo vacío si no tienes un monto fijo" value={goalForm.targetAmount} onChange={(e) => setGoalForm((f) => ({ ...f, targetAmount: e.target.value }))} />
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>Déjalo vacío si solo quieres ir ahorrando sin un monto fijo en mente.</span>
          </div>
          <div className="cc-field">
            <label>Fecha meta (opcional)</label>
            <input className="cc-input" type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm((f) => ({ ...f, targetDate: e.target.value }))} />
          </div>
          <div className="cc-field">
            <label>Ya tenías ahorrado (opcional)</label>
            <input className="cc-input" type="number" min="0" step="any" placeholder="0" value={goalForm.initialAmount} onChange={(e) => setGoalForm((f) => ({ ...f, initialAmount: e.target.value }))} />
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>Si ya venías ahorrando para esto por tu cuenta, pon ese monto aquí para que la meta arranque desde ahí.</span>
          </div>
          <div className="cc-form-actions">
            <button type="submit" className="cc-btn cc-btn-primary">Guardar meta</button>
          </div>
        </form>
      )}

      {savingsGoals.length === 0 ? (
        <EmptyState Icon={PiggyBank} title="Aún no tienes metas de ahorro" text="Crea una meta, así podrás ver tu progreso mes a mes." />
      ) : (
        savingsGoals.map((g) => {
          const saved = Math.max(0, g.contributions.reduce((s, c) => s + c.amount, 0));
          const hasTarget = g.targetAmount != null && g.targetAmount > 0;
          const pct = hasTarget ? Math.min(100, (saved / parseFloat(g.targetAmount)) * 100) : null;
          return (
            <div key={g.id} className="cc-goal-card">
              <div className="cc-goal-head">
                <div>
                  <div className="cc-goal-name">{g.name}</div>
                  <div className="cc-goal-meta">
                    {hasTarget ? (g.targetDate ? `Meta para ${g.targetDate}` : 'Sin fecha límite') : 'Ahorro abierto, sin monto objetivo'}
                  </div>
                </div>
                <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteGoal(g.id)} aria-label="Eliminar meta"><Trash2 size={15} /></button>
              </div>
              {hasTarget ? (
                <>
                  <div className="cc-progress-track"><div className="cc-progress-fill" style={{ width: `${pct}%`, background: COLORS.savings }} /></div>
                  <div className="cc-goal-nums">
                    <span>Ahorrado: {fmtCOP(saved)}</span>
                    <span>{pct.toFixed(0)}%</span>
                    <span>Meta: {fmtCOP(g.targetAmount)}</span>
                  </div>
                </>
              ) : (
                <div className="cc-goal-nums" style={{ justifyContent: 'flex-start' }}>
                  <span>Ahorrado hasta ahora: <strong className="cc-mono">{fmtCOP(saved)}</strong></span>
                </div>
              )}
              <div className="cc-inline-form">
                <input className="cc-input" type="number" min="0" step="any" placeholder="Monto" value={contributionInputs[g.id] || ''} onChange={(e) => setContributionInputs((p) => ({ ...p, [g.id]: e.target.value }))} />
                <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleContribution(g.id, 1)}>Aportar</button>
                <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleContribution(g.id, -1)}>Retirar</button>
              </div>
            </div>
          );
        })
      )}
    </>
  );

}
