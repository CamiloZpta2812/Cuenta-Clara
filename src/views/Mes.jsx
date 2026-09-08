import { useState } from 'react';
import {
  TrendingUp, Landmark, PiggyBank, ShoppingBag, Shield, CreditCard,
  HandCoins, Check, ChevronDown, Wallet, ArrowRight,
} from 'lucide-react';
import { COLORS } from '../lib/constants.js';
import { monthLabel } from '../lib/dates.js';
import { fmtCOP } from '../lib/money.js';
import { useFinance } from '../state/financeStore';

/*
 * El mes: plan contra realidad.
 *
 * La primera versión ponía cinco bloques del mismo tamaño —número, alertas,
 * cascada, salida de caja, cobros— y la cascada era una tabla de cuatro
 * columnas. Todo gritaba al mismo volumen y no había dónde mirar primero. Da
 * pereza abrir una pantalla así, y una app de finanzas que da pereza no se usa.
 *
 * Ahora hay tres niveles:
 *
 *   1. Un número, el que importa.
 *   2. Solo lo que necesita tu atención. Si no hay nada, lo dice y ya.
 *   3. El detalle completo, plegado hasta que lo pidas.
 *
 * Todo el cálculo viene de lib/month.js. Aquí no se hace ni una resta.
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
 * Cómo se lee un desvío. Los compromisos —fijos, cuota, ahorro, colchones— son
 * plata que ya prometiste: quedarte corto ahí no es un logro, es que todavía no
 * ha salido. Solo ingresos y gasto variable se pintan como algo que te fue bien
 * o mal.
 */
