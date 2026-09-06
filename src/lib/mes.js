/*
 * Motor del mes: plan contra realidad.
 *
 * La app vieja solo sumaba lo que ya había pasado. Este motor responde la
 * pregunta que de verdad importa cada mes: "¿voy bien o me desvié, y cuánto
 * me queda libre para abonarle a la deuda?".
 *
 * La cascada es:
 *
 *     Ingresos
 *   − Gastos fijos (solo TU parte, no lo que te devuelven)
 *   − Cuota mínima de deudas
 *   − Ahorro (metas)
 *   − Gasto variable
 *   = Excedente bruto
 *   − Colchones (margen sin asignar)
 *   = Disponible para abono extra
 *
 * Cada línea tiene su valor planeado y su valor real, para poder señalar dónde
 * exactamente se rompió el mes en vez de dar un solo número al final.
 *
 * Todo es puro: recibe el estado, devuelve números. Ver mes.test.js.
 */

import { monthKeyFromDate } from './dates.js';
import { simulate } from './amortizacion.js';

const num = (v) => Number(v) || 0;
const sum = (arr, f) => (arr || []).reduce((s, x) => s + num(f(x)), 0);

/*
 * Lo que TÚ pagas de un gasto fijo: el valor total menos lo que reparten otros.
 * Se calcula, no se guarda, para que nunca puedan descuadrar entre sí.
 */
export function miParte(gastoFijo) {
  return num(gastoFijo.valorTotal) - sum(gastoFijo.reparto, (r) => r.monto);
}

/* Lo que te deben en total por un gasto fijo compartido. */
export function parteExterna(gastoFijo) {
  return sum(gastoFijo.reparto, (r) => r.monto);
}

/*
 * Los cobros del mes, uno por persona por gasto compartido, con su estado.
 * `cobros` guarda solo los que ya se marcaron como cobrados: lo demás se
 * deduce, así no hay que generar filas por adelantado cada mes.
 */
export function cobrosDelMes(gastosFijos, cobros, mes) {
  const cobrados = new Set(
    (cobros || []).filter((c) => c.mes === mes).map((c) => `${c.gastoFijoId}:${c.personaId}`),
  );
  const filas = [];
  (gastosFijos || []).forEach((g) => {
    (g.reparto || []).forEach((r) => {
      if (num(r.monto) <= 0) return;
      filas.push({
        gastoFijoId: g.id,
        gastoNombre: g.nombre,
        personaId: r.personaId,
        monto: num(r.monto),
        cobrado: cobrados.has(`${g.id}:${r.personaId}`),
      });
    });
  });
  return filas;
}

/* ------------------------------------------------------------- planeado -- */

export function planDelMes(estado) {
  const fuentes = estado.fuentesIngreso || [];
  const fijos = estado.gastosFijos || [];
  const buckets = estado.buckets || [];
  const deudas = estado.deudas || [];
  const plan = estado.plan || {};

  const metas = buckets.filter((b) => b.tipo === 'meta');
  const colchones = buckets.filter((b) => b.tipo === 'colchon');

  const ingresos = sum(fuentes, (f) => f.montoEsperado);
  const gastosFijos = sum(fijos, miParte);
  const cuotaDeuda = sum(deudas, (d) => d.cuotaFija);
  const ahorro = sum(metas, (b) => b.aporteMensual);
  const variable = num(plan.variableEstimado);
  const colchon = sum(colchones, (b) => b.aporteMensual);

  const excedenteBruto = ingresos - gastosFijos - cuotaDeuda - ahorro - variable;

  return {
    ingresos,
    gastosFijos,
    cuotaDeuda,
    ahorro,
    variable,
    excedenteBruto,
    colchon,
    disponibleParaAbono: excedenteBruto - colchon,
    porCobrar: sum(fijos, parteExterna),
  };
}

/* ----------------------------------------------------------------- real -- */

/*
 * Clasifica los movimientos del mes en las mismas líneas del plan.
 *
 * Un movimiento cuenta en el mes de su FECHA DE GASTO (cuándo consumiste), no
 * en el de la salida de caja. Para efectivo y débito es lo mismo; para tarjeta
 * de crédito no, y ahí está la diferencia que la app vieja se saltaba: una
 * compra con tarjeta es gasto de septiembre aunque la plata salga en octubre.
 */
export function realDelMes(estado, mes) {
  const movimientos = (estado.movimientos || []).filter((t) => monthKeyFromDate(t.fecha) === mes);

  const ingresos = sum(movimientos.filter((t) => t.tipo === 'ingreso'), (t) => t.monto);
  const gastos = movimientos.filter((t) => t.tipo === 'gasto');

  const gastosFijos = sum(gastos.filter((t) => t.gastoFijoId), (t) => t.monto);
  const cuotaDeuda = sum((estado.pagosDeuda || []).filter((p) => monthKeyFromDate(p.fecha) === mes), (p) => p.monto);
  const ahorro = sum((estado.aportes || []).filter((a) => monthKeyFromDate(a.fecha) === mes), (a) => a.monto);

  // Variable es todo lo demás: ni fijo, ni abono a deuda, ni aporte a ahorro.
  const variable = sum(gastos.filter((t) => !t.gastoFijoId && !t.deudaId && !t.bucketId), (t) => t.monto);

  return {
    ingresos,
    gastosFijos,
    cuotaDeuda,
    ahorro,
    variable,
    excedenteBruto: ingresos - gastosFijos - cuotaDeuda - ahorro - variable,
    movimientos: movimientos.length,
  };
}

/* ---------------------------------------------------------- salidas caja -- */

