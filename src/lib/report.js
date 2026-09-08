import { getCategory, getPaymentMethod } from './categories.js';
import { monthKeyFromDate, monthLabel, addMonths, currentMonthKey, todayStr } from './dates.js';
import { buildCardStatements, activeInstallmentGroups, buildCommitments } from './projections.js';

/*
 * Arma el contenido del reporte de Excel: una lista de hojas, cada una con sus
 * columnas y sus filas ya calculadas.
 *
 * Es una función pura y sin dependencias de Excel a propósito: así se puede
 * probar que no se queda ningún dato por fuera sin generar un archivo. La
 * escritura del .xlsx vive aparte, en exportExcel.js.
 *
 * Los montos van como números (no como texto con "$") para que en Excel se
 * puedan sumar, filtrar y meter en una tabla dinámica. Las fechas van como
 * fechas reales, construidas con componentes locales para que no se corran un
 * día por zona horaria.
 */

const COP = '#,##0';
const USD = '#,##0.00';

function toDate(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);

function debtPaid(d) {
  return sum(d.payments || [], (p) => p.amount);
}
function debtRemaining(d) {
  return Math.max(0, (Number(d.totalAmount) || 0) - debtPaid(d));
}
function debtRemainingCOP(d) {
  const r = debtRemaining(d);
  return d.currency === 'USD' ? r * (Number(d.exchangeRate) || 0) : r;
}

