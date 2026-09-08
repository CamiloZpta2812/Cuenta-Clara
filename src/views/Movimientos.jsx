import { useState } from 'react';
import { ArrowLeftRight, Plus, Trash2, X, Pencil, SlidersHorizontal } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { PAYMENT_METHODS, getCategory, getPaymentMethod } from '../lib/categories.js';
import { monthLabel, computeChargeDate, formatDateHuman } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import IconCircle from '../components/IconCircle';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';
export default function Movimientos() {
  const [masFiltros, setMasFiltros] = useState(false);
  const {
    availableMonths,
    cardLabel,
    creditCards,
    filteredTx,
    handleCancelTxForm,
    handleDeleteTransaction,
    handleEditTransaction,
    setShowTxForm,
    setTxFilters,
    showTxForm,
    txFilterCategories,
    txFilters,
  } = useFinance();

  /* Cuántos filtros escondidos hay puestos, para que no se te olvide uno. */
  const activos = ['category', 'paymentMethod', 'fixed']
    .filter((k) => txFilters[k] && !['todas', 'todos'].includes(txFilters[k])).length
    + (txFilters.day ? 1 : 0);

  /*
   * Agrupados por día. Una lista plana de sesenta filas se lee como un extracto
   * bancario; por días se lee como lo que pasó, y de paso se ve de un vistazo
   * el día que se fue la mano.
   */
  const porDia = [];
  filteredTx.forEach((t) => {
    const ultimo = porDia[porDia.length - 1];
    if (ultimo && ultimo.date === t.date) ultimo.items.push(t);
    else porDia.push({ date: t.date, items: [t] });
  });

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


      {/*
        * Antes eran seis desplegables de ancho completo, uno por fila: los
        * filtros ocupaban más pantalla que los movimientos. Ahora el tipo —que
        * es el que de verdad se usa— está a un clic, y el resto se despliega
        * solo si hace falta, con un contador para que no se te olvide que
        * dejaste uno puesto.
        */}
      <div className="cc-filtros">
        <div className="cc-seg">
          {[['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']].map(([v, label]) => (
            <button
              key={v} type="button"
              className={txFilters.type === v ? 'active' : ''}
              onClick={() => setTxFilters((f) => ({ ...f, type: v, category: 'todas' }))}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          className="cc-select cc-select-sm" value={txFilters.month}
          onChange={(e) => setTxFilters((f) => ({ ...f, month: e.target.value }))}
        >
          <option value="todos">Todos los meses</option>
          {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>

        <button
          type="button"
          className={`cc-btn cc-btn-outline cc-btn-sm ${masFiltros ? 'active' : ''}`}
          onClick={() => setMasFiltros((v) => !v)}
        >
          <SlidersHorizontal size={13} /> Más filtros
          {activos > 0 && <span className="cc-badge">{activos}</span>}
        </button>

        {activos > 0 && (
          <button
            type="button" className="cc-btn cc-btn-outline cc-btn-sm"
            onClick={() => setTxFilters((f) => ({
              ...f, category: 'todas', paymentMethod: 'todos', fixed: 'todos', day: '',
            }))}
          >
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {masFiltros && (
        <div className="cc-filtros cc-filtros-extra">
          <select
            className="cc-select cc-select-sm" value={txFilters.category}
            onChange={(e) => setTxFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="todas">Todas las categorías</option>
            {txFilterCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select
            className="cc-select cc-select-sm" value={txFilters.paymentMethod}
            onChange={(e) => setTxFilters((f) => ({ ...f, paymentMethod: e.target.value }))}
          >
            <option value="todos">Todos los medios</option>
            {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select
            className="cc-select cc-select-sm" value={txFilters.fixed}
            onChange={(e) => setTxFilters((f) => ({ ...f, fixed: e.target.value }))}
          >
            <option value="todos">Fijos y variables</option>
            <option value="fijo">Solo fijos</option>
            <option value="variable">Solo variables</option>
          </select>
          <input
            type="date" className="cc-input cc-select-sm" aria-label="Filtrar por día"
            value={txFilters.day}
            onChange={(e) => setTxFilters((f) => ({ ...f, day: e.target.value }))}
          />
        </div>
      )}

      {filteredTx.length === 0 ? (
        <EmptyState Icon={ArrowLeftRight} title="No hay movimientos" text="Agrega tu primer ingreso o gasto para empezar a llevar el registro." />
      ) : (
        <div className="cc-tx-list">
          {porDia.map((dia) => {
            const neto = dia.items.reduce(
              (a, t) => a + (t.type === 'ingreso' ? t.amount : -t.amount), 0,
            );
            return (
              <div key={dia.date}>
                <div className="cc-dia-head">
                  <span>{formatDateHuman(new Date(`${dia.date}T12:00:00`))}</span>
                  <span
                    className="cc-mono"
                    style={{ color: neto >= 0 ? COLORS.income : COLORS.inkSoft }}
                  >
                    {neto >= 0 ? '+' : '−'}{fmtCOP(Math.abs(neto))}
                  </span>
                </div>

                {dia.items.map((t) => {
                  const cat = getCategory(t.category);
                  const c = t.cardId ? creditCards.find((cc) => cc.id === t.cardId) : null;
                  const cobro = c && c.cutDay && c.paymentDay
                    ? computeChargeDate(t.date, c.cutDay, c.paymentDay) : null;
                  return (
                    <div key={t.id} className="cc-mov">
                      <IconCircle
                        Icon={cat.icon} color={cat.color}
                        bg={t.type === 'ingreso' ? 'var(--income-soft)' : 'var(--expense-soft)'}
                      />
                      <div className="cc-mov-info">
                        {/*
                          * El título es la nota, no la categoría: uno se acuerda
                          * de "Mercado D1", no de "Alimentación". La categoría
                          * ya la dice el ícono y el color.
                          */}
                        <div className="cc-mov-titulo">{t.note || cat.label}</div>
                        <div className="cc-mov-meta">
                          {/* Sin nota el título ya es la categoría: repetirla debajo no dice nada. */}
                          {[
                            t.note ? cat.label : null,
                            t.type === 'gasto' && t.paymentMethod
                              ? getPaymentMethod(t.paymentMethod).label : null,
                            c ? cardLabel(t.cardId) : null,
                          ].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {(t.isFixed || t.isInstallment || t.currency === 'USD' || cobro) && (
                          <div className="cc-tx-tags">
                            {t.isFixed && <span className="cc-tag cc-tag-fixed">Fijo</span>}
                            {t.isInstallment && (
                              <span className="cc-tag cc-tag-installment">
                                Cuota {t.currentInstallment || '?'}/{t.totalInstallments || '?'}
                              </span>
                            )}
                            {t.currency === 'USD' && (
                              <span className="cc-tag">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(t.originalAmount || 0)}
                              </span>
                            )}
                            {cobro && <span className="cc-tag">Sale el {formatDateHuman(cobro)}</span>}
                          </div>
                        )}
                      </div>
                      <div
                        className="cc-mov-monto cc-mono"
                        style={{ color: t.type === 'ingreso' ? COLORS.income : COLORS.ink }}
                      >
                        {t.type === 'ingreso' ? '+' : '−'}{fmtCOP(t.amount)}
                      </div>
                      <div className="cc-mov-acciones">
                        <button
                          type="button" className="cc-btn cc-btn-outline cc-btn-sm"
                          onClick={() => handleEditTransaction(t)} aria-label="Editar movimiento"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button" className="cc-btn cc-btn-danger"
                          onClick={() => handleDeleteTransaction(t.id)} aria-label="Eliminar movimiento"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

}