/*
 * Lo que de verdad sale de la cuenta este mes, que no es lo mismo que lo que
 * gastaste: aquí sí manda la fecha de salida de caja, así que una compra con
 * tarjeta del mes pasado aparece ahora, y la de este mes aparecerá después.
 */
export function salidasDeCajaDelMes(estado, mes) {
  const porFecha = (t) => monthKeyFromDate(t.fechaSalidaCaja || t.fecha);
  const gastos = (estado.movimientos || []).filter((t) => t.tipo === 'gasto' && porFecha(t) === mes);
  return {
    total: sum(gastos, (t) => t.monto),
    conTarjeta: sum(gastos.filter((t) => t.medioPago === 'credito'), (t) => t.monto),
    sinTarjeta: sum(gastos.filter((t) => t.medioPago !== 'credito'), (t) => t.monto),
  };
}

/* -------------------------------------------------------------- alertas -- */

/*
 * Las reglas que el usuario quiere que la app le recuerde. Cada una dice qué
 * pasó y cuánto cuesta, con cifras, no con un regaño genérico.
 */
export function alertasDelMes(estado, mes, plan, real) {
  const alertas = [];

  const pendientes = cobrosDelMes(estado.gastosFijos, estado.cobros, mes).filter((c) => !c.cobrado);
  if (pendientes.length > 0) {
    const total = sum(pendientes, (c) => c.monto);
    alertas.push({
      tipo: 'cobro',
      severidad: 'aviso',
      titulo: `Te deben ${pendientes.length} cobro${pendientes.length === 1 ? '' : 's'} este mes`,
      monto: total,
      // Lo que pesa no es el mes, es el año: es plata tuya que se queda en la calle.
      detalle: `${formatoCorto(total)} este mes. Si se te pasa todos los meses son ${formatoCorto(total * 12)} al año.`,
    });
  }

  if (plan.variable > 0 && real.variable > plan.variable) {
    const exceso = real.variable - plan.variable;
    alertas.push({
      tipo: 'variable',
      severidad: exceso > plan.variable * 0.2 ? 'alerta' : 'aviso',
      titulo: 'Te pasaste del gasto variable estimado',
      monto: exceso,
      detalle: `Llevas ${formatoCorto(real.variable)} de ${formatoCorto(plan.variable)} estimados. Eso sale del abono a la deuda.`,
    });
  }

  if (real.ingresos > 0 && real.ingresos < plan.ingresos * 0.95) {
    alertas.push({
      tipo: 'ingreso',
      severidad: 'aviso',
      titulo: 'Entró menos de lo planeado',
      monto: plan.ingresos - real.ingresos,
      detalle: `Esperabas ${formatoCorto(plan.ingresos)} y llevas ${formatoCorto(real.ingresos)}.`,
    });
  }

  return alertas;
}

function formatoCorto(n) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(Math.round(n || 0));
}

/* ---------------------------------------------------------------- todo --- */

export function resumenDelMes(estado, mes) {
  const plan = planDelMes(estado);
  const real = realDelMes(estado, mes);
  const salidas = salidasDeCajaDelMes(estado, mes);

  const desvios = {};
  ['ingresos', 'gastosFijos', 'cuotaDeuda', 'ahorro', 'variable'].forEach((k) => {
    desvios[k] = real[k] - plan[k];
  });

  return {
    mes,
    plan,
    real,
    salidas,
    desvios,
    cobros: cobrosDelMes(estado.gastosFijos, estado.cobros, mes),
    alertas: alertasDelMes(estado, mes, plan, real),
  };
}


/* ------------------------------------------------------------ simulador -- */

/*
 * "¿Y si le bajo al colchón?" / "¿Y si me sube el arriendo?"
 *
 * Aplica cambios sobre el plan y devuelve qué pasa con la deuda. Es lo que se
 * muestra ANTES de confirmar un cambio, para que nadie mueva un número sin ver
 * lo que cuesta en meses.
 *
 * Los cambios son sumas o restas sobre las líneas del plan, no valores nuevos:
 * { colchon: -150000 } significa "bajo el colchón en 150.000".
 */
export function simularCambioDePlan(estado, cambios = {}) {
  const plan = planDelMes(estado);
  const deuda = (estado.deudas || [])[0];
  if (!deuda) return null;

  const delta = Object.values(cambios).reduce((s, v) => s - num(v), 0);
  const abonoAntes = plan.disponibleParaAbono;
  const abonoDespues = abonoAntes + delta;

  /*
   * Sin recortar en cero a propósito. Si el plan queda en déficit, no es que
   * "abones cero": es que no te alcanza ni para la cuota mínima, y eso tiene
   * que verse. Recortarlo mostraría un plan de pago que no existe.
   */
  const pago = (a) => num(deuda.cuotaFija) + a;
  const antes = simulate({
    principal: deuda.saldoActual, monthlyRate: deuda.tasaMensual, payment: pago(abonoAntes),
  });
  const despues = simulate({
    principal: deuda.saldoActual, monthlyRate: deuda.tasaMensual, payment: pago(abonoDespues),
  });

  return {
    abonoAntes,
    abonoDespues,
    antes,
    despues,
    // El plan no cierra: los gastos se comen hasta la cuota mínima.
    deficit: abonoDespues < 0,
    mesesDiferencia: antes.feasible && despues.feasible ? antes.months - despues.months : null,
    interesDiferencia: antes.feasible && despues.feasible
      ? antes.totalInterest - despues.totalInterest : null,
    dejaDeSerViable: antes.feasible && !despues.feasible,
  };
}