export function buildReportSheets(data) {
  const transactions = data.transactions || [];
  const debts = data.debts || [];
  const buckets = data.buckets || [];
  const creditCards = data.creditCards || [];
  const fixedExpenses = data.fixedExpenses || [];

  const cardName = (id) => {
    const c = creditCards.find((x) => x.id === id);
    return c ? `${c.name} *${c.lastFour || ''}`.trim() : (id ? 'tarjeta eliminada' : '');
  };

  const ingresos = transactions.filter((t) => t.type === 'ingreso');
  const gastos = transactions.filter((t) => t.type === 'gasto');
  const totalIngresos = sum(ingresos, (t) => t.amount);
  const totalGastos = sum(gastos, (t) => t.amount);
  /* Solo lo que de verdad se apartó: en una reserva la plata nunca se movió. */
  const totalAhorro = sum(
    buckets.filter((b) => b.movesCash !== false),
    (b) => sum(b.contributions || [], (c) => c.amount),
  );
  const totalDeuda = sum(debts, debtRemainingCOP);

  const meses = [...new Set(transactions.map((t) => monthKeyFromDate(t.date)))].sort();
  const fechas = transactions.map((t) => t.date).filter(Boolean).sort();

  const hojas = [];

  /* ------------------------------------------------------------- Resumen -- */
  hojas.push({
    name: 'Resumen',
    columns: [
      { header: 'Concepto', key: 'concepto', width: 34 },
      { header: 'Valor', key: 'valor', width: 18, numFmt: COP },
    ],
    rows: [
      { concepto: 'Reporte generado el', valor: todayStr() },
      { concepto: 'Movimientos desde', valor: fechas[0] || '—' },
      { concepto: 'Movimientos hasta', valor: fechas[fechas.length - 1] || '—' },
      { concepto: '' },
      { concepto: 'Ingresos totales', valor: totalIngresos },
      { concepto: 'Gastos totales', valor: totalGastos },
      { concepto: 'Saldo en caja (ingresos - gastos)', valor: totalIngresos - totalGastos },
      { concepto: 'Ahorro total', valor: totalAhorro },
      { concepto: 'Deuda pendiente (en COP)', valor: totalDeuda },
      { concepto: 'Patrimonio neto', valor: (totalIngresos - totalGastos) + totalAhorro - totalDeuda },
      { concepto: '' },
      { concepto: 'Número de movimientos', valor: transactions.length },
      { concepto: '  de los cuales son gastos', valor: gastos.length },
      { concepto: '  de los cuales son ingresos', valor: ingresos.length },
      { concepto: 'Tarjetas registradas', valor: creditCards.length },
      { concepto: 'Gastos fijos registrados', valor: fixedExpenses.length },
      { concepto: 'Deudas registradas', valor: debts.length },
      { concepto: 'Metas y colchones', valor: buckets.length },
    ],
  });

  /* ------------------------------------------------------------- Por mes -- */
  hojas.push({
    name: 'Por mes',
    columns: [
      { header: 'Mes', key: 'mes', width: 12 },
      { header: 'Ingresos', key: 'ingresos', width: 15, numFmt: COP },
      { header: 'Gastos', key: 'gastos', width: 15, numFmt: COP },
      { header: 'Gastos fijos', key: 'fijos', width: 15, numFmt: COP },
      { header: 'Gastos variables', key: 'variables', width: 16, numFmt: COP },
      { header: 'Balance', key: 'balance', width: 15, numFmt: COP },
    ],
    rows: meses.map((m) => {
      const delMes = transactions.filter((t) => monthKeyFromDate(t.date) === m);
      const i = sum(delMes.filter((t) => t.type === 'ingreso'), (t) => t.amount);
      const g = sum(delMes.filter((t) => t.type === 'gasto'), (t) => t.amount);
      const f = sum(delMes.filter((t) => t.type === 'gasto' && t.isFixed), (t) => t.amount);
      return { mes: monthLabel(m), ingresos: i, gastos: g, fijos: f, variables: g - f, balance: i - g };
    }),
  });

  /* -------------------------------------------------------- Movimientos --- */
  hojas.push({
    name: 'Movimientos',
    columns: [
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Mes', key: 'mes', width: 10 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Nota', key: 'nota', width: 30 },
      { header: 'Monto (COP)', key: 'monto', width: 15, numFmt: COP },
      { header: 'Medio de pago', key: 'medio', width: 15 },
      { header: 'Tarjeta', key: 'tarjeta', width: 20 },
      { header: 'Gasto fijo', key: 'fijo', width: 11 },
      { header: 'Cuota', key: 'cuota', width: 9 },
      { header: 'De cuántas', key: 'deCuantas', width: 11 },
      { header: 'Interés mensual %', key: 'interes', width: 16 },
      { header: 'Moneda original', key: 'moneda', width: 15 },
      { header: 'Monto original', key: 'montoOriginal', width: 15, numFmt: USD },
      { header: 'Tasa usada', key: 'tasa', width: 12, numFmt: COP },
      { header: 'ID', key: 'id', width: 16 },
    ],
    rows: [...transactions]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .map((t) => ({
        fecha: toDate(t.date),
        mes: monthLabel(monthKeyFromDate(t.date)),
        tipo: t.type === 'ingreso' ? 'Ingreso' : 'Gasto',
        categoria: getCategory(t.category).label,
        nota: t.note || '',
        monto: t.type === 'ingreso' ? t.amount : -t.amount,
        medio: t.paymentMethod ? getPaymentMethod(t.paymentMethod).label : '',
        tarjeta: cardName(t.cardId),
        fijo: t.isFixed ? 'Sí' : '',
        cuota: t.isInstallment ? t.currentInstallment : '',
        deCuantas: t.isInstallment ? t.totalInstallments : '',
        interes: t.interestRate != null ? t.interestRate : '',
        moneda: t.currency === 'USD' ? 'USD' : '',
        montoOriginal: t.currency === 'USD' ? t.originalAmount : '',
        tasa: t.currency === 'USD' ? t.exchangeRateUsed : '',
        id: t.id,
      })),
  });

  /* --------------------------------------------- Gastos por categoría ----- */
  const categorias = [...new Set(gastos.map((t) => t.category))]
    .map((id) => ({ id, label: getCategory(id).label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));

  hojas.push({
    name: 'Gastos por categoría',
    columns: [
      { header: 'Categoría', key: 'categoria', width: 22 },
      ...meses.map((m) => ({ header: monthLabel(m), key: m, width: 13, numFmt: COP })),
      { header: 'Total', key: 'total', width: 15, numFmt: COP },
    ],
    rows: [
      ...categorias.map((c) => {
        const fila = { categoria: c.label };
        let total = 0;
        meses.forEach((m) => {
          const v = sum(gastos.filter((t) => t.category === c.id && monthKeyFromDate(t.date) === m), (t) => t.amount);
          fila[m] = v;
          total += v;
        });
        return { ...fila, total };
      }),
      (() => {
        const fila = { categoria: 'TOTAL' };
        meses.forEach((m) => {
          fila[m] = sum(gastos.filter((t) => monthKeyFromDate(t.date) === m), (t) => t.amount);
        });
        return { ...fila, total: totalGastos };
      })(),
    ],
  });

  /* -------------------------------------------------------- Ingresos ------ */
  hojas.push({
    name: 'Ingresos',
    columns: [
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Mes', key: 'mes', width: 10 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Nota', key: 'nota', width: 34 },
      { header: 'Monto', key: 'monto', width: 15, numFmt: COP },
    ],
    rows: [...ingresos]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((t) => ({
        fecha: toDate(t.date),
        mes: monthLabel(monthKeyFromDate(t.date)),
        categoria: getCategory(t.category).label,
        nota: t.note || '',
        monto: t.amount,
      })),
  });

  /* -------------------------------------------------------- Tarjetas ------ */
  const facturasPorTarjeta = {};
  creditCards.forEach((c) => { facturasPorTarjeta[c.id] = buildCardStatements(transactions, c); });

  hojas.push({
    name: 'Tarjetas',
    columns: [
      { header: 'Tarjeta', key: 'nombre', width: 22 },
      { header: 'Últimos 4', key: 'ultimos', width: 11 },
      { header: 'Moneda', key: 'moneda', width: 10 },
      { header: 'Día de corte', key: 'corte', width: 13 },
      { header: 'Día de pago', key: 'pago', width: 13 },
      { header: 'Movimientos', key: 'movs', width: 13 },
      { header: 'Gastado histórico (COP)', key: 'historico', width: 22, numFmt: COP },
    ],
    rows: creditCards.map((c) => {
      const suyos = transactions.filter((t) => t.cardId === c.id && t.type === 'gasto');
      return {
        nombre: c.name,
        ultimos: c.lastFour || '',
        moneda: c.currency || 'COP',
        corte: c.cutDay || '',
        pago: c.paymentDay || '',
        movs: suyos.length,
        historico: sum(suyos, (t) => t.amount),
      };
    }),
  });

  hojas.push({
    name: 'Facturas de tarjeta',
    columns: [
      { header: 'Tarjeta', key: 'tarjeta', width: 22 },
      { header: 'Se paga el', key: 'fecha', width: 13 },
      { header: 'Compras', key: 'compras', width: 10 },
      { header: 'Total (COP)', key: 'total', width: 16, numFmt: COP },
    ],
    rows: creditCards.flatMap((c) => (facturasPorTarjeta[c.id] || []).map((f) => ({
      tarjeta: `${c.name} *${c.lastFour || ''}`.trim(),
      fecha: toDate(f.paymentDate),
      compras: f.items.length,
      total: f.total,
    }))),
  });

  hojas.push({
    name: 'Movimientos de tarjeta',
    columns: [
      { header: 'Tarjeta', key: 'tarjeta', width: 22 },
      { header: 'Fecha de compra', key: 'fecha', width: 15 },
      { header: 'Se cobra el', key: 'cobro', width: 13 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Nota', key: 'nota', width: 28 },
      { header: 'Monto (COP)', key: 'monto', width: 15, numFmt: COP },
      { header: 'Cuota', key: 'cuota', width: 9 },
      { header: 'De cuántas', key: 'deCuantas', width: 11 },
    ],
    rows: creditCards.flatMap((c) => {
      const facturas = facturasPorTarjeta[c.id] || [];
      const cobroDe = {};
      facturas.forEach((f) => f.items.forEach((t) => { cobroDe[t.id] = f.paymentDate; }));
      return transactions
        .filter((t) => t.cardId === c.id && t.type === 'gasto')
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((t) => ({
          tarjeta: `${c.name} *${c.lastFour || ''}`.trim(),
          fecha: toDate(t.date),
          cobro: cobroDe[t.id] ? toDate(cobroDe[t.id]) : '',
          categoria: getCategory(t.category).label,
          nota: t.note || '',
          monto: t.amount,
          cuota: t.isInstallment ? t.currentInstallment : '',
          deCuantas: t.isInstallment ? t.totalInstallments : '',
        }));
    }),
  });

  hojas.push({
    name: 'Cuotas activas',
    columns: [
      { header: 'Descripción', key: 'nota', width: 28 },
      { header: 'Tarjeta', key: 'tarjeta', width: 22 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Va en la cuota', key: 'va', width: 14 },
      { header: 'De cuántas', key: 'de', width: 11 },
      { header: 'Valor de la cuota', key: 'valor', width: 18, numFmt: COP },
      { header: 'Cuotas que faltan', key: 'faltan', width: 17 },
      { header: 'Falta por pagar', key: 'pendiente', width: 17, numFmt: COP },
      { header: 'Interés mensual %', key: 'interes', width: 16 },
    ],
    rows: activeInstallmentGroups(transactions).map((g) => ({
      nota: g.last.note || getCategory(g.last.category).label,
      tarjeta: cardName(g.last.cardId),
      categoria: getCategory(g.last.category).label,
      va: g.paid,
      de: g.total,
      valor: g.monthly,
      faltan: g.remaining,
      pendiente: g.remaining * g.monthly,
      interes: g.last.interestRate != null ? g.last.interestRate : '',
    })),
  });

  /* --------------------------------------------------------- Deudas ------- */
  hojas.push({
    name: 'Deudas',
    columns: [
      { header: 'Deuda', key: 'nombre', width: 26 },
      { header: 'Moneda', key: 'moneda', width: 10 },
      { header: 'Total', key: 'total', width: 15, numFmt: COP },
      { header: 'Pagado', key: 'pagado', width: 15, numFmt: COP },
      { header: 'Pendiente', key: 'pendiente', width: 15, numFmt: COP },
      { header: 'Pendiente en COP', key: 'pendienteCOP', width: 18, numFmt: COP },
      { header: 'Interés mensual %', key: 'interes', width: 16 },
      { header: 'Cuota mensual', key: 'cuota', width: 15, numFmt: COP },
      { header: 'Día de pago', key: 'dia', width: 12 },
      { header: 'Desde', key: 'desde', width: 12 },
    ],
    rows: debts.map((d) => ({
      nombre: d.name,
      moneda: d.currency || 'COP',
      total: Number(d.totalAmount) || 0,
      pagado: debtPaid(d),
      pendiente: debtRemaining(d),
      pendienteCOP: debtRemainingCOP(d),
      interes: d.interestRate || 0,
      cuota: d.monthlyPayment || 0,
      dia: d.dueDay || '',
      desde: toDate(d.startDate),
    })),
  });

  hojas.push({
    name: 'Abonos a deudas',
    columns: [
      { header: 'Deuda', key: 'deuda', width: 26 },
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Monto', key: 'monto', width: 15, numFmt: COP },
    ],
    rows: debts.flatMap((d) => (d.payments || [])
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((p) => ({ deuda: d.name, fecha: toDate(p.date), monto: p.amount }))),
  });

  /* --------------------------------------------------- Ahorro y colchones -- */
  hojas.push({
    name: 'Ahorro y colchones',
    columns: [
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Tipo', key: 'tipo', width: 10 },
      { header: 'Al mes (total)', key: 'mensual', width: 15, numFmt: COP },
      { header: 'Al mes (tu parte)', key: 'mio', width: 16, numFmt: COP },
      { header: 'Acumulado', key: 'acumulado', width: 15, numFmt: COP },
      { header: 'Objetivo', key: 'objetivo', width: 15, numFmt: COP },
      { header: 'Fecha meta', key: 'fecha', width: 13 },
      { header: 'Disponible', key: 'liquido', width: 12 },
      { header: 'Mueve la plata', key: 'mueve', width: 14 },
    ],
    rows: buckets.map((b) => {
      const acumulado = sum(b.contributions || [], (c) => c.amount);
      const objetivo = b.targetAmount != null ? Number(b.targetAmount) : null;
      return {
        nombre: b.name,
        tipo: b.kind === 'colchon' ? 'Colchón' : 'Meta',
        mensual: Number(b.monthlyAmount) || 0,
        /* Tu parte se resta, igual que en la app: nunca se guarda por aparte. */
        mio: (Number(b.monthlyAmount) || 0) - sum(b.shares || [], (r) => r.amount),
        acumulado,
        objetivo: objetivo != null ? objetivo : '',
        fecha: toDate(b.targetDate),
        liquido: b.liquid === false ? 'No' : 'Sí',
        mueve: b.movesCash === false ? 'No (reserva)' : 'Sí',
      };
    }),
  });

  hojas.push({
    name: 'Aportes y retiros',
    columns: [
      { header: 'Bucket', key: 'bucket', width: 28 },
      { header: 'Fecha', key: 'fecha', width: 12 },
      { header: 'Monto', key: 'monto', width: 15, numFmt: COP },
      { header: 'Tipo', key: 'tipo', width: 12 },
    ],
    rows: buckets.flatMap((b) => (b.contributions || [])
      .slice()
      .sort((a, c) => (a.date < c.date ? -1 : 1))
      .map((c) => ({
        bucket: b.name,
        fecha: toDate(c.date),
        monto: c.amount,
        tipo: c.amount < 0 ? 'Retiro' : 'Aporte',
      }))),
  });

  /* ----------------------------------------------------- Gastos fijos ----- */
  hojas.push({
    name: 'Gastos fijos',
    columns: [
      { header: 'Nombre', key: 'nombre', width: 26 },
      { header: 'Categoría', key: 'categoria', width: 18 },
      { header: 'Monto', key: 'monto', width: 15, numFmt: COP },
      { header: 'Día de pago', key: 'dia', width: 12 },
      { header: 'Medio de pago', key: 'medio', width: 15 },
      { header: 'Tarjeta', key: 'tarjeta', width: 20 },
    ],
    rows: fixedExpenses.map((f) => ({
      nombre: f.name,
      categoria: getCategory(f.category).label,
      monto: Number(f.amount) || 0,
      dia: f.dueDay || '',
      medio: f.paymentMethod ? getPaymentMethod(f.paymentMethod).label : '',
      tarjeta: cardName(f.cardId),
    })),
  });

  /* ------------------------------------------------ Compromisos futuros --- */
  const proximos = Array.from({ length: 6 }, (_, i) => addMonths(currentMonthKey(), i + 1));
  hojas.push({
    name: 'Compromisos futuros',
    columns: [
      { header: 'Mes', key: 'mes', width: 12 },
      { header: 'Cuotas pendientes', key: 'cuotas', width: 18, numFmt: COP },
      { header: 'Gastos fijos', key: 'fijos', width: 15, numFmt: COP },
      { header: 'Total comprometido', key: 'total', width: 19, numFmt: COP },
      { header: 'Detalle de cuotas', key: 'detalle', width: 50 },
    ],
    rows: buildCommitments(transactions, fixedExpenses, proximos).map((c) => ({
      mes: monthLabel(c.monthKey),
      cuotas: c.installments,
      fijos: c.fixed,
      total: c.total,
      detalle: c.items.map((it) => `${it.note || getCategory(it.category).label} (cuota ${it.cuota}/${it.de})`).join(' · '),
    })),
  });

  return hojas;
}
