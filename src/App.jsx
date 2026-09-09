import { Suspense, lazy } from 'react';
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
/*
 * Las pantallas se cargan cuando se abren, no al arrancar.
 *
 * Antes el bundle traía las diez de una, aunque solo mires una: las gráficas
 * de Resumen, la tabla de amortización de Deuda y el reporte de impresión
 * viajaban en el arranque incluso si nunca abrías esas pestañas. En el celular
 * con datos eso es medio segundo largo antes de ver nada.
 *
 * El resto de la app no cambia: cada pantalla sigue siendo el mismo componente
 * y el estado vive en el contexto, así que cambiar de pestaña no recarga nada
 * ya cargado. Lo único que se difiere es la PRIMERA vez que se abre cada una.
 */
const Resumen = lazy(() => import('./views/Resumen'));
const Mes = lazy(() => import('./views/Mes'));
const Calendario = lazy(() => import('./views/Calendario'));
const Cobros = lazy(() => import('./views/Cobros'));
const Tarjetas = lazy(() => import('./views/Tarjetas'));
const Buckets = lazy(() => import('./views/Buckets'));
const Deuda = lazy(() => import('./views/Deuda'));
const Movimientos = lazy(() => import('./views/Movimientos'));
const GastosFijos = lazy(() => import('./views/GastosFijos'));
const Configuracion = lazy(() => import('./views/Configuracion'));

/*
 * El reporte solo se dibuja al imprimir —vive detrás de un @media print— así
 * que cargarlo siempre era pagar por algo que casi nunca se usa.
 */
const PrintReport = lazy(() => import('./views/PrintReport'));

const TABS = {
  mes: Mes,
  calendario: Calendario,
  cobros: Cobros,
  tarjeta: Tarjetas,
  buckets: Buckets,
  deuda: Deuda,
  resumen: Resumen,
  movimientos: Movimientos,
  gastosfijos: GastosFijos,
  configuracion: Configuracion,
};

/*
 * Mientras llega el trozo de la pantalla. Ocupa alto para que el layout no dé
 * un salto cuando entra el contenido.
 */
function Cargando() {
  return (
    <div className="cc-loading" style={{ minHeight: 280 }}>
      <Loader2 size={22} className="cc-spin" />
    </div>
  );
}

function Shell() {
  const {
    loading, saveError, loadError, offline, pendingChanges, activeTab, setActiveTab,
    showTxForm, handleCancelTxForm, editingTxId,
    showFixedForm, handleCancelFixedForm, editingFixedId,
    showBucketForm, handleCancelBucketForm, editingBucketId,
    showDebtForm, handleCancelDebtForm, editingDebtId,
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
          <Suspense fallback={<Cargando />}><ActiveView /></Suspense>
        </div>

        <BotonAgregar />

        {/*
          * Las ventanas viven en el shell y no en cada pantalla: así se pueden
          * abrir desde el botón de agregar estés donde estés, sin tener que
          * navegar primero a la pestaña que las contenía.
          *
          * Y van DENTRO de .cc-app, que es donde están la tipografía y el
          * box-sizing de la app: colgadas por fuera heredaban la fuente serif
          * del navegador y el alto máximo no contaba el padding, así que en el
          * celular el formulario se salía por arriba de la pantalla.
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

        <Modal
          open={showDebtForm} onClose={handleCancelDebtForm}
          title={editingDebtId ? 'Editar deuda' : 'Nueva deuda'}
        >
          <FormDeuda />
        </Modal>

      </div>
      <Suspense fallback={null}><PrintReport /></Suspense>
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
