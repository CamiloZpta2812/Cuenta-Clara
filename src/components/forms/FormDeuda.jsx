import { AlertTriangle } from 'lucide-react';
import { useFinance } from '../../state/financeStore';

/*
 * Crear una deuda.
 *
 * Este formulario existía en la pantalla vieja de Deudas y se fue con ella al
 * reemplazarla: quedó una app donde se podía abonar a una deuda pero no
 * registrar una nueva. Vuelve como ventana, y ahora nace con los campos del
 * modelo nuevo —cuota pactada, saldo actual, modo de amortización— sin los
 * cuales la deuda no aparecería ni en el plan ni en la proyección.
 */
export default function FormDeuda() {
  const {
    debtForm, setDebtForm, debtFormError, handleAddDebt, usdRate,
  } = useFinance();

  const enUSD = debtForm.currency === 'USD';

  return (
    <form className="cc-form" onSubmit={handleAddDebt}>
      {debtFormError && (
        <div className="cc-banner cc-field-full">
          <AlertTriangle size={15} /> {debtFormError}
        </div>
      )}

      <div className="cc-field cc-field-full">
        <label>¿Qué deuda es?</label>
        <input
          className="cc-input" type="text" required
          placeholder="Libre inversión Bancolombia, tarjeta, préstamo a un amigo..."
          value={debtForm.name}
          onChange={(e) => setDebtForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div className="cc-field">
        <label>Cuánto debes hoy</label>
        <input
          className="cc-input" type="number" min="0" step="any" required placeholder="14000000"
          value={debtForm.totalAmount}
          onChange={(e) => setDebtForm((f) => ({ ...f, totalAmount: e.target.value }))}
        />
        <span className="cc-stat-sub" style={{ fontSize: 11 }}>
          El saldo, no el monto original: es de ahí que arranca la proyección.
        </span>
      </div>

      <div className="cc-field">
        <label>Cuota mensual</label>
        <input
          className="cc-input" type="number" min="0" step="any" placeholder="446413"
          value={debtForm.monthlyPayment}
          onChange={(e) => setDebtForm((f) => ({ ...f, monthlyPayment: e.target.value }))}
        />
        <span className="cc-stat-sub" style={{ fontSize: 11 }}>
          Lo pactado con el banco. Sale del plan todos los meses.
        </span>
      </div>

      <div className="cc-field">
        <label>Interés mensual (%)</label>
        <input
          className="cc-input" type="number" min="0" step="any" placeholder="1.67"
          value={debtForm.interestRate}
          onChange={(e) => setDebtForm((f) => ({ ...f, interestRate: e.target.value }))}
        />
        <span className="cc-stat-sub" style={{ fontSize: 11 }}>
          Mensual, como lo reporta el banco — no el anual. Sin esto no se puede
          calcular cuándo se acaba.
        </span>
      </div>

      <div className="cc-field">
        <label>Día de pago</label>
        <input
          className="cc-input" type="number" min="1" max="31" placeholder="15"
          value={debtForm.dueDay}
          onChange={(e) => setDebtForm((f) => ({ ...f, dueDay: e.target.value }))}
        />
      </div>

      <div className="cc-field">
        <label>Cuándo te la desembolsaron</label>
        <input
          className="cc-input" type="date"
          value={debtForm.startDate}
          onChange={(e) => setDebtForm((f) => ({ ...f, startDate: e.target.value }))}
        />
        <span className="cc-stat-sub" style={{ fontSize: 11 }}>
          La primera cuota se cuenta desde el mes siguiente.
        </span>
      </div>

      <div className="cc-field">
        <label>Moneda</label>
        <select
          className="cc-select" value={debtForm.currency}
          onChange={(e) => setDebtForm((f) => ({ ...f, currency: e.target.value }))}
        >
          <option value="COP">Pesos (COP)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </div>

      {enUSD && (
        <div className="cc-field">
          <label>Tasa de cambio (COP por USD)</label>
          <input
            className="cc-input" type="number" min="0" step="any"
            placeholder={usdRate ? String(usdRate) : '4000'}
            value={debtForm.exchangeRate}
            onChange={(e) => setDebtForm((f) => ({ ...f, exchangeRate: e.target.value }))}
          />
          <span className="cc-stat-sub" style={{ fontSize: 11 }}>
            {usdRate ? `Hoy va en ${usdRate}. Déjalo vacío para usar esa.` : 'No pudimos traerla: escríbela.'}
          </span>
        </div>
      )}

      <div className="cc-form-actions">
        <button type="submit" className="cc-btn cc-btn-primary">Guardar deuda</button>
      </div>
    </form>
  );
}
