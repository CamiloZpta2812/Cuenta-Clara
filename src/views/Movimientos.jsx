import { useState } from 'react';
import { ArrowLeftRight, Plus, Trash2, AlertTriangle, X, Pencil, SlidersHorizontal } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, getCategory, getPaymentMethod } from '../lib/categories.js';
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
