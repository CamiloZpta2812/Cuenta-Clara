import { useState } from 'react';
import {
  CreditCard, TrendingDown, CalendarCheck, Flame, AlertTriangle, Sparkles, ChevronDown, Plus, Check, Pencil,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { addMonths, currentMonthKey, monthKeyFromDate, monthLabel } from '../lib/dates.js';
import { firstInstallmentMonth } from '../lib/month.js';
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
  const {
    debtOutlook, simulatePlan, debts, selectedDebtId, setSelectedDebtId,
    paymentInputs, setPaymentInputs, balanceInputs, setBalanceInputs, handleAddPayment,
    handleEditDebt,
  } = useFinance();
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

  const { debt, extra, hechas, minimumOnly, withExtra, monthsSaved, interestSaved } = debtOutlook;

  /*
   * Con más de una deuda hay que decir CUÁL se está mirando: el abono extra va
   * a una sola, y de eso depende cuánto te ahorras. Antes la pantalla mostraba
   * una sin avisar que había otras.
   */
  const saldoDe = (d) => (d.currentBalance != null
    ? Number(d.currentBalance)
    : Math.max(0, (Number(d.totalAmount) || 0)
      - (d.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0)));

  const varias = (debts || []).length > 1;
  const saldoTotal = (debts || []).reduce((s, d) => s + saldoDe(d), 0);
  const cuotaTotal = (debts || []).reduce((s, d) => s + (Number(d.fixedPayment) || 0), 0);
  /* La más cara es a la que conviene mandarle el extra: es la avalancha. */
  const masCara = [...(debts || [])]
    .sort((a, b) => (Number(b.interestRate) || 0) - (Number(a.interestRate) || 0))[0];
  const atacandoLaCara = !masCara || masCara.id === debt.id;

  /* Los cambios del simulador son sumas y restas sobre el plan, no valores nuevos. */
  const cambios = Object.fromEntries(
    Object.entries(ajustes)
      .map(([k, v]) => [k, parseFloat(v) || 0])
      .filter(([, v]) => v !== 0),
  );
  const sim = Object.keys(cambios).length > 0 ? simulatePlan(cambios) : null;

  /*
   * En qué mes cae la PRIMERA cuota que falta. Tres reglas, en orden:
   *
   *   1. Si ya registraste el abono de este mes, la cuenta empieza el
   *      siguiente. Si no, la tabla vuelve a cobrarte una cuota ya pagada.
   *
   *   2. Si el crédito se desembolsó este mes, la primera cuota es el mes
   *      entrante: nadie paga la cuota el mismo mes en que le prestaron.
   *
   *   3. Y nunca antes del mes actual, aunque el crédito sea viejo.
   */
  const mesActual = currentMonthKey();
  const ultimoAbono = (debt.payments || [])
    .map((p) => p.month || monthKeyFromDate(p.date))
    .sort()
    .pop();

  const candidatos = [mesActual];
  if (ultimoAbono) candidatos.push(addMonths(ultimoAbono, 1));
  /* La misma regla que usa el plan del mes, para que no puedan discrepar. */
  const primeraCuota = firstInstallmentMonth(debt);
  if (primeraCuota) candidatos.push(primeraCuota);
  const primerMes = candidatos.sort().pop();

  const yaPagoEsteMes = ultimoAbono === mesActual;
  const arrancaDespues = primerMes !== mesActual;

  /*
   * La tabla junta las dos mitades: las cuotas que ya pagaste, reconstruidas
   * desde el monto original, y la proyección de las que faltan. Antes era solo
   * la proyección, así que no se veía nada de lo hecho — la tabla se sentía una
   * simulación en vez de tu plan de pago.
   */
  const totalCuotas = hechas.length + withExtra.months;

  /* La última cuota va en el offset months - 1: la primera es el offset 0. */
  const fin = withExtra.feasible
    ? monthLabel(addMonths(primerMes, withExtra.months - 1))
    : null;

  const futuras = withExtra.schedule.map((f) => ({
    key: `f${f.month}`,
    etiqueta: monthLabel(addMonths(primerMes, f.month - 1)),
    interest: f.interest,
    principal: f.principal,
    closing: f.closing,
    paid: false,
  }));

  const pagadas = hechas.map((f) => ({
    key: `p${f.date}-${f.month}`,
    etiqueta: monthLabel(f.monthKey || monthKeyFromDate(f.date)),
    interest: f.interest,
    principal: f.principal,
    closing: f.closing,
    paid: true,
    anchored: f.anchored,
  }));

  /*
   * Plegada, la tabla muestra las últimas dos hechas y las tres que vienen: lo
   * que uno quiere ver de reojo es dónde va, no el año entero.
   */
  const filas = verTabla
    ? [...pagadas, ...futuras]
    : [...pagadas.slice(-2), ...futuras.slice(0, 3)];

  return (
    <>
      <div className="cc-section-head">
        <div>
          <div className="cc-page-title">Deuda</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>
            {debt.name} · {fmtCOP(debt.currentBalance)} al {debt.interestRate}% mensual ·
            cuota de {fmtCOP(debt.fixedPayment)}
            {/*
              * El día se muestra aunque falte, y por eso dice "sin día" en vez
              * de callarse: mientras estuvo vacío la cuota no salía en el
              * Calendario y no había nada en pantalla que lo delatara.
              */}
            {debt.dueDay ? ` · se cobra el ${debt.dueDay}` : ' · sin día de cobro'}
          </p>
        </div>
        <button
          type="button" className="cc-btn cc-btn-outline cc-btn-sm"
          onClick={() => handleEditDebt(debt)}
        >
          <Pencil size={13} /> Editar deuda
        </button>
      </div>

      {varias && (
        <>
          <div className="cc-stats-grid" style={{ marginBottom: 14 }}>
            <StatCard
              label={`Deuda total · ${debts.length} créditos`} value={fmtCOP(saldoTotal)}
              Icon={CreditCard} color={COLORS.debt} bg="var(--debt-soft)"
              sub={`${fmtCOP(cuotaTotal)} al mes en cuotas`}
            />
          </div>

          <div className="cc-filtros">
            <span className="cc-page-sub" style={{ marginBottom: 0 }}>Abonarle de más a:</span>
            <select
              className="cc-select cc-select-sm" value={selectedDebtId || ''}
              onChange={(e) => setSelectedDebtId(e.target.value || null)}
            >
              <option value="">La más cara ({masCara ? masCara.name : '—'})</option>
              {debts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.interestRate || 0}% · {fmtCOP(saldoDe(d))}
                </option>
              ))}
            </select>
          </div>

          {!atacandoLaCara && (
            <div className="cc-banner">
              <AlertTriangle size={15} />
              <span>
                Estás abonándole a <strong>{debt.name}</strong> ({debt.interestRate}% mensual),
                pero <strong>{masCara.name}</strong> cobra {masCara.interestRate}%. Mandarle el
                extra a la más cara te ahorra más intereses — aunque a veces conviene cerrar
                primero la pequeña por quitártela de encima.
              </span>
            </div>
          )}
        </>
      )}

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
              {varias && 'Solo esta deuda. '}
              Primera cuota en {monthLabel(primerMes)}, última en {fin}.
              Pagarías {fmtCOP(withExtra.totalInterest)} de intereses.
              {arrancaDespues && (yaPagoEsteMes
                ? ' La de este mes ya la registraste.'
                : ' Este mes no hay cuota: el crédito se desembolsó apenas.')}
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

      {/* --------------------------------------------------- registrar abono */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <p className="cc-chart-title">Registrar un pago</p>
        <p className="cc-page-sub">
          Anota la cuota y el abono extra juntos, como salieron de tu cuenta. El saldo
          baja solo y queda un movimiento enlazado, para poder deshacer los dos a la vez.
        </p>
        <div className="cc-form" style={{ marginTop: 4 }}>
          <div className="cc-field">
            <label>Cuánto pagaste</label>
            <input
              className="cc-input" type="number" min="0" step="any"
              placeholder={String(Math.round((Number(debt.fixedPayment) || 0) + extra))}
              value={paymentInputs[debt.id] || ''}
              onChange={(e) => setPaymentInputs((p) => ({ ...p, [debt.id]: e.target.value }))}
            />
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>
              Cuota de {fmtCOP(debt.fixedPayment)}
              {extra > 0 && ` + ${fmtCOP(extra)} de abono extra`}
            </span>
          </div>
          <div className="cc-field">
            <label>Saldo que quedó, según el banco (opcional)</label>
            <input
              className="cc-input" type="number" min="0" step="any" placeholder="Déjalo vacío si no lo tienes"
              value={balanceInputs[debt.id] || ''}
              onChange={(e) => setBalanceInputs((p) => ({ ...p, [debt.id]: e.target.value }))}
            />
            <span className="cc-stat-sub" style={{ fontSize: 11 }}>
              Si lo pones, manda ese: es la verdad, y sirve para cuadrar el modelo contra
              el extracto. Si lo dejas vacío, el saldo se calcula.
            </span>
          </div>
          <div className="cc-form-actions">
            <button
              type="button" className="cc-btn cc-btn-primary"
              onClick={() => handleAddPayment(debt.id)}
            >
              <Plus size={15} /> Registrar pago
            </button>
          </div>
        </div>
      </div>

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
            <p className="cc-chart-title" style={{ flex: 1, marginBottom: 0 }}>Tu plan de pago</p>
            <span className="cc-tag">
              {hechas.length} de {totalCuotas} {totalCuotas === 1 ? 'cuota' : 'cuotas'}
            </span>
            <button
              type="button" className="cc-btn cc-btn-outline cc-btn-sm"
              onClick={() => setVerTabla((v) => !v)}
            >
              <ChevronDown size={13} /> {verTabla ? 'Ocultar' : 'Ver todas'}
            </button>
          </div>

          {hechas.length > 0 && (
            <div className="cc-progress-track" style={{ marginBottom: 10 }}>
              <div
                className="cc-progress-fill"
                style={{ width: `${(hechas.length / totalCuotas) * 100}%`, background: COLORS.income }}
              />
            </div>
          )}

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

            {filas.map((f) => (
              <div
                key={f.key}
                className="cc-plan-row"
                style={f.paid ? { background: 'var(--income-soft)' } : undefined}
              >
                <span className="cc-plan-concept">
                  {f.paid && <Check size={13} color={COLORS.income} />}
                  {f.etiqueta}
                  {/* Marcamos de dónde salió el saldo: del banco o del modelo. */}
                  {f.anchored && <span className="cc-tag" style={{ marginLeft: 6 }}>del banco</span>}
                </span>
                <span className="cc-mono" style={{ color: COLORS.expense }}>{fmtCOP(f.interest)}</span>
                <span className="cc-mono" style={{ color: COLORS.income }}>{fmtCOP(f.principal)}</span>
                <span className="cc-mono">{fmtCOP(f.closing)}</span>
              </div>
            ))}
          </div>

          {!verTabla && filas.length < totalCuotas && (
            <p className="cc-page-sub" style={{ marginTop: 8 }}>
              Faltan {totalCuotas - filas.length} cuotas más.
            </p>
          )}
        </div>
      )}

    </>
  );
}
