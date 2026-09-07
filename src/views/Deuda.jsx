import { useState } from 'react';
import {
  CreditCard, TrendingDown, CalendarCheck, Flame, AlertTriangle, Sparkles, ChevronDown,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { addMonths, currentMonthKey, monthLabel } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import StatCard from '../components/StatCard';
import EmptyState from '../components/EmptyState';
import { useFinance } from '../state/financeStore';

/*
 * La deuda, con el número que de verdad mueve a alguien.
 *
 * La app vieja mostraba "total menos lo abonado" y ya. Eso no dice lo único
 * que importa: cuándo se acaba, cuánto de cada cuota se va en intereses, y qué
 * pasa si le mandas lo que te sobra.
 *
 * Todo el cálculo viene de lib/amortization.js.
 */

/* Las palancas del simulador: lo que de verdad puedes mover en un mes. */
const PALANCAS = [
  { key: 'cushion',  label: 'Colchones',      ayuda: 'Guardar menos por si acaso' },
  { key: 'variable', label: 'Gasto variable', ayuda: 'Salir menos, mercar más barato' },
  { key: 'savings',  label: 'Metas de ahorro', ayuda: 'Aplazar el ahorro con destino' },
];

function mesesATexto(n) {
  if (n === 1) return '1 mes';
  if (n < 12) return `${n} meses`;
  const años = Math.floor(n / 12);
  const resto = n % 12;
  const a = años === 1 ? '1 año' : `${años} años`;
  return resto === 0 ? a : `${a} y ${resto} ${resto === 1 ? 'mes' : 'meses'}`;
}

export default function Deuda() {
  const { debtOutlook, simulatePlan } = useFinance();
  const [ajustes, setAjustes] = useState({});
  const [verTabla, setVerTabla] = useState(false);

  if (!debtOutlook) {
    return (
      <>
        <div className="cc-page-title">Deuda</div>
        <EmptyState
          Icon={CreditCard}
          title="No tienes deudas registradas"
          text="Cuando registres una, aquí ves cuándo se acaba y cuánto te ahorras abonándole de más."
        />
      </>
    );
  }

  const { debt, extra, minimumOnly, withExtra, monthsSaved, interestSaved } = debtOutlook;

  /* Los cambios del simulador son sumas y restas sobre el plan, no valores nuevos. */
  const cambios = Object.fromEntries(
    Object.entries(ajustes)
      .map(([k, v]) => [k, parseFloat(v) || 0])
      .filter(([, v]) => v !== 0),
  );
  const sim = Object.keys(cambios).length > 0 ? simulatePlan(cambios) : null;

  const fin = withExtra.feasible
    ? monthLabel(addMonths(currentMonthKey(), withExtra.months))
    : null;

  return (
    <>
      <div className="cc-page-title">Deuda</div>
      <p className="cc-page-sub">
        {debt.name} · {fmtCOP(debt.currentBalance)} al {debt.interestRate}% mensual ·
        cuota de {fmtCOP(debt.fixedPayment)}
      </p>

      {/* ------------------------------------------------------ cuándo se acaba */}
      <div className="cc-card" style={{ textAlign: 'center', padding: '22px 16px' }}>
        {withExtra.feasible ? (
          <>
            <p className="cc-chart-title" style={{ marginBottom: 6 }}>
              Abonando {fmtCOP(extra)} de más cada mes, se acaba en
            </p>
            <div className="cc-mono" style={{ fontSize: 34, fontWeight: 700, color: COLORS.income }}>
              {mesesATexto(withExtra.months)}
            </div>
            <p className="cc-page-sub" style={{ marginTop: 8 }}>
              Última cuota en {fin}. Pagarías {fmtCOP(withExtra.totalInterest)} de intereses.
            </p>
          </>
        ) : (
          <>
            <p className="cc-chart-title" style={{ marginBottom: 6, color: COLORS.expense }}>
              Con lo que estás pagando, esta deuda no se acaba
            </p>
            <p className="cc-page-sub">
              La cuota no alcanza a cubrir ni los intereses del mes. Necesitas al menos{' '}
              <strong>{fmtCOP(withExtra.minimumPayment)}</strong> mensuales solo para que
              el saldo deje de subir.
            </p>
          </>
        )}
      </div>

      {/* --------------------------------------------- lo que gana el abono */}
      {extra > 0 && monthsSaved != null && (
        <div className="cc-stats-grid" style={{ marginTop: 14 }}>
          <StatCard
            label="Solo con la cuota" value={mesesATexto(minimumOnly.months)}
            Icon={CalendarCheck} color={COLORS.inkSoft} bg="var(--paper)"
            sub={`${fmtCOP(minimumOnly.totalInterest)} de intereses`}
          />
          <StatCard
            label="Meses que te ahorras" value={mesesATexto(monthsSaved)}
            Icon={Flame} color={COLORS.income} bg="var(--income-soft)"
            sub={`Por mandarle ${fmtCOP(extra)} al mes`}
          />
          <StatCard
            label="Intereses que no pagas" value={fmtCOP(interestSaved)}
            Icon={TrendingDown} color={COLORS.income} bg="var(--income-soft)"
            sub="Plata que se queda contigo"
          />
        </div>
      )}

      {/* ------------------------------------------------------- simulador */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">¿Y si muevo algo del plan?</p>
        <p className="cc-page-sub">
          Escribe cuánto le subes o le bajas a cada línea. Un número negativo baja esa
          línea y le deja más plata a la deuda.
        </p>

        <div className="cc-form" style={{ marginTop: 4 }}>
          {PALANCAS.map(({ key, label, ayuda }) => (
            <div className="cc-field" key={key}>
              <label>{label}</label>
              <input
                className="cc-input" type="number" step="any" placeholder="0"
                value={ajustes[key] || ''}
                onChange={(e) => setAjustes((a) => ({ ...a, [key]: e.target.value }))}
              />
              <span className="cc-stat-sub" style={{ fontSize: 11 }}>{ayuda}</span>
            </div>
          ))}
        </div>

        {sim && (
          <div style={{ marginTop: 12 }}>
            {sim.deficit && (
              <div className="cc-banner">
                <AlertTriangle size={15} />
                <span>
                  <strong>Con ese cambio el plan no cierra.</strong> El abono quedaría en{' '}
                  {fmtCOP(sim.extraAfter)}: no alcanza ni para la cuota.
                </span>
              </div>
            )}
            {sim.becomesUnpayable && (
              <div className="cc-banner">
                <AlertTriangle size={15} />
                <span>
                  <strong>Así la deuda no se acabaría nunca.</strong> Lo que quedaría no
                  cubre ni los intereses del mes.
                </span>
              </div>
            )}
            {!sim.becomesUnpayable && sim.monthsDifference != null && (
              <div className="cc-banner cc-banner-ok">
                <Sparkles size={15} />
                <span>
                  El abono pasa de {fmtCOP(sim.extraBefore)} a {fmtCOP(sim.extraAfter)}, y la
                  deuda{' '}
                  {sim.monthsDifference === 0 ? (
                    <>se acaba <strong>en el mismo mes</strong></>
                  ) : sim.monthsDifference > 0 ? (
                    <>
                      se acaba <strong>{mesesATexto(sim.monthsDifference)} antes</strong>
                      {sim.interestDifference > 0 && <> y te ahorras {fmtCOP(sim.interestDifference)} de intereses</>}
                    </>
                  ) : (
                    <>
                      se demora <strong>{mesesATexto(-sim.monthsDifference)} más</strong>
                      {sim.interestDifference < 0 && <> y te cuesta {fmtCOP(-sim.interestDifference)} de intereses</>}
                    </>
                  )}.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --------------------------------------------------------- la tabla */}
      {withExtra.feasible && (
        <div className="cc-card" style={{ marginTop: 14 }}>
          <div className="cc-section-head" style={{ marginTop: 0 }}>
            <p className="cc-chart-title" style={{ flex: 1, marginBottom: 0 }}>
              Cuota por cuota
            </p>
            <button
              type="button" className="cc-btn cc-btn-outline cc-btn-sm"
              onClick={() => setVerTabla((v) => !v)}
            >
              <ChevronDown size={13} /> {verTabla ? 'Ocultar' : `Ver los ${withExtra.months} meses`}
            </button>
          </div>

          <p className="cc-page-sub">
            Abonar de más no baja la cuota: baja el saldo, así que el mes siguiente se va
            menos plata en intereses y más a capital. Por eso se acaba antes.
          </p>

          <div className="cc-commit-list">
            <div className="cc-plan-row cc-plan-head">
              <span>Mes</span>
              <span>Interés</span>
              <span>Capital</span>
              <span>Saldo</span>
            </div>
            {(verTabla ? withExtra.schedule : withExtra.schedule.slice(0, 3)).map((f) => (
              <div key={f.month} className="cc-plan-row">
                <span className="cc-plan-concept">
                  {monthLabel(addMonths(currentMonthKey(), f.month - 1))}
                </span>
                <span className="cc-mono" style={{ color: COLORS.expense }}>
                  {fmtCOP(f.interest)}
                </span>
                <span className="cc-mono" style={{ color: COLORS.income }}>
                  {fmtCOP(f.principal)}
                </span>
                <span className="cc-mono">{fmtCOP(f.closing)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
