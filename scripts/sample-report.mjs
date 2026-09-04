/*
 * Genera un reporte de ejemplo con datos inventados, para ver cómo queda el
 * Excel sin tener que usar datos reales.
 *
 *   node scripts/sample-report.mjs [salida.xlsx]
 *
 * También sirve de comprobación: si el archivo se genera y se puede volver a
 * leer con las hojas y filas esperadas, el formato es válido.
 */
import { buildWorkbook } from '../src/lib/exportExcel.js';

const ejemplo = {
  transactions: [
    { id: 't1', type: 'ingreso', amount: 4200000, category: 'salario', date: '2026-07-30', note: 'Nómina julio' },
    { id: 't2', type: 'ingreso', amount: 4200000, category: 'salario', date: '2026-08-30', note: 'Nómina agosto' },
    { id: 't3', type: 'ingreso', amount: 850000, category: 'freelance', date: '2026-08-12', note: 'Proyecto web' },
    { id: 't4', type: 'gasto', amount: 1450000, category: 'vivienda', date: '2026-07-01', note: 'Arriendo', paymentMethod: 'debito', isFixed: true, fixedExpenseId: 'f1' },
    { id: 't5', type: 'gasto', amount: 1450000, category: 'vivienda', date: '2026-08-01', note: 'Arriendo', paymentMethod: 'debito', isFixed: true, fixedExpenseId: 'f1' },
    { id: 't6', type: 'gasto', amount: 89900, category: 'servicios', date: '2026-08-05', note: 'Internet', paymentMethod: 'debito', isFixed: true, fixedExpenseId: 'f2' },
    { id: 't7', type: 'gasto', amount: 320000, category: 'alimentacion', date: '2026-08-03', note: 'Mercado quincena', paymentMethod: 'debito' },
    { id: 't8', type: 'gasto', amount: 145000, category: 'alimentacion', date: '2026-08-18', note: 'Mercado quincena', paymentMethod: 'efectivo' },
    { id: 't9', type: 'gasto', amount: 62000, category: 'transporte', date: '2026-08-07', note: 'Gasolina', paymentMethod: 'credito', cardId: 'c1' },
    { id: 't10', type: 'gasto', amount: 38000, category: 'entretenimiento', date: '2026-08-16', note: 'Cine', paymentMethod: 'credito', cardId: 'c1' },
    { id: 't11', type: 'gasto', amount: 210000, category: 'compras', date: '2026-08-20', note: 'Zapatos', paymentMethod: 'credito', cardId: 'c2' },
    { id: 't12', type: 'gasto', amount: 128000, category: 'compras', date: '2026-06-14', note: 'Audífonos', paymentMethod: 'credito', cardId: 'c2', isInstallment: true, totalInstallments: 12, currentInstallment: 3, interestRate: 2.08, totalAmount: 1536000, installmentGroupId: 'grp1', currency: 'USD', originalAmount: 32, exchangeRateUsed: 4000 },
    { id: 't13', type: 'gasto', amount: 400000, category: 'deudas', date: '2026-08-10', note: 'Abono a Crédito de estudio', paymentMethod: 'debito', debtId: 'd1', debtPaymentId: 'p2' },
    { id: 't14', type: 'gasto', amount: 95000, category: 'salud', date: '2026-07-22', note: 'Odontólogo', paymentMethod: 'efectivo' },
  ],
  creditCards: [
    { id: 'c1', name: 'Bancolombia Mastercard', lastFour: '4821', currency: 'COP', cutDay: 15, paymentDay: 5 },
    { id: 'c2', name: 'Amex Gold', lastFour: '1109', currency: 'USD', cutDay: 20, paymentDay: 10 },
  ],
  fixedExpenses: [
    { id: 'f1', name: 'Arriendo', category: 'vivienda', amount: 1450000, dueDay: 1, paymentMethod: 'debito' },
    { id: 'f2', name: 'Internet', category: 'servicios', amount: 89900, dueDay: 5, paymentMethod: 'debito' },
  ],
  debts: [
    { id: 'd1', name: 'Crédito de estudio', totalAmount: 8000000, interestRate: 1.2, monthlyPayment: 400000, dueDay: 10, startDate: '2025-02-01', currency: 'COP',
      payments: [{ id: 'p1', amount: 400000, date: '2026-07-10' }, { id: 'p2', amount: 400000, date: '2026-08-10' }] },
    { id: 'd2', name: 'Préstamo familiar (USD)', totalAmount: 1200, interestRate: 0, monthlyPayment: 0, dueDay: null, startDate: '2026-05-01', currency: 'USD', exchangeRate: 4050, payments: [] },
  ],
  savingsGoals: [
    { id: 'g1', name: 'Fondo de emergencia', targetAmount: 9000000, targetDate: '2027-12-31',
      contributions: [{ id: 'a1', amount: 800000, date: '2026-06-30' }, { id: 'a2', amount: 800000, date: '2026-07-31' }, { id: 'a3', amount: -200000, date: '2026-08-14' }] },
    { id: 'g2', name: 'Viaje', targetAmount: 4000000, targetDate: '2027-06-01',
      contributions: [{ id: 'a4', amount: 500000, date: '2026-08-01' }] },
  ],
  customCategories: [],
  categoryLabels: {},
  monthStartDay: 1,
};

const salida = process.argv[2] || 'AlDia-reporte-ejemplo.xlsx';
const libro = await buildWorkbook(ejemplo);
await libro.xlsx.writeFile(salida);

// Verificación: se vuelve a abrir el archivo escrito y se listan sus hojas.
const ExcelJS = (await import('exceljs')).default;
const releido = new ExcelJS.Workbook();
await releido.xlsx.readFile(salida);

console.log(`Generado: ${salida}\n`);
console.log('Hoja                          Filas  Columnas');
console.log('-'.repeat(48));
releido.eachSheet((ws) => {
  console.log(`${ws.name.padEnd(30)}${String(ws.rowCount - 1).padStart(5)}${String(ws.columnCount).padStart(10)}`);
});
