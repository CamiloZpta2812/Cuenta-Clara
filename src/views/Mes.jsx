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

/*
 * Las líneas de la cascada, en el orden en que se restan.
 *
 * `clase` dice cómo hay que leer un desvío, que no es lo mismo en todas:
 *
 *   rendimiento  la línea mide cómo te fue. Ingresar más es bueno, gastar de
 *                más es malo, y el color lo dice.
 *
 *   compromiso   la línea es plata que YA prometiste y que va a salir sí o sí.
 *                Quedarte corto no es un logro: es que todavía no ha salido, o
 *                no la registraste. Decirle "ahorraste" a eso sería mentir —
 *                justo el error que hacía que la app vieja se sintiera bien
 *                mientras el mes se desarmaba.
 */
const LINEAS = [
  { key: 'income',        label: 'Ingresos',          Icon: TrendingUp,  clase: 'rendimiento', masEsMejor: true },
  { key: 'fixedExpenses', label: 'Gastos fijos',      Icon: Landmark,    clase: 'compromiso' },
  { key: 'debtPayment',   label: 'Cuota de la deuda', Icon: CreditCard,  clase: 'compromiso' },
  { key: 'savings',       label: 'Metas de ahorro',   Icon: PiggyBank,   clase: 'compromiso' },
  { key: 'variable',      label: 'Gasto variable',    Icon: ShoppingBag, clase: 'rendimiento', masEsMejor: false },
  { key: 'cushion',       label: 'Colchones',         Icon: Shield,      clase: 'compromiso' },
];

/*
 * Cómo se lee un desvío. Devuelve el texto y el color, juntos, porque decidir
 * el color sin el texto es lo que producía "$-376.000" en verde para "ahorraste
 * 376.000 menos de lo que dijiste".
 */
function leerDesvio(linea, desvio) {
  if (Math.abs(desvio) < 1) return { texto: 'Al día', color: COLORS.inkSoft };

  if (linea.clase === 'compromiso') {
    return desvio < 0
      // Falta que salga: ni bueno ni malo todavía, solo pendiente.
      ? { texto: `Faltan ${fmtCOP(-desvio)}`, color: COLORS.inkSoft }
      : { texto: `${fmtCOP(desvio)} de más`, color: COLORS.expense };
  }

  const bueno = linea.masEsMejor ? desvio > 0 : desvio < 0;
  return {
    texto: `${desvio > 0 ? '+' : ''}${fmtCOP(desvio)}`,
    color: bueno ? COLORS.income : COLORS.expense,
  };
}

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
          <div className="cc-plan-row cc-plan-head">
            <span>Concepto</span>
            <span>Planeado</span>
            <span>Vas</span>
            <span>Diferencia</span>
          </div>
          {LINEAS.map((linea) => {
            const { key, label, Icon } = linea;
            const d = leerDesvio(linea, deviations[key] || 0);
            return (
              <div key={key} className="cc-plan-row">
                <span className="cc-plan-concept"><Icon size={14} /> {label}</span>
                <span className="cc-mono" style={{ opacity: 0.65 }}>{fmtCOP(plan[key] || 0)}</span>
                <span className="cc-mono">{fmtCOP(real[key] || 0)}</span>
                <span className="cc-mono" style={{ color: d.color }}>{d.texto}</span>
              </div>
            );
          })}
        </div>
        <p className="cc-page-sub" style={{ marginTop: 10 }}>
          Los gastos fijos, la cuota, el ahorro y los colchones son plata ya comprometida:
          quedarte corto ahí no es que hayas ahorrado, es que todavía no ha salido. Solo
          los ingresos y el gasto variable se pintan como algo que te fue bien o mal.
        </p>
      </div>

      {/* -------------------------------------------------------- salida caja */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">Lo que sale de tu cuenta</p>
        <div className="cc-commit-list">
          <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
            <span className="cc-plan-concept">
              <ShoppingBag size={14} /> Gastaste este mes
            </span>
            <span className="cc-mono">{fmtCOP(real.fixedExpenses + real.variable)}</span>
          </div>
          <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
            <span className="cc-plan-concept">
              <Wallet size={14} /> Salió de la cuenta
            </span>
            <span className="cc-mono">{fmtCOP(salidas.total)}</span>
          </div>
          {salidas.conTarjeta > 0 && (
            <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
              <span className="cc-plan-concept">
                <CreditCard size={14} /> De eso, factura de tarjeta
              </span>
              <span className="cc-mono">{fmtCOP(salidas.conTarjeta)}</span>
            </div>
          )}
          {cardOutlook.committed > 0 && (
            <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
              <span className="cc-plan-concept">
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
                <div key={c.shareId} className="cc-plan-row" style={{ gridTemplateColumns: '1fr 96px 88px' }}>
                  <span className="cc-plan-concept">
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
