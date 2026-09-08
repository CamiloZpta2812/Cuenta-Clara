import { useState } from 'react';
import {
  Plus, X, ArrowLeftRight, Repeat, Shield, CreditCard, HandCoins,
} from 'lucide-react';
import { useFinance } from '../state/financeStore';

/*
 * El botón de agregar, con todo lo que se puede agregar.
 *
 * Antes solo abría el formulario de movimiento, y las otras cinco cosas —un
 * gasto fijo, un colchón, una deuda— estaban cada una escondida en su pantalla.
 * Para registrar un gasto fijo había que acordarse de en qué pestaña vive el
 * botón que lo crea.
 *
 * El orden no es alfabético ni por importancia conceptual: es por cuántas veces
 * al día se usa. Un movimiento se registra a diario; una deuda, dos veces al
 * año — así que el movimiento queda pegado al botón y la deuda arriba del todo.
 */

export default function BotonAgregar() {
  const {
    handleOpenNewMovement, setShowFixedForm, setShowBucketForm, setShowDebtForm,
    setActiveTab, handleCancelBucketForm,
  } = useFinance();
  const [abierto, setAbierto] = useState(false);

  const cerrarY = (fn) => () => { setAbierto(false); fn(); };

  /*
   * El menú se dibuja de arriba hacia abajo, así que el ÚLTIMO de esta lista
   * queda pegado al botón — o sea, el más fácil de alcanzar con el pulgar.
   * Por eso va al revés de como se lee: lo que más se usa, de último.
   *
   * Las dos de arriba no abren ventana, llevan a su pantalla: registrar un
   * abono necesita ver el saldo y el plan de pago al lado, y marcar un cobro
   * solo tiene sentido con la lista de quién te debe enfrente.
   */
  const opciones = [
    { label: 'Nueva deuda', Icon: CreditCard, onClick: cerrarY(() => setShowDebtForm(true)) },
    { label: 'Pago de deuda', Icon: CreditCard, onClick: cerrarY(() => setActiveTab('deuda')) },
    {
      label: 'Ahorro o colchón',
      Icon: Shield,
      /* Por el cancelar, que además limpia lo que hubiera quedado de una edición. */
      onClick: cerrarY(() => { handleCancelBucketForm(); setShowBucketForm(true); }),
    },
    { label: 'Marcar un cobro', Icon: HandCoins, onClick: cerrarY(() => setActiveTab('cobros')) },
    { label: 'Gasto fijo', Icon: Repeat, onClick: cerrarY(() => setShowFixedForm(true)) },
    {
      label: 'Gasto o ingreso', Icon: ArrowLeftRight, destacado: true,
      onClick: cerrarY(handleOpenNewMovement),
    },
  ];

  return (
    <>
      {abierto && (
        <div
          className="cc-fab-scrim" role="presentation"
          onClick={() => setAbierto(false)}
        />
      )}

      <div className="cc-fab-wrap">
        {abierto && (
          <div className="cc-fab-menu">
            {opciones.map((o) => (
              <button
                key={o.label} type="button"
                className={`cc-fab-item ${o.destacado ? 'destacado' : ''}`}
                onClick={o.onClick}
              >
                <o.Icon size={15} /> {o.label}
              </button>
            ))}
          </div>
        )}

        <button
          type="button" className="cc-fab"
          onClick={() => setAbierto((v) => !v)}
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar' : 'Agregar'}
        >
          {abierto ? <X size={24} strokeWidth={2.5} /> : <Plus size={26} strokeWidth={2.5} />}
        </button>
      </div>
    </>
  );
}
