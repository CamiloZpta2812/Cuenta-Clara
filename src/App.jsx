import { AlertTriangle, Loader2, CloudOff, Check } from 'lucide-react';
import { STYLES } from './styles.js';
import { FinanceProvider, useFinance } from './state/financeStore';
import Sidebar from './components/Sidebar';
import BotonAgregar from './components/BotonAgregar';
import Modal from './components/Modal';
import FormMovimiento from './components/forms/FormMovimiento';
import FormGastoFijo from './components/forms/FormGastoFijo';
import FormBucket from './components/forms/FormBucket';
import FormDeuda from './components/forms/FormDeuda';
import Resumen from './views/Resumen';
import Mes from './views/Mes';
import Cobros from './views/Cobros';
import Tarjetas from './views/Tarjetas';
import Buckets from './views/Buckets';
import Deuda from './views/Deuda';
import Movimientos from './views/Movimientos';
import GastosFijos from './views/GastosFijos';
import Configuracion from './views/Configuracion';
import PrintReport from './views/PrintReport';

const TABS = {
  mes: Mes,
  cobros: Cobros,
  tarjeta: Tarjetas,
  buckets: Buckets,
  deuda: Deuda,
  resumen: Resumen,
  movimientos: Movimientos,
  gastosfijos: GastosFijos,
  configuracion: Configuracion,
};

function Shell() {
  const {
    loading, saveError, loadError, offline, pendingChanges, activeTab, setActiveTab,
    showTxForm, handleCancelTxForm, editingTxId,
    showFixedForm, handleCancelFixedForm, editingFixedId,
    showBucketForm, handleCancelBucketForm, editingBucketId,
    showDebtForm, handleCancelDebtForm,
  } = useFinance();

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
      <BotonAgregar />

      {/*
        * Las ventanas viven en el shell y no en cada pantalla: así se pueden
        * abrir desde el botón de agregar estés donde estés, sin tener que
        * navegar primero a la pestaña que las contenía.
        */}
      <Modal
        open={showTxForm} onClose={handleCancelTxForm}
        title={editingTxId ? 'Editar movimiento' : 'Nuevo movimiento'}
      >
        <FormMovimiento />
      </Modal>

      <Modal
        open={showFixedForm} onClose={handleCancelFixedForm}
        title={editingFixedId ? 'Editar gasto fijo' : 'Nuevo gasto fijo'}
      >
        <FormGastoFijo />
      </Modal>

      <Modal
        open={showBucketForm} onClose={handleCancelBucketForm}
        title={editingBucketId ? 'Editar meta o colchón' : 'Nueva meta o colchón'}
      >
        <FormBucket />
      </Modal>

      <Modal open={showDebtForm} onClose={handleCancelDebtForm} title="Nueva deuda">
        <FormDeuda />
      </Modal>

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
