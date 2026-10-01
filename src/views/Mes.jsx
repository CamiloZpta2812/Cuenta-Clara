import { Suspense, lazy } from 'react';
import {
  TrendingUp, TrendingDown, Landmark, PiggyBank, ShoppingBag, Shield, CreditCard,
  HandCoins, Check, Wallet, ArrowRight, Briefcase, Gauge,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthLabel } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import { getCategory } from '../lib/categories.js';
import { useFinance } from '../state/financeStore';

/*
 * El mes: el análisis, no la deuda.
 *
 * Giraba alrededor de un número —cuánto puedes abonarle de más al crédito— y
 * eso responde una pregunta que uno se hace una vez al mes. Era de las
 * pantallas que menos se abrían. La pregunta de todos los días es otra:
 * "¿voy bien, o voy gastando de más?", y se contesta con tres cosas:
 *
 *   El ritmo      lo que llevas de variable contra lo que deberías llevar.
 *                 Ir por encima de la recta el día 10 es llegar al 30 sin
 *                 plata para comer, y eso no se ve en un total.
 *
 *   Línea a línea cada parte del plan como una barra, con una marca donde
 *                 está lo planeado. Se lee de un vistazo qué va al día.
 *
 *   El variable   en qué se fue, comparado con el mes pasado. "180.000 en
 *                 comida" no dice nada hasta que sabes cuánto fue antes.
 *
 * La deuda queda al final, en una línea. Sigue importando, pero no es lo que
 * se viene a mirar.
 */

const Ritmo = lazy(() => import('../components/Graficas').then((m) => ({ default: m.Ritmo })));

/* Las líneas del plan que se pintan como barra. El ingreso va aparte, arriba. */
const LINEAS = [
  { key: 'fixedExpenses', label: 'Gastos fijos', Icon: Landmark, color: '#6B5199', compromiso: true },
  { key: 'savings', label: 'Ahorro', Icon: PiggyBank, color: '#3E7FB0', compromiso: true },
  { key: 'cushion', label: 'Colchones', Icon: Shield, color: '#2F8F8F', compromiso: true },
  { key: 'variable', label: 'Gasto variable', Icon: ShoppingBag, color: '#BB4B34', compromiso: false },
];

/*
 * Una barra con su marca de plan. En un compromiso —fijos, ahorro, colchones—
 * quedarse corto no es un logro, es que todavía no ha salido: se pinta neutro.
 * Solo el variable se pinta como algo que te fue bien o mal.
 */
function BarraPlan({ linea, real, plan }) {
  const tope = Math.max(real, plan, 1);
  const anchoReal = Math.min(100, (real / tope) * 100);
  const marca = (plan / tope) * 100;
  const pasado = !linea.compromiso && real > plan && plan > 0;
  let estado;
  if (plan <= 0 && real <= 0) estado = 'Sin plan';
  else if (linea.compromiso) {
    estado = real >= plan - 1 ? 'Al día' : `Faltan ${fmtCOP(plan - real)}`;
  } else {
    estado = pasado ? `${fmtCOP(real - plan)} de más` : `Quedan ${fmtCOP(plan - real)}`;
  }
  return (
    <div className="cc-barra-plan">
      <div className="cc-barra-cab">
        <span><linea.Icon size={14} color={linea.color} /> {linea.label}</span>
        <span className={pasado ? 'cc-barra-mal' : 'cc-barra-estado'}>{estado}</span>
      </div>
      <div className="cc-barra-pista" title={`${fmtCOP(real)} de ${fmtCOP(plan)}`}>
        <div className="cc-barra-relleno" style={{ width: `${anchoReal}%`, background: pasado ? COLORS.expense : linea.color }} />
        {plan > 0 && <div className="cc-barra-marca" style={{ left: `${marca}%` }} />}
      </div>
      <div className="cc-barra-cifras">
        <strong className="cc-mono">{fmtCOP(real)}</strong>
        <span className="cc-mono">de {fmtCOP(plan)}</span>
      </div>
    </div>
  );
}

