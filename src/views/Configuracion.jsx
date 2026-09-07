import Tarjetas from './Tarjetas';
import { Plus, Trash2 } from 'lucide-react';
import { COLORS, COLOR_CHOICES } from '../lib/constants.js';
import { ICON_CHOICES, getCategory } from '../lib/categories.js';
import IconCircle from '../components/IconCircle';
import { supabase } from '../supabaseClient.js';
import { useFinance } from '../state/financeStore';
export default function Configuracion() {
  const {
    allExpenseCategories,
    allIncomeCategories,
    configTab,
    handleAddCustomCategory,
    handleDeleteCustomCategory,
    handleResetAll,
    handleSetPin,
    handleUpdateCategoryLabel,
    newCatGasto,
    newCatIngreso,
    pinForm,
    pinMessage,
    setConfigTab,
    setNewCatGasto,
    setNewCatIngreso,
    setPinForm,
    userEmail,
  } = useFinance();

  const subTabs = [
    { id: 'categorias', label: 'Categorías' },
    /*
     * La tarjeta es configuración, no una sección propia: navegar sus
     * movimientos es un filtro. Lo que sí necesitabas ver —qué llega en la
     * próxima factura y cuánto está comprometido en cuotas— vive en El mes.
     */
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'pin', label: 'Contraseña' },
    { id: 'datos', label: 'Datos y sesión' },
  ];
  return (
    <>
      <div className="cc-page-title">Configuración</div>
      <p className="cc-page-sub">Personaliza tus categorías, tu contraseña y administra tus datos.</p>

      <div className="cc-subtabs">
        {subTabs.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`cc-subtab ${configTab === s.id ? 'active' : ''}`}
            onClick={() => setConfigTab(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {configTab === 'tarjeta' && <Tarjetas />}

      {configTab === 'categorias' && (
        <>
          <div className="cc-card" style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Categorías de gasto</div>
            <p className="cc-stat-sub" style={{ marginBottom: 12 }}>Las categorías originales se pueden renombrar pero no borrar. Las que agregues tú se pueden borrar.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {allExpenseCategories.map((c) => {
                const resolved = getCategory(c.id);
                const isCustom = c.id.startsWith('custom-');
                return (
                  <div key={c.id} className="cc-inline-form" style={{ marginTop: 0 }}>
                    <IconCircle Icon={resolved.icon} color={resolved.color} bg="var(--expense-soft)" size={28} iconSize={14} />
                    <input
                      className="cc-input"
                      type="text"
                      defaultValue={resolved.label}
                      onBlur={(e) => handleUpdateCategoryLabel(c.id, e.target.value)}
                      style={{ maxWidth: 220 }}
                    />
                    {isCustom && (
                      <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={() => handleDeleteCustomCategory(c.id)} aria-label="Eliminar categoría">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: '1px dashed var(--paper-line)', paddingTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Agregar categoría de gasto</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input className="cc-input" type="text" placeholder="Nombre" value={newCatGasto.label} onChange={(e) => setNewCatGasto((f) => ({ ...f, label: e.target.value }))} style={{ maxWidth: 160 }} />
                <select className="cc-select" value={newCatGasto.iconKey} onChange={(e) => setNewCatGasto((f) => ({ ...f, iconKey: e.target.value }))} style={{ maxWidth: 150 }}>
                  {ICON_CHOICES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 4 }}>
                  {COLOR_CHOICES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCatGasto((f) => ({ ...f, color }))}
                      style={{ width: 20, height: 20, borderRadius: 99, background: color, border: newCatGasto.color === color ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer' }}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
                <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleAddCustomCategory('gasto')}>
                  <Plus size={13} /> Agregar
                </button>
              </div>
            </div>
          </div>

          <div className="cc-card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Categorías de ingreso</div>
            <p className="cc-stat-sub" style={{ marginBottom: 12 }}>Las categorías originales se pueden renombrar pero no borrar. Las que agregues tú se pueden borrar.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {allIncomeCategories.map((c) => {
                const resolved = getCategory(c.id);
                const isCustom = c.id.startsWith('custom-');
                return (
                  <div key={c.id} className="cc-inline-form" style={{ marginTop: 0 }}>
                    <IconCircle Icon={resolved.icon} color={resolved.color} bg="var(--income-soft)" size={28} iconSize={14} />
                    <input
                      className="cc-input"
                      type="text"
                      defaultValue={resolved.label}
                      onBlur={(e) => handleUpdateCategoryLabel(c.id, e.target.value)}
                      style={{ maxWidth: 220 }}
                    />
                    {isCustom && (
                      <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={() => handleDeleteCustomCategory(c.id)} aria-label="Eliminar categoría">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: '1px dashed var(--paper-line)', paddingTop: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Agregar categoría de ingreso</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <input className="cc-input" type="text" placeholder="Nombre" value={newCatIngreso.label} onChange={(e) => setNewCatIngreso((f) => ({ ...f, label: e.target.value }))} style={{ maxWidth: 160 }} />
                <select className="cc-select" value={newCatIngreso.iconKey} onChange={(e) => setNewCatIngreso((f) => ({ ...f, iconKey: e.target.value }))} style={{ maxWidth: 150 }}>
                  {ICON_CHOICES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 4 }}>
                  {COLOR_CHOICES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCatIngreso((f) => ({ ...f, color }))}
                      style={{ width: 20, height: 20, borderRadius: 99, background: color, border: newCatIngreso.color === color ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer' }}
                      aria-label={`Color ${color}`}
                    />
                  ))}
                </div>
                <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleAddCustomCategory('ingreso')}>
                  <Plus size={13} /> Agregar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {configTab === 'pin' && (
        <div className="cc-card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Contraseña</div>
          <p className="cc-stat-sub" style={{ marginBottom: 12 }}>
            Cambia la contraseña de tu cuenta (mínimo 6 caracteres).
          </p>
          <form onSubmit={handleSetPin} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 260 }}>
            <div className="cc-field">
              <label>Nueva contraseña</label>
              <input
                className="cc-input"
                type="password"
                minLength={6}
                value={pinForm.newPin}
                onChange={(e) => setPinForm((f) => ({ ...f, newPin: e.target.value }))}
              />
            </div>
            <div className="cc-field">
              <label>Confirmar contraseña</label>
              <input
                className="cc-input"
                type="password"
                minLength={6}
                value={pinForm.confirmPin}
                onChange={(e) => setPinForm((f) => ({ ...f, confirmPin: e.target.value }))}
              />
            </div>
            <button type="submit" className="cc-btn cc-btn-primary" style={{ alignSelf: 'flex-start' }}>Guardar contraseña</button>
            {pinMessage && (
              <p style={{ fontSize: 13, color: pinMessage.kind === 'success' ? COLORS.income : COLORS.expense }}>{pinMessage.text}</p>
            )}
          </form>
        </div>
      )}

      {configTab === 'datos' && (
        <div className="cc-card">
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Datos y sesión</div>
          <p className="cc-stat-sub" style={{ marginBottom: 16 }}>
            {userEmail ? `Sesión iniciada: ${userEmail}. ` : ''}Tus datos se guardan de forma privada en tu cuenta.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={handleResetAll}>
              <Trash2 size={13} /> Borrar todos los datos
            </button>
            <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => supabase.auth.signOut()}>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  );

}
