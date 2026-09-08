import { useEffect } from 'react';
import { X } from 'lucide-react';

/*
 * Ventana flotante centrada.
 *
 * Los formularios vivían empujando la pantalla hacia abajo: abrías "nuevo
 * movimiento" y la lista que estabas mirando se iba de la vista. En el celular
 * era peor, porque además tocaba bajar para encontrar el botón de guardar.
 *
 * Se cierra con Escape y tocando por fuera, que es lo que uno intenta primero.
 * Mientras está abierta el fondo no hace scroll: si no, en el celular uno mueve
 * la página de atrás creyendo que mueve el formulario.
 */
export default function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') onClose(); };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = overflowPrevio;
      window.removeEventListener('keydown', alTeclear);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="cc-modal-fondo"
      role="presentation"
      /*
       * Solo cierra si el clic empezó Y terminó en el fondo. Sin esto, soltar
       * el mouse fuera después de seleccionar texto dentro cerraba la ventana
       * y se perdía lo escrito.
       */
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="cc-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="cc-modal-head">
          <span className="cc-modal-titulo">{title}</span>
          <button
            type="button" className="cc-btn cc-btn-outline cc-btn-sm"
            onClick={onClose} aria-label="Cerrar"
          >
            <X size={15} />
          </button>
        </div>
        <div className="cc-modal-cuerpo">{children}</div>
      </div>
    </div>
  );
}