function Aviso({ Icon, tono, titulo, detalle, accion, onAccion }) {
  const color = { bien: COLORS.income, ojo: COLORS.savings, mal: COLORS.expense }[tono];
  return (
    <div className="cc-aviso" style={{ borderLeftColor: color }}>
      <Icon size={17} color={color} style={{ flexShrink: 0, marginTop: 2 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{titulo}</div>
        {detalle && <div className="cc-aviso-sub">{detalle}</div>}
      </div>
      {accion && (
        <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={onAccion}>
          {accion} <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}

/* El veredicto en una frase, que es lo primero que se quiere leer. */
function veredicto(r) {
  if (r.hoyDia === 0) return { tono: 'neutro', texto: 'Este mes todavía no empieza.' };
  if (r.planMes <= 0) return { tono: 'neutro', texto: 'No hay estimado de gasto variable para este mes.' };
  const pctMes = Math.round((r.hoyDia / r.totalDias) * 100);
  const pctGasto = Math.round((r.gastado / r.planMes) * 100);
  if (r.cerrado) {
    return r.gastado <= r.planMes
      ? { tono: 'bien', texto: `Cerraste el mes ${fmtCOP(r.planMes - r.gastado)} por debajo de lo estimado.` }
      : { tono: 'mal', texto: `Cerraste el mes ${fmtCOP(r.gastado - r.planMes)} por encima de lo estimado.` };
  }
  if (r.adelanto > r.planMes * 0.1) {
    return { tono: 'mal', texto: `Va el ${pctMes}% del mes y ya gastaste el ${pctGasto}% del variable.` };
  }
  if (r.adelanto > 0) {
    return { tono: 'ojo', texto: `Va el ${pctMes}% del mes y llevas el ${pctGasto}% del variable: un poco adelantado.` };
  }
  return { tono: 'bien', texto: `Va el ${pctMes}% del mes y llevas el ${pctGasto}% del variable. Vas bien.` };
}

export default function Mes() {
  const {
    availableMonths, selectedMonth, setSelectedMonth, monthReport,
    ritmoDelMes: r, variablePorCategoria, setActiveTab,
  } = useFinance();

  const { plan, real, collections } = monthReport;
  const pendientes = collections.filter((c) => !c.collected);
  const porCobrar = pendientes.reduce((s, c) => s + c.amount, 0);
  const meses = availableMonths.includes(selectedMonth)
    ? availableMonths
    : [selectedMonth, ...availableMonths];

  const v = veredicto(r);
  const diaRestantes = r.totalDias - r.hoyDia;
  const quedaVariable = r.planMes - r.gastado;
  const porDiaQueda = diaRestantes > 0 ? quedaVariable / diaRestantes : 0;
  const maxCat = Math.max(1, ...variablePorCategoria.map((c) => Math.max(c.amount, c.previous)));

  return (
    <>
      <div className="cc-section-head" style={{ marginTop: 0 }}>
        <div style={{ flex: 1 }}>
          <div className="cc-page-title">El mes</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>Cómo va, contra lo que planeaste.</p>
        </div>
        <select
          className="cc-select" style={{ maxWidth: 150 }}
          value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* ---------------------------------------------------------- el ritmo */}
      <div className="cc-card cc-mes-ritmo">
        <div className={`cc-veredicto ${v.tono}`}>
          <Gauge size={18} /> {v.texto}
        </div>

        <div className="cc-mes-cifras">
          <div>
            <span>Llevas</span>
            <strong className="cc-mono">{fmtCOP(r.gastado)}</strong>
          </div>
          <div>
            <span>Deberías llevar</span>
            <strong className="cc-mono">{fmtCOP(r.deberias)}</strong>
          </div>
          {!r.cerrado && r.hoyDia > 0 && (
            <div>
              <span>Si sigues así, terminas en</span>
              <strong className="cc-mono" style={{ color: r.proyeccion > r.planMes ? COLORS.expense : COLORS.ink }}>
                {fmtCOP(r.proyeccion)}
              </strong>
            </div>
          )}
          {!r.cerrado && r.hoyDia > 0 && (
            <div>
              <span>Te quedan por día</span>
              <strong className="cc-mono" style={{ color: porDiaQueda < 0 ? COLORS.expense : COLORS.ink }}>
                {fmtCOP(porDiaQueda)}
              </strong>
            </div>
          )}
        </div>

        <Suspense fallback={<div style={{ height: 220 }} />}>
          <Ritmo data={r.dias} pasado={r.adelanto > 0} hoyDia={r.hoyDia} />
        </Suspense>

        <div className="cc-leyenda-ritmo">
          <span><i className="solida" style={{ background: r.adelanto > 0 ? COLORS.expense : COLORS.income }} /> Lo que llevas de gasto variable</span>
          <span><i className="punteada" /> Si gastaras parejo hasta {fmtCOP(r.planMes)}</span>
        </div>
      </div>

      {/* --------------------------------------------------- lo que pide atención */}
      {(porCobrar > 0 || plan.projectIncome > 0) && (
        <div style={{ marginTop: 14 }}>
          {porCobrar > 0 && (
            <Aviso
              Icon={HandCoins} tono="ojo"
              titulo={`Te deben ${fmtCOP(porCobrar)} de gastos compartidos`}
              detalle={`${pendientes.length} cobro${pendientes.length === 1 ? '' : 's'} sin marcar.`}
              accion="Cobrar" onAccion={() => setActiveTab('cobros')}
            />
          )}
          {plan.projectIncome > 0 && (
            <Aviso
              Icon={Briefcase} tono="ojo"
              titulo={`${fmtCOP(plan.projectIncome)} del plan son pagos de proyecto`}
              detalle="Es plata prometida, no segura. Si el cliente se atrasa, el mes se queda corto en esa cifra: no la gastes antes de que llegue."
            />
          )}
        </div>
      )}

      <div className="cc-mes-fila">
        {/* --------------------------------------------------- línea a línea */}
        <div className="cc-card">
          <p className="cc-chart-title">El plan, línea a línea</p>
          <p className="cc-chart-sub">La barra es lo que va; la raya, lo planeado.</p>

          <div className="cc-ingreso-mes">
            <span><TrendingUp size={14} color={COLORS.income} /> Entró</span>
            <strong className="cc-mono">{fmtCOP(real.income)}</strong>
            <span className="cc-stat-sub">
              de {fmtCOP(plan.income)}
              {plan.projectIncome > 0 && ` (${fmtCOP(plan.projectIncome)} de proyecto)`}
            </span>
          </div>

          {LINEAS.map((l) => (
            <BarraPlan key={l.key} linea={l} real={real[l.key] || 0} plan={plan[l.key] || 0} />
          ))}
        </div>

        {/* ------------------------------------------------------ el variable */}
        <div className="cc-card">
          <p className="cc-chart-title">En qué se fue el variable</p>
          <p className="cc-chart-sub">Contra el mes pasado, en gris.</p>
          {variablePorCategoria.length === 0 ? (
            <p className="cc-stat-sub">Todavía no hay gastos variables este mes.</p>
          ) : (
            <div className="cc-cats">
              {variablePorCategoria.slice(0, 7).map((c) => {
                const cat = getCategory(c.category);
                const cambio = c.previous > 0 ? (c.amount - c.previous) / c.previous : null;
                return (
                  <div key={c.category} className="cc-cat">
                    <div className="cc-cat-cab">
                      <span><cat.icon size={13} color={cat.color} /> {cat.label}</span>
                      <span className="cc-mono">{fmtCOP(c.amount)}</span>
                    </div>
                    <div className="cc-cat-pistas">
                      <div className="cc-cat-ahora" style={{ width: `${(c.amount / maxCat) * 100}%`, background: cat.color }} />
                      <div className="cc-cat-antes" style={{ width: `${(c.previous / maxCat) * 100}%` }} />
                    </div>
                    {cambio !== null && Math.abs(cambio) >= 0.05 && (
                      <span className={`cc-cat-cambio ${cambio > 0 ? 'sube' : 'baja'}`}>
                        {cambio > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {Math.abs(Math.round(cambio * 100))}% {cambio > 0 ? 'más' : 'menos'} que el mes pasado
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------------- la deuda, en una línea */}
      <button type="button" className="cc-mes-deuda" onClick={() => setActiveTab('deuda')}>
        <CreditCard size={15} />
        {plan.availableForExtra >= 0 ? (
          <span>
            Si el mes cierra como está planeado, te quedan
            <strong className="cc-mono"> {fmtCOP(plan.availableForExtra)} </strong>
            para abonarle de más a la deuda.
          </span>
        ) : (
          <span>
            El plan no cierra: faltan <strong className="cc-mono">{fmtCOP(-plan.availableForExtra)}</strong> para
            cubrir lo comprometido.
          </span>
        )}
        <ArrowRight size={14} />
      </button>

      {plan.locked && (
        <p className="cc-page-sub" style={{ marginTop: 8 }}>
          <Check size={13} /> Mes cerrado: se juzga contra el plan que tenía entonces.
        </p>
      )}
      {r.cerrado || r.hoyDia === 0 ? null : (
        <p className="cc-stat-sub" style={{ marginTop: 8 }}>
          <Wallet size={12} style={{ verticalAlign: '-1px' }} /> "Te quedan por día" es lo que te queda del
          variable estimado, repartido entre los {diaRestantes} días que faltan.
        </p>
      )}
    </>
  );
}
