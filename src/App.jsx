import { AlertTriangle, Loader2, Plus, CloudOff, Check } from 'lucide-react';
import { STYLES } from './styles.js';
import { FinanceProvider, useFinance } from './state/financeStore';
import Sidebar from './components/Sidebar';
import Resumen from './views/Resumen';
import Mes from './views/Mes';
import Cobros from './views/Cobros';
import Buckets from './views/Buckets';
import Deuda from './views/Deuda';
import Movimientos from './views/Movimientos';
import GastosFijos from './views/GastosFijos';
import Tarjetas from './views/Tarjetas';
import Deudas from './views/Deudas';
import Ahorros from './views/Ahorros';
import Configuracion from './views/Configuracion';
import PrintReport from './views/PrintReport';

const TABS = {
  mes: Mes,
  cobros: Cobros,
  buckets: Buckets,
  deuda: Deuda,
  resumen: Resumen,
  movimientos: Movimientos,
  gastosfijos: GastosFijos,
  tarjetas: Tarjetas,
  deudas: Deudas,
  ahorros: Ahorros,
  configuracion: Configuracion,
};

function Shell() {
  const { loading, saveError, loadError, offline, pendingChanges, activeTab, setActiveTab, handleOpenNewMovement } = useFinance();

  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="cc-app">
          <div className="cc-loading">
            <Loader2 size={26} className="cc-spin" />
            <span className="cc-mono" style={{ fontSize: 13 }}>Cargando tu día a día financiero...</span>
          </div>
        </div>
      </>
    );
  }

  const ActiveView = TABS[activeTab] || Resumen;

  return (
    <>
      <style>{STYLES}</style>
      <div className="cc-app">
        <Sidebar activeTab={activeTab} onChangeTab={setActiveTab} />
        <div className="cc-main">
          {loadError ? (
            <div className="cc-banner">
              <AlertTriangle size={15} />
              No pudimos cargar tus datos ({loadError}). No se guardará nada hasta poder leerlos,
              para no escribir encima de lo que ya tienes. Revisa tu conexión y recarga.
            </div>
          ) : null}
          {offline && (
            <div className="cc-banner cc-banner-offline">
              <CloudOff size={15} />
              {pendingChanges
                ? 'Sin conexión. Puedes seguir registrando: lo guardamos aquí y lo subimos apenas vuelva la señal.'
                : 'Sin conexión. Estás viendo tu última copia guardada.'}
            </div>
          )}
          {!offline && saveError && (
            <div className="cc-banner"><AlertTriangle size={15} /> No se pudieron guardar los últimos cambios. Revisa tu conexión.</div>
          )}
          {!offline && !saveError && pendingChanges && (
            <div className="cc-banner cc-banner-ok"><Check size={15} /> Guardando…</div>
          )}
          <ActiveView />
        </div>
      </div>
      <button type="button" className="cc-fab" onClick={handleOpenNewMovement} aria-label="Nuevo movimiento">
        <Plus size={26} strokeWidth={2.5} />
      </button>
      <PrintReport />
    </>
  );
}

export default function CuentaClaraApp() {
  return (
    <FinanceProvider>
      <Shell />
    </FinanceProvider>
  );
}
