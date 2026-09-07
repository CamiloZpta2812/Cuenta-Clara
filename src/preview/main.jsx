import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { STYLES } from '../styles.js';
import { FinanceContext } from '../state/financeStore';
import { buildValue } from './fixture.js';
import Mes from '../views/Mes';
import Cobros from '../views/Cobros';
import Buckets from '../views/Buckets';

/*
 * Banco de pruebas de las pantallas. Se abre con `npm run dev` en /preview.html
 * y no entra en el build de produccion: vite solo empaqueta index.html.
 */
const PANTALLAS = { Mes, Cobros, Buckets };

function Preview() {
  const [cual, setCual] = useState('Mes');
  const Vista = PANTALLAS[cual];
  return (
    <FinanceContext.Provider value={buildValue()}>
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