function leerDesvio(linea, desvio) {
  if (Math.abs(desvio) < 1) return { texto: 'Al día', color: COLORS.inkSoft };
  if (linea.clase === 'compromiso') {
    return desvio < 0
      ? { texto: `Faltan ${fmtCOP(-desvio)}`, color: COLORS.inkSoft }
      : { texto: `${fmtCOP(desvio)} de más`, color: COLORS.expense };
  }
  const bueno = linea.masEsMejor ? desvio > 0 : desvio < 0;
  return {
    texto: `${desvio > 0 ? '+' : ''}${fmtCOP(desvio)}`,
    color: bueno ? COLORS.income : COLORS.expense,
  };
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

export default function Mes() {
  const {
    availableMonths, selectedMonth, setSelectedMonth, monthReport, cardOutlook,
    setActiveTab,
  } = useFinance();
  const [verDetalle, setVerDetalle] = useState(false);

  const { plan, real, deviations, salidas, collections, alerts } = monthReport;
  const pendientes = collections.filter((c) => !c.collected);
  const porCobrar = pendientes.reduce((s, c) => s + c.amount, 0);

  const meses = availableMonths.includes(selectedMonth)
    ? availableMonths
    : [selectedMonth, ...availableMonths];

  const enRojo = plan.availableForExtra < 0;

  /*
   * Lo que falta por salir de todo lo comprometido, en una sola cifra. Seis
   * líneas diciendo "faltan tantos" cada una no es información: es ruido con
   * el que hay que hacer la suma uno mismo.
   */
  const porSalir = LINEAS
    .filter((l) => l.clase === 'compromiso')
    .reduce((s, l) => s + Math.max(0, -(deviations[l.key] || 0)), 0);

  const alertaVariable = alerts.find((a) => a.type === 'variable');
  const alertaIngreso = alerts.find((a) => a.type === 'ingreso');
  const todoEnOrden = !alertaVariable && !alertaIngreso && porCobrar === 0 && !enRojo && porSalir === 0;

  return (
    <>
      <div className="cc-section-head" style={{ marginTop: 0 }}>
        <div style={{ flex: 1 }}>
          <div className="cc-page-title">El mes</div>
          <p className="cc-page-sub" style={{ marginBottom: 0 }}>
            Cómo vas contra lo que planeaste.
          </p>
        </div>
        <select
          className="cc-select" style={{ maxWidth: 150 }}
          value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
        >
          {meses.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* ------------------------------------------------------- 1. el número */}
      <div className={`cc-hero ${enRojo ? 'cc-hero-alerta' : ''}`}>
        <p className="cc-hero-label">
          {enRojo ? 'Este mes el plan no cierra' : 'Puedes abonarle de más a la deuda'}
        </p>
        <div className="cc-hero-num">{fmtCOP(plan.availableForExtra)}</div>
        <p className="cc-hero-sub">
          {enRojo
            ? 'No alcanza ni para la cuota mínima. No es que no abones extra: falta plata para lo que ya está comprometido.'
            : `Encima de la cuota de ${fmtCOP(plan.debtPayment)}, sin tocar nada de lo demás.`}
          {plan.locked && ' Mes cerrado: se juzga contra el plan que tenía entonces.'}
        </p>
      </div>

      {/* --------------------------------------------------- 2. tu atención */}
      <div style={{ marginTop: 16 }}>
        {todoEnOrden ? (
          <Aviso
            Icon={Check} tono="bien"
            titulo="Vas al día"
            detalle="Nada pendiente por cobrar y ninguna línea desviada."
          />
        ) : (
          <>
            {porCobrar > 0 && (
              <Aviso
                Icon={HandCoins} tono="ojo"
                titulo={`Te deben ${fmtCOP(porCobrar)}`}
                detalle={`${pendientes.length} cobro${pendientes.length === 1 ? '' : 's'} sin marcar. Si se te pasa todos los meses son ${fmtCOP(porCobrar * 12)} al año.`}
                accion="Cobrar" onAccion={() => setActiveTab('cobros')}
              />
            )}
            {alertaVariable && (
              <Aviso
                Icon={ShoppingBag} tono={alertaVariable.severity === 'alerta' ? 'mal' : 'ojo'}
                titulo={alertaVariable.title} detalle={alertaVariable.detail}
              />
            )}
            {alertaIngreso && (
              <Aviso
                Icon={TrendingUp} tono="ojo"
                titulo={alertaIngreso.title} detalle={alertaIngreso.detail}
              />
            )}
            {porSalir > 0 && (
              <Aviso
                Icon={Wallet} tono="ojo"
                titulo={`Faltan ${fmtCOP(porSalir)} por salir`}
                detalle="Gastos fijos, cuota, ahorro y colchones que este mes todavía no has registrado."
              />
            )}
          </>
        )}
      </div>

      {/* ---------------------------------------------------- 3. el detalle */}
      <div className="cc-card" style={{ marginTop: 14 }}>
        <button
          type="button" className="cc-disclosure"
          onClick={() => setVerDetalle((v) => !v)}
          aria-expanded={verDetalle}
        >
          <span className="cc-chart-title" style={{ marginBottom: 0 }}>Línea por línea</span>
          <ChevronDown
            size={16}
            style={{ transform: verDetalle ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
          />
        </button>

        {verDetalle && (
          <div style={{ marginTop: 12 }}>
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

            <p className="cc-chart-title" style={{ marginTop: 18 }}>Lo que sale de tu cuenta</p>
            <div className="cc-commit-list">
              <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
                <span className="cc-plan-concept"><ShoppingBag size={14} /> Gastaste este mes</span>
                <span className="cc-mono">{fmtCOP(real.fixedExpenses + real.variable)}</span>
              </div>
              <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
                <span className="cc-plan-concept"><Wallet size={14} /> Salió de la cuenta</span>
                <span className="cc-mono">{fmtCOP(salidas.total)}</span>
              </div>
              {salidas.conTarjeta > 0 && (
                <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
                  <span className="cc-plan-concept"><CreditCard size={14} /> De eso, factura de tarjeta</span>
                  <span className="cc-mono">{fmtCOP(salidas.conTarjeta)}</span>
                </div>
              )}
              {cardOutlook.committed > 0 && (
                <div className="cc-plan-row" style={{ gridTemplateColumns: '1fr 132px' }}>
                  <span className="cc-plan-concept"><CreditCard size={14} /> Comprometido en cuotas</span>
                  <span className="cc-mono" style={{ color: COLORS.debt }}>{fmtCOP(cardOutlook.committed)}</span>
                </div>
              )}
            </div>
            <p className="cc-page-sub" style={{ marginTop: 10 }}>
              Gastar y que salga la plata no son lo mismo: una compra con tarjeta es gasto
              del mes en que la hiciste, pero sale cuando llega la factura.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
