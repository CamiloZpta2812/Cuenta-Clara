import {
  TrendingUp, TrendingDown, Landmark, PiggyBank, ShoppingBag, Shield,
  AlertTriangle, Wallet, CreditCard, HandCoins, Check,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthLabel } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';

/*
 * El mes: plan contra realidad.
 *
 * La pantalla de Resumen suma lo que ya pasó. Esta responde la pregunta que de
 * verdad importa cada mes: voy bien o me desvié, en cuál línea, y cuánto me
 * queda libre para abonarle a la deuda.
 *
 * Todo el cálculo viene de lib/month.js. Aquí no se hace ni una resta.
 */

/* Las líneas de la cascada, en el orden en que se restan. */
const LINEAS = [
  { key: 'income',        label: 'Ingresos',            Icon: TrendingUp },
  { key: 'fixedExpenses', label: 'Gastos fijos',        Icon: Landmark },
  { key: 'debtPayment',   label: 'Cuota de la deuda',   Icon: CreditCard },
  { key: 'savings',       label: 'Metas de ahorro',     Icon: PiggyBank },
  { key: 'variable',      label: 'Gasto variable',      Icon: ShoppingBag },
  { key: 'cushion',       label: 'Colchones',           Icon: Shield },
];

/*
 * Un desvío no es bueno ni malo por su signo: gastar de menos es bueno, ingresar
 * de menos es malo. Por eso cada línea dice hacia dónde le conviene desviarse.
 */
function tono(key, desvio) {
  if (Math.abs(desvio) < 1) return 'neutro';
  const masEsMejor = key === 'income';
  const bueno = masEsMejor ? desvio > 0 : desvio < 0;
  return bueno ? 'bien' : 'mal';
}

const COLOR_TONO = { bien: COLORS.income, mal: COLORS.expense, neutro: COLORS.inkSoft };

