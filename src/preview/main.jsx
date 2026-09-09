import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STYLES } from '../styles.js';
import { FinanceContext } from '../state/financeStore';
import { buildValue } from './fixture.js';
import Mes from '../views/Mes';
import Quincenas from '../views/Quincenas';
import Cobros from '../views/Cobros';
import Buckets from '../views/Buckets';
import Deuda from '../views/Deuda';
import Resumen from '../views/Resumen';
import GastosFijos from '../views/GastosFijos';
import Movimientos from '../views/Movimientos';
import Modal from '../components/Modal';
import BotonAgregar from '../components/BotonAgregar';
import FormMovimiento from '../components/forms/FormMovimiento';
import FormDeuda from '../components/forms/FormDeuda';

/*
 * Banco de pruebas de las pantallas. Se abre con `npm run dev` en /preview.html
 * y no entra en el build de produccion: vite solo empaqueta index.html.
 */
/* Las ventanas también se prueban aquí: son pantalla, aunque floten. */
function VentanaMovimiento() {
  return <Modal open title="Nuevo movimiento" onClose={() => {}}><FormMovimiento /></Modal>;
}
function VentanaDeuda() {
  return <Modal open title="Nueva deuda" onClose={() => {}}><FormDeuda /></Modal>;
}
function Boton() { return <BotonAgregar />; }

const PANTALLAS = {
  Mes, Quincenas, Cobros, Buckets, Deuda, Resumen, GastosFijos, Movimientos,
  VentanaMovimiento, VentanaDeuda, Boton,
};

function Preview() {
  const [cual, setCual] = useState('Mes');
  const [deuda, setDeuda] = useState(null);
  const Vista = PANTALLAS[cual];
  return (
    <FinanceContext.Provider value={buildValue({ selectedDebtId: deuda, setSelectedDebtId: setDeuda })}>
      <style>{STYLES}</style>
      <div className="cc-app">
        <div className="cc-main" style={{ padding: 20 }}>
          <select
            className="cc-select"
            style={{ maxWidth: 220, marginBottom: 16 }}
            value={cual}
            onChange={(e) => setCual(e.target.value)}
          >
            {Object.keys(PANTALLAS).map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <Vista />
        </div>
      </div>
    </FinanceContext.Provider>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><Preview /></StrictMode>);
