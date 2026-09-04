import { CreditCard, Plus, Trash2, X, Landmark, Pencil } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { getCategory } from '../lib/categories.js';
import { todayStr, monthKeyFromDate, monthLabel, formatDateHuman } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import IconCircle from '../components/IconCircle';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';
export default function Tarjetas() {
  const {
    cardForm,
    cardStatements,
    creditCards,
    editingCardId,
    getInstallmentGroup,
    handleAddCard,
    handleCancelCardForm,
    handleDeleteCard,
    handleEditCard,
    handleRegisterNextInstallment,
    selectedMonth,
    setCardForm,
    setShowCardForm,
    showCardForm,
    transactions,
  } = useFinance();

  return (
    <>
      <div className="cc-section-head">
        <div>
          <div className="cc-page-title">Tarjetas</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>Tus tarjetas de crédito y los movimientos hechos con cada una.</p>
        </div>
        <button type="button" className="cc-btn cc-btn-primary" onClick={() => (showCardForm ? handleCancelCardForm() : setShowCardForm(true))}>
          {showCardForm ? <X size={15} /> : <Plus size={15} />} {showCardForm ? 'Cancelar' : 'Nueva tarjeta'}
        </button>
      </div>

      {showCardForm && (
        <form className="cc-form" onSubmit={handleAddCard}>
          <div className="cc-field">
            <label>Nombre de la tarjeta</label>
            <input className="cc-input" type="text" placeholder="Bancolombia Mastercard" value={cardForm.name} onChange={(e) => setCardForm((f) => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="cc-field">
            <label>Últimos 4 dígitos</label>
            <input className="cc-input" type="text" inputMode="numeric" maxLength={4} placeholder="1679" value={cardForm.lastFour} onChange={(e) => setCardForm((f) => ({ ...f, lastFour: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
          </div>
          <div className="cc-field">
            <label>Moneda</label>
            <select className="cc-select" value={cardForm.currency} onChange={(e) => setCardForm((f) => ({ ...f, currency: e.target.value }))}>
              <option value="COP">Pesos colombianos (COP)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </div>
          <div className="cc-field">
            <label>Día de corte (opcional)</label>
            <input className="cc-input" type="number" min="1" max="31" placeholder="31" value={cardForm.cutDay} onChange={(e) => setCardForm((f) => ({ ...f, cutDay: e.target.value }))} />
          </div>
          <div className="cc-field">
            <label>Día de pago (opcional)</label>
            <input className="cc-input" type="number" min="1" max="31" placeholder="15" value={cardForm.paymentDay} onChange={(e) => setCardForm((f) => ({ ...f, paymentDay: e.target.value }))} />
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>Con estos dos datos calculamos cuándo se cobraría cada compra.</span>
          </div>
          <div className="cc-form-actions">
            <button type="submit" className="cc-btn cc-btn-primary">{editingCardId ? 'Guardar cambios' : 'Guardar tarjeta'}</button>
            {editingCardId && <button type="button" className="cc-btn cc-btn-outline" onClick={handleCancelCardForm}>Cancelar edición</button>}
          </div>
        </form>
      )}

      {creditCards.length === 0 ? (
        <EmptyState Icon={Landmark} title="No tienes tarjetas registradas" text="Agrega tu tarjeta de crédito para ver sus movimientos por separado del resto de tus gastos." />
      ) : (
        creditCards.map((card) => {
          const cardTx = transactions.filter((t) => t.cardId === card.id).sort((a, b) => (a.date < b.date ? 1 : -1));
          const monthTotal = cardTx.filter((t) => monthKeyFromDate(t.date) === selectedMonth).reduce((s, t) => s + t.amount, 0);
          const historicTotal = cardTx.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
          const installmentTx = cardTx.filter((t) => t.isInstallment && t.totalInstallments);
          const groupIds = [...new Set(installmentTx.map((t) => t.installmentGroupId || t.id))];
          const installmentGroups = groupIds.map((gid) => {
            const entries = installmentTx.filter((t) => (t.installmentGroupId || t.id) === gid).sort((a, b) => (a.currentInstallment || 0) - (b.currentInstallment || 0));
            return entries[entries.length - 1];
          });
          return (
            <div key={card.id} className="cc-card" style={{ marginBottom: 16 }}>
              <div className="cc-goal-head">
                <div>
                  <div className="cc-goal-name">{card.name}</div>
                  <div className="cc-goal-meta">Terminada en {card.lastFour}{card.currency === 'USD' ? ' · USD' : ''} · {cardTx.length} movimientos registrados</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleEditCard(card)} aria-label="Editar tarjeta"><Pencil size={14} /></button>
                  <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteCard(card.id)} aria-label="Eliminar tarjeta"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="cc-stat-sub" style={{ marginBottom: 12 }}>
                Gastado en {monthLabel(selectedMonth)}: <span className="cc-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtCOP(monthTotal)}</span>
                {' · '}Histórico: <span className="cc-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtCOP(historicTotal)}</span>
                {card.currency === 'USD' ? ' (convertido a COP)' : ''}
              </div>

              {/*
                Lo que de verdad te van a cobrar y cuándo. Antes la app tenía el
                cálculo (computeChargeDate) pero solo lo usaba para un texto de
                ayuda al registrar la compra.
              */}
              {(() => {
                const facturas = cardStatements[card.id];
                if (!facturas) return null;
                if (!card.cutDay || !card.paymentDay) {
                  return (
                    <div className="cc-stat-sub" style={{ marginBottom: 12 }}>
                      Ponle día de corte y día de pago a esta tarjeta para ver cuánto te llega en la próxima factura.
                    </div>
                  );
                }
                if (!facturas.next) {
                  return (
                    <div className="cc-statement cc-statement-clear">
                      <span className="cc-statement-label">Próxima factura</span>
                      <span className="cc-statement-amount">Sin cargos pendientes</span>
                    </div>
                  );
                }
                const [y, m, d] = facturas.next.paymentDate.split('-').map(Number);
                return (
                  <div className="cc-statement">
                    <div>
                      <span className="cc-statement-label">Próxima factura</span>
                      <div className="cc-statement-amount">{fmtCOP(facturas.next.total)}</div>
                    </div>
                    <div className="cc-statement-due">
                      se paga el<br />
                      <strong>{formatDateHuman(new Date(y, m - 1, d))}</strong>
                      <div className="cc-stat-sub">{facturas.next.items.length} compra{facturas.next.items.length === 1 ? '' : 's'}</div>
                    </div>
                  </div>
                );
              })()}

              {installmentGroups.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Compras en cuotas activas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {installmentGroups.map((t) => {
                      const remainingCuotas = Math.max(0, (t.totalInstallments || 0) - (t.currentInstallment || 0));
                      const remainingAmount = remainingCuotas * t.amount;
                      const pct = t.totalInstallments ? Math.min(100, Math.round(((t.currentInstallment || 0) / t.totalInstallments) * 100)) : 0;
                      const groupId = t.installmentGroupId || t.id;
                      const key = monthKeyFromDate(todayStr());
                      const group = t.installmentGroupId ? getInstallmentGroup(t.installmentGroupId) : [t];
                      const paidThisMonth = group.some((g) => monthKeyFromDate(g.date) === key);
                      const completed = t.totalInstallments && t.currentInstallment >= t.totalInstallments;
                      return (
                        <div key={groupId} style={{ background: 'var(--paper)', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                            <span style={{ fontWeight: 600 }}>{t.note || getCategory(t.category).label}</span>
                            <span className="cc-mono">Cuota {t.currentInstallment}/{t.totalInstallments}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 99, background: 'var(--paper-line)', overflow: 'hidden', marginBottom: 6 }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: COLORS.savings, borderRadius: 99 }} />
                          </div>
                          <div className="cc-stat-sub" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span>{fmtCOP(t.amount)}/mes{t.interestRate != null ? ` · ${t.interestRate}% mensual` : ''}</span>
                            <span>Faltan {remainingCuotas} cuotas (~{fmtCOP(remainingAmount)})</span>
                          </div>
                          {completed ? (
                            <span className="cc-tag" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}>Completada ✓</span>
                          ) : paidThisMonth ? (
                            <span className="cc-tag" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}>Cuota de este mes ya registrada ✓</span>
                          ) : (
                            <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleRegisterNextInstallment(groupId)}>
                              Registrar cuota {t.currentInstallment + 1} de este mes
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {cardTx.length === 0 ? (
                <EmptyState Icon={CreditCard} title="Sin movimientos" text="Los gastos que registres con esta tarjeta aparecerán aquí." />
              ) : (
                <div className="cc-tx-list">
                  {cardTx.map((t) => {
                    const cat = getCategory(t.category);
                    return (
                      <div key={t.id} className="cc-tx-row">
                        <IconCircle Icon={cat.icon} color={cat.color} bg="var(--expense-soft)" />
                        <div>
                          <div className="cc-tx-cat">{cat.label}</div>
                          <div className="cc-tx-note">
                            {t.note || '—'} · <span className="cc-tx-date">{t.date}</span>
                          </div>
                          {(t.isFixed || t.isInstallment) && (
                            <div className="cc-tx-tags">
                              {t.isFixed && <span className="cc-tag cc-tag-fixed">Fijo</span>}
                              {t.isInstallment && (
                                <span className="cc-tag cc-tag-installment">
                                  Cuota {t.currentInstallment || '?'}/{t.totalInstallments || '?'}
                                  {t.interestRate != null ? ` · ${t.interestRate}% mensual` : ''}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="cc-tx-amount" style={{ color: COLORS.expense }}>-{fmtCOP(t.amount)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </>
  );

}
