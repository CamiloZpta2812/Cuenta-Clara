import { useFinance } from '../../state/financeStore';

/*
 * Crear o editar una meta o un colchón. Ver components/Modal.jsx para el
 * porqué de la ventana flotante.
 */
export default function FormBucket() {
  const {
    bucketForm, setBucketForm, editingBucketId, handleAddBucket,
  } = useFinance();

  return (
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
        <label>¿Mueves la plata a otra cuenta?</label>
        <select
          className="cc-select" value={bucketForm.movesCash === false ? 'no' : 'si'}
          onChange={(e) => setBucketForm((f) => ({ ...f, movesCash: e.target.value === 'si' }))}
        >
          <option value="si">Sí, la aparto de verdad</option>
          <option value="no">No, solo reservo el cupo</option>
        </select>
        <span className="cc-stat-sub" style={{ fontSize: 11 }}>
          La gasolina es lo segundo: guardas $160.000 pero se quedan en tu cuenta y
          van saliendo cuando tanqueas. Una reserva se mide por lo que gastas de ella.
        </span>
      </div>
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
  );
}
