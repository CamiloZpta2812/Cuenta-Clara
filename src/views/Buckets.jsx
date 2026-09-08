import { PiggyBank, Shield, Plus, X, Trash2, Lock, Check, Pencil } from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthKeyFromDate, currentMonthKey } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';

/*
 * Buckets: dónde va la plata que no te gastas.
 *
 * La app vieja tenía "metas de ahorro" y ya. Pero guardar para los gatos no es
 * una meta: no hay un monto al que llegar ni una fecha, es margen para cuando
 * llegue el veterinario. Meterlo en la misma lista que "viaje a Cartagena"
 * hacía ver como progreso algo que es simplemente estar preparado.
 *
 *   meta     tiene un destino y se juzga por cuánto le falta
 *   colchón  no tiene destino y se juzga por si alcanza
 *
 * El otro eje es si puedes tocarlo. La cooperativa cuenta como ahorro pero no
 * la puedes sacar el día que se dañe la moto, y eso hay que poder verlo.
 */

function acumulado(b) {
  return (b.contributions || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
}

function movidoEnMes(b, mes) {
  return (b.contributions || [])
    .filter((c) => (c.month || monthKeyFromDate(c.date)) === mes)
    .reduce((s, c) => s + (Number(c.amount) || 0), 0);
}

function Tarjeta({ bucket, input, onInput, onMover, onBorrar, onEditar }) {
  const saldo = acumulado(bucket);
  /* Se lee en cada render y no al cargar el módulo: con la app abierta toda
     la noche, un valor congelado seguiría hablando del mes pasado. */
  const esteMes = movidoEnMes(bucket, currentMonthKey());
  const planeado = Number(bucket.monthlyAmount) || 0;
  const falta = planeado - esteMes;
  const conObjetivo = bucket.kind === 'meta' && bucket.targetAmount > 0;
  const pct = conObjetivo ? Math.min(100, (Math.max(0, saldo) / bucket.targetAmount) * 100) : null;
  const color = bucket.kind === 'colchon' ? COLORS.debt : COLORS.savings;

  return (
    <div className="cc-goal-card">
      <div className="cc-goal-head">
        <div>
          <div className="cc-goal-name">
            {bucket.name}
            {!bucket.liquid && (
              <span className="cc-tag" style={{ marginLeft: 8 }}>
                <Lock size={11} /> No lo puedes tocar
              </span>
            )}
          </div>
          <div className="cc-goal-meta">
            {conObjetivo
              ? (bucket.targetDate ? `Meta para ${bucket.targetDate}` : 'Con monto objetivo')
              : bucket.kind === 'colchon'
                ? 'Margen para lo que llegue, sin monto objetivo'
                : 'Ahorro abierto, sin monto objetivo'}
            {planeado > 0 && ` · ${fmtCOP(planeado)} al mes`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button" className="cc-btn cc-btn-outline cc-btn-sm"
            onClick={() => onEditar(bucket)} aria-label={`Editar ${bucket.name}`}
          >
            <Pencil size={14} />
          </button>
          <button
            type="button" className="cc-btn cc-btn-danger"
            onClick={() => onBorrar(bucket.id)} aria-label={`Eliminar ${bucket.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {conObjetivo ? (
        <>
          <div className="cc-progress-track">
            <div className="cc-progress-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
          <div className="cc-goal-nums">
            <span>Llevas: {fmtCOP(saldo)}</span>
            <span>{pct.toFixed(0)}%</span>
            <span>Meta: {fmtCOP(bucket.targetAmount)}</span>
          </div>
        </>
      ) : (
        <div className="cc-goal-nums" style={{ justifyContent: 'flex-start' }}>
          <span>
            {bucket.kind === 'colchon' ? 'Disponible en el colchón' : 'Llevas'}:{' '}
            <strong className="cc-mono">{fmtCOP(saldo)}</strong>
          </span>
        </div>
      )}

      {/*
        * Lo del mes va aparte del acumulado a propósito: son dos preguntas
        * distintas. "¿Ya aparté lo de este mes?" y "¿alcanza si pasa algo?".
        */}
      {planeado > 0 && (
        <div className="cc-goal-nums" style={{ justifyContent: 'flex-start', gap: 8 }}>
          {falta <= 0 ? (
            <span style={{ color: COLORS.income, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={13} /> Este mes ya apartaste {fmtCOP(esteMes)}
            </span>
          ) : (
            <span style={{ color: COLORS.inkSoft }}>
              Este mes llevas {fmtCOP(esteMes)} de {fmtCOP(planeado)} — faltan {fmtCOP(falta)}
            </span>
          )}
        </div>
      )}

      <div className="cc-inline-form">
        <input
          className="cc-input" type="number" min="0" step="any" placeholder="Monto"
          value={input || ''}
          onChange={(e) => onInput(bucket.id, e.target.value)}
        />
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => onMover(bucket.id, 1)}>
          Aportar
        </button>
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => onMover(bucket.id, -1)}>
          {bucket.kind === 'colchon' ? 'Usar' : 'Retirar'}
        </button>
      </div>
    </div>
  );
}

export default function Buckets() {
  const {
    buckets, bucketInputs, setBucketInputs, bucketForm, setBucketForm,
    showBucketForm, setShowBucketForm, editingBucketId,
    handleAddBucket, handleBucketMovement, handleDeleteBucket,
    handleEditBucket, handleCancelBucketForm,
  } = useFinance();

  const metas = buckets.filter((b) => b.kind !== 'colchon');
  const colchones = buckets.filter((b) => b.kind === 'colchon');

  const suma = (lista) => lista.reduce((s, b) => s + acumulado(b), 0);
  const mensual = (lista) => lista.reduce((s, b) => s + (Number(b.monthlyAmount) || 0), 0);
  const liquido = buckets.filter((b) => b.liquid !== false).reduce((s, b) => s + acumulado(b), 0);

  const onInput = (id, v) => setBucketInputs((p) => ({ ...p, [id]: v }));

  const props = (b) => ({
    bucket: b,
    input: bucketInputs[b.id],
    onInput,
    onMover: handleBucketMovement,
    onBorrar: handleDeleteBucket,
    onEditar: handleEditBucket,
  });

  return (
    <>
      <div className="cc-section-head">
        <div>
          <div className="cc-page-title">Ahorro y colchones</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>
            Lo que apartas cada mes: lo que tiene destino y lo que está por si acaso.
          </p>
        </div>
        <button
          type="button" className="cc-btn cc-btn-primary"
          onClick={() => (showBucketForm ? handleCancelBucketForm() : setShowBucketForm(true))}
        >
          {showBucketForm ? <X size={15} /> : <Plus size={15} />}
          {showBucketForm ? 'Cancelar' : 'Nuevo'}
        </button>
      </div>

      {showBucketForm && (
        <form className="cc-form" onSubmit={handleAddBucket}>
          <div className="cc-field cc-field-full">
            <label>Nombre</label>
            <input
              className="cc-input" type="text" required
              placeholder="Colchón vacaciones, fondo de emergencia..."
              value={bucketForm.name}
              onChange={(e) => setBucketForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="cc-field">
            <label>¿Qué es?</label>
            <select
              className="cc-select" value={bucketForm.kind}
              onChange={(e) => setBucketForm((f) => ({ ...f, kind: e.target.value }))}
            >
              <option value="meta">Meta — voy a llegar a un monto</option>
              <option value="colchon">Colchón — margen para lo que llegue</option>
            </select>
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>
              Un colchón no se juzga por cuánto le falta, sino por si alcanza cuando pasa algo.
            </span>
          </div>
          <div className="cc-field">
            <label>Cuánto apartas al mes</label>
            <input
              className="cc-input" type="number" min="0" step="any" placeholder="65000"
              value={bucketForm.monthlyAmount}
              onChange={(e) => setBucketForm((f) => ({ ...f, monthlyAmount: e.target.value }))}
            />
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>
              Esto sale del plan del mes, así que baja lo que te queda para abonarle a la deuda.
            </span>
          </div>
          {bucketForm.kind === 'meta' && (
            <>
              <div className="cc-field">
                <label>Monto objetivo (opcional)</label>
                <input
                  className="cc-input" type="number" min="0" step="any"
                  value={bucketForm.targetAmount}
                  onChange={(e) => setBucketForm((f) => ({ ...f, targetAmount: e.target.value }))}
                />
              </div>
              <div className="cc-field">
                <label>Fecha meta (opcional)</label>
                <input
                  className="cc-input" type="date" value={bucketForm.targetDate}
                  onChange={(e) => setBucketForm((f) => ({ ...f, targetDate: e.target.value }))}
                />
              </div>
            </>
          )}
          <div className="cc-field">
            <label>¿Puedes sacar esta plata cuando quieras?</label>
            <select
              className="cc-select" value={bucketForm.liquid ? 'si' : 'no'}
              onChange={(e) => setBucketForm((f) => ({ ...f, liquid: e.target.value === 'si' }))}
            >
              <option value="si">Sí, está disponible</option>
              <option value="no">No, está amarrada</option>
            </select>
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>
              La cooperativa cuenta como ahorro, pero no la puedes sacar el día que se dañe la moto.
            </span>
          </div>
          <div className="cc-form-actions">
            <button type="submit" className="cc-btn cc-btn-primary">
              {editingBucketId ? 'Guardar cambios' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {buckets.length === 0 ? (
        <EmptyState
          Icon={PiggyBank}
          title="Todavía no apartas nada"
          text="Crea una meta si vas por un monto, o un colchón si es plata para lo que llegue sin avisar."
        />
      ) : (
        <>
          <div className="cc-stats-grid">
            <StatCard
              label="Ahorro con destino" value={fmtCOP(suma(metas))}
              Icon={PiggyBank} color={COLORS.savings} bg="var(--savings-soft)"
              sub={`${fmtCOP(mensual(metas))} al mes`}
            />
            <StatCard
              label="En colchones" value={fmtCOP(suma(colchones))}
              Icon={Shield} color={COLORS.debt} bg="var(--debt-soft)"
              sub={`${fmtCOP(mensual(colchones))} al mes`}
            />
            <StatCard
              label="Disponible de verdad" value={fmtCOP(liquido)}
              Icon={Check} color={COLORS.ink} bg="var(--paper)"
              sub="Sin contar lo que está amarrado"
            />
          </div>

          {metas.length > 0 && (
            <>
              <p className="cc-chart-title" style={{ marginTop: 18 }}>Metas</p>
              {metas.map((b) => <Tarjeta key={b.id} {...props(b)} />)}
            </>
          )}

          {colchones.length > 0 && (
            <>
              <p className="cc-chart-title" style={{ marginTop: 18 }}>Colchones</p>
              <p className="cc-page-sub">
                Estos no son ahorro: es plata apartada para cuando llegue el veterinario o
                se vare la moto. Que baje no es un retroceso — es que sirvió.
              </p>
              {colchones.map((b) => <Tarjeta key={b.id} {...props(b)} />)}
            </>
          )}
        </>
      )}
    </>
  );
}
