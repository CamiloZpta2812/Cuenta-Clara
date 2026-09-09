import { Plus, Trash2 } from 'lucide-react';
import { COLORS, COLOR_CHOICES } from '../lib/constants.js';
import { ICON_CHOICES, getCategory } from '../lib/categories.js';
import IconCircle from '../components/IconCircle';
import { supabase } from '../supabaseClient.js';
import { fmtCOP } from '../lib/money.js';
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
    incomeSources,
    handleAddIncomeSource,
    handleUpdateIncomeSource,
    handleDeleteIncomeSource,
  } = useFinance();

  const subTabs = [
    { id: 'ingresos', label: 'Ingresos' },
    { id: 'categorias', label: 'Categorías' },
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

      {configTab === 'ingresos' && <Ingresos
        fuentes={incomeSources}
        onAgregar={handleAddIncomeSource}
        onCambiar={handleUpdateIncomeSource}
        onBorrar={handleDeleteIncomeSource}
      />}

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

/*
 * Las fuentes de ingreso.
 *
 * Se cargaban y se guardaban desde el primer día, pero no había ni una
 * pantalla para tocarlas: existían solo porque las había creado un script.
 * Mientras solo hacía falta el monto no se notaba —nadie cambia de sueldo cada
 * mes—, pero el Calendario necesita el DÍA en que cae cada una, y el único
 * camino para ponerlo era volver a abrir Supabase.
 *
 * "Abre quincena" es la casilla que hace el trabajo: separa el sueldo, que
 * parte el mes en dos, de un ingreso chico que simplemente cae adentro.
 */
function Ingresos({ fuentes, onAgregar, onCambiar, onBorrar }) {
  const total = (fuentes || [])
    .filter((f) => f.active !== false)
    .reduce((s, f) => s + (Number(f.expected) || 0), 0);

  return (
    <div className="cc-card">
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Fuentes de ingreso</div>
      <p className="cc-stat-sub" style={{ marginBottom: 12 }}>
        Lo que ESPERAS que entre, no lo que entró: lo que entró son movimientos, y la
        app compara los dos. Si te pagan quincenal, pon una fuente por quincena — así
        el Calendario sabe que la plata llega en dos pedazos.
      </p>

      {(fuentes || []).length === 0 && (
        <p className="cc-stat-sub">Todavía no hay ninguna.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {(fuentes || []).map((f) => (
          <div key={f.id} className="cc-ingreso-fila">
            <div className="cc-field">
              <label>Nombre</label>
              <input
                className="cc-input" type="text" placeholder="Salario 1ª quincena"
                value={f.name || ''}
                onChange={(e) => onCambiar(f.id, { name: e.target.value })}
              />
            </div>
            <div className="cc-field">
              <label>Cuánto</label>
              <input
                className="cc-input" type="number" min="0" step="any" placeholder="1700000"
                value={f.expected ?? ''}
                onChange={(e) => onCambiar(f.id, { expected: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="cc-field">
              <label>Qué día</label>
              <input
                className="cc-input" type="number" min="1" max="31" placeholder="15"
                value={f.day ?? ''}
                onChange={(e) => onCambiar(f.id, {
                  /* Vacío es null, no cero: cero no es un día del mes. */
                  day: e.target.value === '' ? null : parseInt(e.target.value, 10) || null,
                })}
              />
            </div>
            <div className="cc-ingreso-flags">
              <label className="cc-check">
                <input
                  type="checkbox" checked={!!f.startsPeriod}
                  onChange={(e) => onCambiar(f.id, { startsPeriod: e.target.checked })}
                />
                Abre quincena
              </label>
              <label className="cc-check">
                <input
                  type="checkbox" checked={f.active !== false}
                  onChange={(e) => onCambiar(f.id, { active: e.target.checked })}
                />
                Activa
              </label>
              <button
                type="button" className="cc-btn cc-btn-outline cc-btn-sm"
                onClick={() => onBorrar(f.id)} aria-label={`Borrar ${f.name || 'fuente'}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={onAgregar}>
          <Plus size={14} /> Agregar fuente
        </button>
        <span className="cc-stat-sub">
          Esperado al mes: <strong className="cc-mono">{fmtCOP(total)}</strong>
        </span>
      </div>

      <p className="cc-stat-sub" style={{ marginTop: 10 }}>
        <strong>Abre quincena</strong> marca los pagos que parten el mes. El sueldo sí;
        un ingreso chico no, porque partiría el mes en pedazos que no corresponden a nada.
      </p>
    </div>
  );
}
