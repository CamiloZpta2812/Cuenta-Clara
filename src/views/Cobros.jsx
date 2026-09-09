import { HandCoins, Check, Undo2, TrendingDown, Users, Pencil } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthLabel } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';

/*
 * Cobros: quién te debe y quién ya te pagó.
 *
 * Agrupado por persona y no por gasto, porque a la gente no le cobras "el
 * Spotify": le escribes a Yeison. Si alguien está en dos gastos compartidos,
 * lo que necesitas es un solo total para pedirle.
 *
 * Marcar es guardar una fila; desmarcar es borrarla. Lo pendiente no se guarda
 * en ninguna parte: se deduce del reparto, así que un mes nuevo arranca en cero
 * solo, sin generar nada por adelantado.
 */

export default function Cobros() {
  const {
    availableMonths, selectedMonth, setSelectedMonth,
    monthReport, people, handleToggleCollection,
    fixedExpenses, handleEditFixedExpense,
  } = useFinance();

  const editarGasto = (id) => {
    const fe = (fixedExpenses || []).find((f) => f.id === id);
    if (fe) handleEditFixedExpense(fe);
  };

  const { collections } = monthReport;

  const meses = availableMonths.includes(selectedMonth)
    ? availableMonths
    : [selectedMonth, ...availableMonths];

  /* Un bloque por persona, con todo lo que te debe este mes. */
  const porPersona = people
    .map((p) => {
      const filas = collections.filter((c) => c.personId === p.id);
      return {
        persona: p,
        filas,
        total: filas.reduce((s, c) => s + c.amount, 0),
        pendiente: filas.filter((c) => !c.collected).reduce((s, c) => s + c.amount, 0),
      };
    })
    .filter((g) => g.filas.length > 0);

  const total = collections.reduce((s, c) => s + c.amount, 0);
  const cobrado = collections.filter((c) => c.collected).reduce((s, c) => s + c.amount, 0);
  const pendiente = total - cobrado;

  return (
    <>
      <div className="cc-page-title">Cobros</div>
      <p className="cc-page-sub">
        Lo que te deben por los gastos que compartes, mes a mes.
      </p>

      <div className="cc-section-head">
        <select
          className="cc-select"
          style={{ maxWidth: 160 }}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {collections.length === 0 ? (
        <EmptyState
          Icon={Users}
          title="Todavía no compartes ningún gasto"
          text="Cuando repartas un gasto fijo entre varias personas, aquí aparece lo que te debe cada una."
        />
      ) : (
        <>
          <div className="cc-stats-grid">
            <StatCard
              label="Te deben este mes" value={fmtCOP(total)}
              Icon={HandCoins} color={COLORS.ink} bg="var(--paper)"
            />
            <StatCard
              label="Ya cobrado" value={fmtCOP(cobrado)}
              Icon={Check} color={COLORS.income} bg="var(--income-soft)"
            />
            <StatCard
              label="Falta por cobrar" value={fmtCOP(pendiente)}
              Icon={TrendingDown} color={pendiente > 0 ? COLORS.expense : COLORS.income}
              bg={pendiente > 0 ? 'var(--expense-soft)' : 'var(--income-soft)'}
              sub={pendiente > 0 ? `${fmtCOP(pendiente * 12)} al año si se te pasa siempre` : 'Todo al día'}
            />
          </div>

          {porPersona.map(({ persona, filas, total: suTotal, pendiente: suPendiente }) => (
            <div className="cc-card" key={persona.id} style={{ marginTop: 14 }}>
              <div className="cc-section-head" style={{ marginTop: 0 }}>
                <p className="cc-chart-title" style={{ flex: 1, marginBottom: 0 }}>
                  {persona.name}
                </p>
                <span className="cc-mono" style={{ fontWeight: 600 }}>{fmtCOP(suTotal)}</span>
                <span
                  className="cc-tag"
                  style={suPendiente === 0 ? { color: COLORS.income } : undefined}
                >
                  {suPendiente === 0 ? 'Al día' : `Debe ${fmtCOP(suPendiente)}`}
                </span>
              </div>

              <div className="cc-commit-list">
                {filas.map((c) => (
                  <div
                    key={c.shareId}
                    className="cc-cobro-row"
                  >
                    <span className="cc-plan-concept">
                      {c.collected
                        ? <Check size={14} color={COLORS.income} />
                        : <HandCoins size={14} />}
                      {c.fixedExpenseName}
                      {/*
                        * El monto de un cobro es el reparto del gasto fijo, así
                        * que se edita allá y no aquí: dos sitios para el mismo
                        * número es la manera de que un día no coincidan. El
                        * lápiz lleva al formulario del gasto, ya abierto.
                        */}
                      <button
                        type="button" className="cc-icon-btn"
                        onClick={() => editarGasto(c.fixedExpenseId)}
                        aria-label={`Editar ${c.fixedExpenseName}`}
                        title="Cambiar el monto o el reparto"
                      >
                        <Pencil size={13} />
                      </button>
                    </span>
                    <span
                      className="cc-mono"
                      style={c.collected ? { color: COLORS.income } : undefined}
                    >
                      {fmtCOP(c.amount)}
                    </span>
                    <span>
                      <button
                        type="button"
                        className={`cc-btn cc-btn-sm ${c.collected ? 'cc-btn-outline' : ''}`}
                        onClick={() => handleToggleCollection(c.shareId)}
                      >
                        {c.collected
                          ? <><Undo2 size={13} /> Deshacer</>
                          : <><Check size={13} /> Ya me pagó</>}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="cc-page-sub" style={{ marginTop: 14 }}>
            Cada mes arranca en cero por su cuenta: solo se guarda lo que marcas como
            cobrado. Si mañana entra alguien nuevo a un gasto, aparece aquí sin tocar
            los meses anteriores.
          </p>
        </>
      )}
    </>
  );
}