export default function Mes() {
  const {
    availableMonths, selectedMonth, setSelectedMonth, monthReport, cardOutlook, people,
  } = useFinance();

  /* El cobro guarda a quién le cobras por id; el nombre vive en `people`. */
  const nombreDe = (personId) => {
    const p = people.find((x) => x.id === personId);
    return p ? p.name : 'Alguien que ya no está';
  };

  const { plan, real, deviations, salidas, collections, alerts } = monthReport;
  const pendientes = collections.filter((c) => !c.collected);
  const porCobrar = pendientes.reduce((s, c) => s + c.amount, 0);

  const meses = availableMonths.includes(selectedMonth)
    ? availableMonths
    : [selectedMonth, ...availableMonths];

  return (
    <>
      <div className="cc-page-title">El mes</div>
      <p className="cc-page-sub">
        Lo que planeaste contra lo que llevas, y cuánto te queda libre para abonarle a la deuda.
      </p>

      <div className="cc-section-head">
        <select
          className="cc-select"
          style={{ maxWidth: 160 }}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        {plan.locked && (
          <div className="cc-stamp" style={{ color: COLORS.inkSoft }}>
            <Check size={16} /> Mes cerrado — se juzga contra el plan que tenía
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------- el número */}
      <div className="cc-card" style={{ textAlign: 'center', padding: '22px 16px' }}>
        <p className="cc-chart-title" style={{ marginBottom: 6 }}>
          Disponible para abonarle de más a la deuda
        </p>
        <div
          className="cc-mono"
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: plan.availableForExtra < 0 ? COLORS.expense : COLORS.income,
          }}
        >
          {fmtCOP(plan.availableForExtra)}
        </div>
        {plan.availableForExtra < 0 ? (
          <p className="cc-page-sub" style={{ marginTop: 8 }}>
            El plan no cierra: no alcanza ni para la cuota mínima. No es que no abones
            extra — es que falta plata para lo que ya está comprometido.
          </p>
        ) : (
          <p className="cc-page-sub" style={{ marginTop: 8 }}>
            Encima de la cuota de {fmtCOP(plan.debtPayment)}, este mes puedes mandarle
            esto sin tocar nada de lo demás.
          </p>
        )}
      </div>

      {/* ------------------------------------------------------------ alertas */}
      {alerts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {alerts.map((a) => (
            <div
              key={a.type}
              className="cc-banner"
              style={a.severity === 'alerta' ? undefined : { opacity: 0.92 }}
            >
              <AlertTriangle size={15} />
              <span><strong>{a.title}.</strong> {a.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- la cascada */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">Plan contra realidad</p>
        <div className="cc-commit-list">
          {LINEAS.map(({ key, label, Icon }) => {
            const desvio = deviations[key] || 0;
            const t = tono(key, desvio);
            return (
              <div key={key} className="cc-commit-row">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={14} /> {label}
                </span>
                <span className="cc-mono" style={{ opacity: 0.7 }}>
                  {fmtCOP(plan[key] || 0)}
                </span>
                <span className="cc-mono">{fmtCOP(real[key] || 0)}</span>
                <span className="cc-mono" style={{ color: COLOR_TONO[t] }}>
                  {desvio === 0 ? '—' : `${desvio > 0 ? '+' : ''}${fmtCOP(desvio)}`}
                </span>
              </div>
            );
          })}
        </div>
        <p className="cc-page-sub" style={{ marginTop: 10 }}>
          Planeado · lo que llevas · la diferencia. Un desvío en verde te deja más plata
          para la deuda; uno en rojo te la quita.
        </p>
      </div>

      {/* -------------------------------------------------------- salida caja */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">Lo que sale de tu cuenta</p>
        <div className="cc-commit-list">
          <div className="cc-commit-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={14} /> Gastaste este mes
            </span>
            <span className="cc-mono">{fmtCOP(real.fixedExpenses + real.variable)}</span>
          </div>
          <div className="cc-commit-row">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={14} /> Salió de la cuenta
            </span>
            <span className="cc-mono">{fmtCOP(salidas.total)}</span>
          </div>
          {salidas.conTarjeta > 0 && (
            <div className="cc-commit-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={14} /> De eso, factura de tarjeta
              </span>
              <span className="cc-mono">{fmtCOP(salidas.conTarjeta)}</span>
            </div>
          )}
          {cardOutlook.committed > 0 && (
            <div className="cc-commit-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CreditCard size={14} /> Comprometido en cuotas
              </span>
              <span className="cc-mono" style={{ color: COLORS.debt }}>
                {fmtCOP(cardOutlook.committed)}
              </span>
            </div>
          )}
        </div>
        <p className="cc-page-sub" style={{ marginTop: 10 }}>
          No son lo mismo: una compra con tarjeta es gasto del mes en que la hiciste,
          pero la plata sale cuando llega la factura.
          {cardOutlook.committed > 0 && ' Lo comprometido son las cuotas que faltan por cobrarte: plata que ya no es tuya aunque siga en la cuenta.'}
        </p>
      </div>

      {/* ------------------------------------------------------------- cobros */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">Lo que te deben este mes</p>
        {collections.length === 0 ? (
          <EmptyState
            Icon={HandCoins}
            title="No tienes nada repartido"
            text="Cuando compartas un gasto fijo con alguien, sus cobros aparecen aquí."
          />
        ) : (
          <>
            <div className="cc-commit-list">
              {collections.map((c) => (
                <div key={c.shareId} className="cc-commit-row">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.collected
                      ? <Check size={14} color={COLORS.income} />
                      : <HandCoins size={14} />}
                    {nombreDe(c.personId)} · {c.fixedExpenseName}
                  </span>
                  <span
                    className="cc-mono"
                    style={{ color: c.collected ? COLORS.income : undefined }}
                  >
                    {fmtCOP(c.amount)}
                  </span>
                  <span className="cc-tag">{c.collected ? 'Cobrado' : 'Pendiente'}</span>
                </div>
              ))}
            </div>
            {porCobrar > 0 && (
              <p className="cc-page-sub" style={{ marginTop: 10 }}>
                <TrendingDown size={13} /> Te faltan {fmtCOP(porCobrar)} por cobrar.
                Si se te pasa todos los meses son {fmtCOP(porCobrar * 12)} al año.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
