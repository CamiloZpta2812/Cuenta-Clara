import { useState } from 'react';
import { Plus, Trash2, Check, Undo2, Briefcase } from 'lucide-react';
import { fmtCOP } from '../lib/money.js';
import { useFinance } from '../state/financeStore';

/*
 * Pagos de proyecto: contratos que pagan lo que pagan, cuando toca.
 *
 * No caben en las fuentes de ingreso porque esas son mensuales: el sueldo se
 * repite, un contrato no. Cada pago tiene su fecha y su monto, cuenta en el
 * plan del mes en que lo esperas y aparece en el Calendario ese día.
 *
 * "Ya me pagaron" crea el ingreso de verdad. Hasta ese momento es plata
 * prometida, y la pantalla la trata como tal: se ve, pero aparte de la segura.
 */

const fecha = (d) => {
  const [y, m, x] = String(d).split('-').map(Number);
  return new Date(y, m - 1, x).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PagosProyecto() {
  const {
    expectedIncomes, handleAddExpectedIncome, handleUpdateExpectedIncome,
    handleDeleteExpectedIncome, handleToggleExpectedIncomeReceived,
  } = useFinance();
  const [nuevo, setNuevo] = useState({ project: '', name: '', amount: '', expectedDate: '' });

  const lista = [...(expectedIncomes || [])]
    .sort((a, b) => (a.expectedDate < b.expectedDate ? -1 : 1));
  const proyectos = [...new Set(lista.map((x) => x.project).filter(Boolean))];

  const pendiente = lista.filter((x) => !x.transactionId).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const recibido = lista.filter((x) => x.transactionId).reduce((s, x) => s + (Number(x.amount) || 0), 0);

  const agregar = (e) => {
    e.preventDefault();
    if (!nuevo.project.trim() || !(Number(nuevo.amount) > 0) || !nuevo.expectedDate) return;
    handleAddExpectedIncome({
      project: nuevo.project.trim(), name: nuevo.name.trim() || 'Pago',
      amount: Number(nuevo.amount), expectedDate: nuevo.expectedDate,
    });
    /* Se queda el proyecto puesto: lo normal es cargar varios pagos del mismo. */
    setNuevo({ project: nuevo.project, name: '', amount: '', expectedDate: '' });
  };

  return (
    <div className="cc-card" style={{ marginTop: 14 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
        <Briefcase size={15} style={{ verticalAlign: '-2px' }} /> Pagos de proyecto
      </div>
      <p className="cc-stat-sub" style={{ marginBottom: 12 }}>
        Para lo que no es un sueldo: contratos que pagan en fechas sueltas. Cada pago
        cuenta en el plan del mes en que lo esperas. Si el cliente se atrasa, cámbiale la
        fecha — así el plan no cuenta plata que todavía no tienes.
      </p>

      {lista.length > 0 && (
        <>
          <div className="cc-proyecto-totales">
            <span>Por cobrar <strong className="cc-mono">{fmtCOP(pendiente)}</strong></span>
            <span>Ya recibido <strong className="cc-mono">{fmtCOP(recibido)}</strong></span>
          </div>
          <div className="cc-commit-list" style={{ marginBottom: 14 }}>
            {lista.map((x) => (
              <div key={x.id} className={`cc-proyecto-fila ${x.transactionId ? 'recibido' : ''}`}>
                <div className="cc-proyecto-que">
                  <strong>{x.project}</strong>
                  <input
                    className="cc-input cc-input-plano" value={x.name}
                    onChange={(e) => handleUpdateExpectedIncome(x.id, { name: e.target.value })}
                    aria-label="Concepto"
                  />
                </div>
                <input
                  className="cc-input" type="number" min="0" step="any" value={x.amount}
                  disabled={!!x.transactionId}
                  onChange={(e) => handleUpdateExpectedIncome(x.id, { amount: Number(e.target.value) || 0 })}
                  aria-label="Monto"
                />
                <input
                  className="cc-input" type="date" value={x.expectedDate}
                  disabled={!!x.transactionId}
                  onChange={(e) => handleUpdateExpectedIncome(x.id, { expectedDate: e.target.value })}
                  aria-label="Fecha esperada"
                />
                <div className="cc-proyecto-acciones">
                  <button
                    type="button"
                    className={`cc-btn cc-btn-sm ${x.transactionId ? 'cc-btn-outline' : ''}`}
                    onClick={() => handleToggleExpectedIncomeReceived(x.id)}
                    title={x.transactionId ? 'Deshacer: borra el ingreso que se creó' : 'Crea el ingreso con la fecha de hoy'}
                  >
                    {x.transactionId ? <><Undo2 size={13} /> Deshacer</> : <><Check size={13} /> Ya me pagaron</>}
                  </button>
                  <button
                    type="button" className="cc-btn cc-btn-outline cc-btn-sm"
                    onClick={() => handleDeleteExpectedIncome(x.id)} aria-label="Borrar pago"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {x.transactionId && (
                  <span className="cc-stat-sub cc-proyecto-nota">
                    Recibido · esperado para el {fecha(x.expectedDate)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <form className="cc-proyecto-nuevo" onSubmit={agregar}>
        <input
          className="cc-input" list="cc-proyectos" placeholder="Proyecto" value={nuevo.project}
          onChange={(e) => setNuevo((n) => ({ ...n, project: e.target.value }))}
        />
        <datalist id="cc-proyectos">
          {proyectos.map((p) => <option key={p} value={p} />)}
        </datalist>
        <input
          className="cc-input" placeholder="Concepto (anticipo, entrega…)" value={nuevo.name}
          onChange={(e) => setNuevo((n) => ({ ...n, name: e.target.value }))}
        />
        <input
          className="cc-input" type="number" min="0" step="any" placeholder="Monto" value={nuevo.amount}
          onChange={(e) => setNuevo((n) => ({ ...n, amount: e.target.value }))}
        />
        <input
          className="cc-input" type="date" value={nuevo.expectedDate}
          onChange={(e) => setNuevo((n) => ({ ...n, expectedDate: e.target.value }))}
        />
        <button type="submit" className="cc-btn cc-btn-outline cc-btn-sm">
          <Plus size={14} /> Agregar pago
        </button>
      </form>
    </div>
  );
}
