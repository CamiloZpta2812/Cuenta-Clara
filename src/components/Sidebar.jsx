import { LayoutDashboard, ArrowLeftRight, CreditCard, PiggyBank, Landmark, Settings, Repeat, CalendarRange, HandCoins, Shield } from 'lucide-react';
import Logo from './Logo';

export default function Sidebar({ activeTab, onChangeTab }) {
  const items = [
    { id: 'mes', label: 'El mes', Icon: CalendarRange },
    { id: 'cobros', label: 'Cobros', Icon: HandCoins },
    { id: 'resumen', label: 'Resumen', Icon: LayoutDashboard },
    { id: 'movimientos', label: 'Movimientos', Icon: ArrowLeftRight },
    { id: 'gastosfijos', label: 'Gastos fijos', Icon: Repeat },
    { id: 'tarjetas', label: 'Tarjetas', Icon: Landmark },
    { id: 'deuda', label: 'Deuda', Icon: CreditCard },
    { id: 'deudas', label: 'Deudas', Icon: CreditCard },
    { id: 'buckets', label: 'Ahorro y colchones', Icon: Shield },
    { id: 'ahorros', label: 'Ahorros', Icon: PiggyBank },
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
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`cc-nav-item ${activeTab === it.id ? 'active' : ''}`}
            onClick={() => onChangeTab(it.id)}
          >
            <it.Icon size={17} />
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}
