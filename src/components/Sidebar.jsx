import { LayoutDashboard, ArrowLeftRight, CreditCard, Settings, Repeat, CalendarRange, CalendarClock, HandCoins, Shield, Landmark } from 'lucide-react';
import Logo from './Logo';
import { rutaDeTab } from '../lib/rutas.js';

export default function Sidebar({ activeTab, onChangeTab }) {
  /*
   * El orden es el de la pregunta que uno se hace, de la más frecuente a la
   * más ocasional. Tarjeta va casi al final porque se consulta poco, pero fuera
   * de Configuración: esconderla ahí la volvía difícil de encontrar.
   */
  const items = [
    { id: 'resumen', label: 'Resumen', Icon: LayoutDashboard },
    { id: 'mes', label: 'El mes', Icon: CalendarRange },
    { id: 'calendario', label: 'Calendario', Icon: CalendarClock },
    { id: 'gastosfijos', label: 'Gastos fijos', Icon: Repeat },
    { id: 'cobros', label: 'Cobros', Icon: HandCoins },
    { id: 'buckets', label: 'Ahorro y colchones', Icon: Shield },
    { id: 'deuda', label: 'Deuda', Icon: CreditCard },
    { id: 'movimientos', label: 'Movimientos', Icon: ArrowLeftRight },
    { id: 'tarjeta', label: 'Tarjeta', Icon: Landmark },
    { id: 'configuracion', label: 'Configuración', Icon: Settings },
  ];

  return (
    <div className="cc-sidebar">
      <div className="cc-brand">
        <span className="cc-brand-logo" aria-hidden="true"><Logo size={26} /></span>
        <div>
          <div className="cc-brand-title">AlDía</div>
          <div className="cc-brand-sub">tu día a día financiero</div>
        </div>
      </div>
      <div className="cc-nav">
        {/*
          * Enlaces de verdad y no botones: ahora que cada pestaña tiene su
          * dirección, con un <a> el navegador da gratis lo que un botón no
          * puede —clic derecho para copiar el enlace, ctrl+clic para abrir en
          * otra pestaña, y la dirección abajo al pasar por encima—. El clic
          * normal lo seguimos manejando nosotros para no recargar la página.
          */}
        {items.map((it) => (
          <a
            key={it.id}
            href={rutaDeTab(it.id)}
            className={`cc-nav-item ${activeTab === it.id ? 'active' : ''}`}
            aria-current={activeTab === it.id ? 'page' : undefined}
            onClick={(e) => {
              /* Ctrl/cmd+clic y el botón del medio son del navegador. */
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onChangeTab(it.id);
            }}
          >
            <it.Icon size={17} />
            {it.label}
          </a>
        ))}
      </div>
    </div>
  );
}
