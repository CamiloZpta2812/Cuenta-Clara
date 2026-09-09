import { monthSummary, targetDebt, simulatePlanChange } from '../lib/month.js';
import { comparePlans, monthlyRateOf, replayPayments } from '../lib/amortization.js';
import { buildCashFlow, currentBalance } from '../lib/cashflow.js';
import { buildQuincenas, monthGrid } from '../lib/quincenas.js';
import { upcomingCharges } from '../lib/upcoming.js';
import { buildRecommendations, getStatus } from '../lib/insights.js';
import { COLORS } from '../lib/constants.js';
import { activeInstallmentGroups, buildCardStatements, nextStatement } from '../lib/projections.js';

/*
 * Banco de pruebas: el estado de AlDía sin Supabase.
 *
 * Existe porque las pantallas solo se pueden ver estando logueado, y una cuenta
 * de prueba con su contraseña es justo lo que no se debe andar creando. Esto es
 * mejor de todas formas: los números son fijos, así que un cambio en una
 * pantalla se nota de inmediato, y nunca toca datos reales.
 *
 * Los datos son los mismos que se sembraron, para que lo que se ve aquí sea lo
 * que se va a ver en la app de verdad.
 */

const MES = '2026-09';

export const estado = {
  people: [
    { id: 'p-juanjo', name: 'Juanjo' },
    { id: 'p-yeison', name: 'Yeison' },
    { id: 'p-andy',   name: 'Andy' },
    { id: 'p-paula',  name: 'Paula' },
    { id: 'p-alex',   name: 'Alex' },
    { id: 'p-sofi',   name: 'Sofi' },
  ],
  /*
   * El sueldo va partido en dos fuentes, una por quincena. `expected` es
   * mensual, así que una sola fila no podria decir "1.700.000 el 15 y
   * 1.700.000 el 30" — y sin eso no hay calendario de quincenas.
   */
  incomeSources: [
    { id: 'inc-q1', name: 'Salario 1ª quincena', expected: 1_700_000, variable: true, active: true, day: 15, startsPeriod: true },
    { id: 'inc-q2', name: 'Salario 2ª quincena', expected: 1_700_000, variable: true, active: true, day: 30, startsPeriod: true },
    { id: 'inc-club', name: 'Club Aletas', expected: 200_000, variable: true, active: true, day: 5 },
  ],
  fixedExpenses: [
    { id: 'fix-hbo', name: 'HBO Max', category: 'entretenimiento', amount: 8_300,
      totalAmount: 12_450, paymentMethod: 'debito',
      shares: [{ id: 'shr-hbo-juanjo', personId: 'p-juanjo', amount: 4_150 }] , dueDay: 12 },
    { id: 'fix-spotify', name: 'Spotify', category: 'entretenimiento', amount: 6_100,
      totalAmount: 30_500, paymentMethod: 'debito',
      shares: [
        { id: 'shr-sp-yeison', personId: 'p-yeison', amount: 6_100 },
        { id: 'shr-sp-andy',   personId: 'p-andy',   amount: 6_100 },
        { id: 'shr-sp-paula',  personId: 'p-paula',  amount: 6_100 },
        { id: 'shr-sp-alex',   personId: 'p-alex',   amount: 6_100 },
      ] },
    { id: 'fix-icloud',   name: 'iCloud',        category: 'servicios',   amount: 11_300,  totalAmount: 11_300,  paymentMethod: 'debito', shares: [] , dueDay: 9 },
    { id: 'fix-disney',   name: 'Disney+',       category: 'entretenimiento', amount: 12_000, totalAmount: 12_000, paymentMethod: 'debito', shares: [] },
    { id: 'fix-celular',  name: 'Plan Celular',  category: 'servicios',   amount: 53_900,  totalAmount: 53_900,  paymentMethod: 'debito', shares: [] , dueDay: 25 },
    { id: 'fix-corte',    name: 'Corte de cabello', category: 'otros_gasto', amount: 40_000, totalAmount: 40_000, paymentMethod: 'debito', shares: [] },
    { id: 'fix-casa',     name: 'Aporte Casa',   category: 'vivienda',    amount: 300_000, totalAmount: 300_000, paymentMethod: 'debito', shares: [] , dueDay: 5 },
    { id: 'fix-gimnasio', name: 'Gimnasio',      category: 'salud',       amount: 103_400, totalAmount: 103_400, paymentMethod: 'debito', shares: [] , dueDay: 14 },
    { id: 'fix-manejo',   name: 'Cuota de manejo tarjeta', category: 'servicios', amount: 51_000, totalAmount: 51_000, paymentMethod: 'debito', shares: [] },
  ],
  /* Yeison ya pagó su Spotify; los otros cuatro cobros siguen pendientes. */
  collections: [
    { id: 'co-1', month: MES, shareId: 'shr-sp-yeison', collectedAt: '2026-09-03' },
  ],
  buckets: [
    { id: 'bkt-ahorro-1', depositDay: 15, name: 'Ahorro personal 1', kind: 'meta', liquid: true, monthlyAmount: 50_000,
      contributions: [{ id: 'ap-1', amount: 50_000, date: '2026-09-05' }] },
    // Fondo común con Sofi: 600.000 al mes entre dos, cada uno mete lo suyo.
    { id: 'bkt-fondo', depositDay: 15, name: 'Fondo Sofi', kind: 'meta', liquid: true, monthlyAmount: 600_000,
      targetAmount: 12_000_000, targetDate: '2027-12-31', movesCash: true,
      shares: [{ id: 'sh-fondo', personId: 'p-sofi', amount: 300_000 }],
      contributions: [{ id: 'ap-3', amount: 3_600_000, date: '2026-06-05' }] },
    { id: 'bkt-coop', depositDay: 15,     name: 'Cooperativa', kind: 'meta', liquid: false, monthlyAmount: 76_000, contributions: [] },
    { id: 'bkt-gatos', depositDay: 15,    name: 'Colchón gatos', kind: 'colchon', liquid: true, monthlyAmount: 130_000,
      movesCash: true, shares: [{ id: 'sh-gatos', personId: 'p-sofi', amount: 65_000 }],
      contributions: [{ id: 'ap-2', amount: 130_000, date: '2026-09-05' }] },
    // Reserva: no mueve plata, se llena con las tanqueadas.
    { id: 'bkt-gasolina', name: 'Gasolina', kind: 'colchon', liquid: true, monthlyAmount: 160_000,
      movesCash: false, shares: [], contributions: [] },
    { id: 'bkt-moto', depositDay: 15,     name: 'Colchón moto', kind: 'colchon', liquid: true, monthlyAmount: 100_000,
      contributions: [{ id: 'ap-4', amount: 300_000, date: '2026-07-05' }, { id: 'ap-5', amount: -180_000, date: '2026-08-14' }] },
    { id: 'bkt-seg', depositDay: 15,      name: 'Colchón de seguridad', kind: 'colchon', liquid: true, monthlyAmount: 300_000, contributions: [] },
  ],
  debts: [
    { id: 'debt-li', name: 'Libre inversión Bancolombia', totalAmount: 14_000_000,
      interestRate: 1.67, monthlyPayment: 446_413, fixedPayment: 446_413,
      payoffMode: 'reducir-plazo', currentBalance: 13_100_800, startDate: '2026-09-08', dueDay: 8,
      currency: 'COP',
      // Cuota + abono extra, con el saldo que quedó según el modelo.
      payments: [{ id: 'pd-1', amount: 1_133_000, date: '2026-09-10' }] },
  ],
  /* El día del desembolso: de ahí arranca el saldo. */
  balanceAnchor: { date: '2026-09-08', amount: 357_000 },
  /* Septiembre viene apretado: el colchón de seguridad va a la mitad. */
  bucketAdjustments: [
    { id: 'aj-seg', month: MES, bucketId: 'bkt-seg', amount: 150_000 },
  ],
  monthlyPlans: [
    { month: MES, expectedIncome: 3_600_000, fixedExpenses: 746_000, debtPayment: 446_413,
      savings: 426_000, variableEstimate: 830_000, cushion: 465_000, locked: false },
  ],
  creditCards: [
    { id: 'card-1', name: 'Visa Bancolombia', lastFour: '4417', currency: 'COP', cutDay: 15, paymentDay: 5 },
  ],
  transactions: [
    { id: 't1', type: 'ingreso', amount: 3_400_000, category: 'salario', date: '2026-09-30', paymentMethod: 'debito' },
    { id: 't2', type: 'ingreso', amount: 200_000, category: 'otros_ingreso', date: '2026-09-15', paymentMethod: 'debito' },
    { id: 't3', type: 'gasto', amount: 300_000, category: 'vivienda', date: '2026-09-01', fixedExpenseId: 'fix-casa', paymentMethod: 'debito' },
    { id: 't4', type: 'gasto', amount: 118_000, category: 'transporte', date: '2026-09-02', bucketId: 'bkt-gasolina', paymentMethod: 'debito', note: 'Tanqueada' },
    { id: 't5', type: 'gasto', amount: 420_000, category: 'alimentacion', date: '2026-09-10', paymentMethod: 'debito' },
    /* Compra a cuotas: gasto de septiembre, plata que sale en noviembre. */
    { id: 't6', type: 'gasto', amount: 100_000, category: 'compras', date: '2026-09-20', note: 'Audífonos',
      paymentMethod: 'credito', cardId: 'card-1', cashOutDate: '2026-11-05',
      isInstallment: true, totalInstallments: 12, currentInstallment: 1, installmentGroupId: 'g1' },
  ],
  customCategories: [],
  categoryLabels: {},
};

/*
 * El mismo cálculo que hace el store de verdad. Si un día divergen, la pantalla
 * se vería distinta aquí que en la app — por eso se llama a las mismas
 * funciones y no se copian los números a mano.
 */
export function buildValue(overrides = {}) {
  const statements = estado.creditCards
    .map((card) => ({ card, next: nextStatement(buildCardStatements(estado.transactions, card), '2026-09-07') }))
    .filter((c) => c.next);
  const groups = activeInstallmentGroups(estado.transactions);

  /*
   * El banco de pruebas también deja escoger deuda: si no, el caso de varias
   * deudas no se puede ver, que es justo para lo que existe esto.
   */
  const deuda = targetDebt(estado, overrides.selectedDebtId);
  const extra = Math.max(0, monthSummary(estado, MES).plan.availableForExtra);

  return {
    ...estado,
    debtOutlook: {
      debt: deuda, extra,
      hechas: replayPayments({
        principal: deuda.totalAmount,
        monthlyRate: monthlyRateOf(deuda),
        payments: deuda.payments,
      }),
      ...comparePlans({
        principal: deuda.currentBalance,
        monthlyRate: monthlyRateOf(deuda),
        minimumPayment: deuda.fixedPayment,
        extra,
      }),
    },
    simulatePlan: (cambios) => simulatePlanChange(estado, cambios, MES, overrides.selectedDebtId),
    selectedDebtId: overrides.selectedDebtId || null,
    cashFlow: buildCashFlow(estado, ['2026-07', '2026-08', '2026-09']),
    saldoReal: currentBalance(estado, '2026-09-30'),
    bucketAdjustments: estado.bucketAdjustments,
    quincenas: buildQuincenas(estado, MES),
    calendarioRejilla: monthGrid(estado, MES, '2026-09-09'),
    incomeSources: estado.incomeSources,
    handleEditDebt: () => {},
    editingDebtId: null,
    handleAddIncomeSource: () => {},
    handleUpdateIncomeSource: () => {},
    handleDeleteIncomeSource: () => {},
    configTab: 'ingresos',
    setConfigTab: () => {},
    handleAdjustBucketMonth: () => {},
    balanceAnchor: estado.balanceAnchor,
    handleAnchorBalance: () => {},
    planDistribution: (() => {
      const p = monthSummary(estado, MES).plan;
      return [
        { name: 'Gastos fijos',   value: p.fixedExpenses, color: COLORS.debt },
        { name: 'Cuota de deuda', value: p.debtPayment,   color: '#8C6BB1' },
        { name: 'Abono extra',    value: Math.max(0, p.availableForExtra), color: COLORS.income },
        { name: 'Metas',          value: p.savings,       color: COLORS.savings },
        { name: 'Colchones',      value: p.cushion,       color: '#3E7FB0' },
        { name: 'Gasto variable', value: p.variable,      color: COLORS.expense },
      ].filter((x) => x.value > 0);
    })(),
    selMonthIncome: 3_600_000, selMonthExpense: 980_000,
    selMonthFixed: 460_000, selMonthVariable: 520_000,
    status: getStatus(monthSummary(estado, MES).plan),
    recommendations: buildRecommendations(estado, MES),
    exporting: '', handleExportExcel: () => {},
    paymentInputs: {}, setPaymentInputs: () => {},
    balanceInputs: {}, setBalanceInputs: () => {},
    handleAddPayment: () => {},
    selectedMonth: MES,
    setSelectedMonth: () => {},
    setActiveTab: () => {},
    paidDateInputs: {}, setPaidDateInputs: () => {},
    findFixedExpensePaidThisMonth: (id) => (id === 'fix-casa'
      ? { id: 'tx', date: '2026-09-01' } : null),
    handleMarkFixedExpensePaid: () => {}, handleUndoFixedExpensePaid: () => {},
    handleEditFixedExpense: () => {}, handleDeleteFixedExpense: () => {},
    handleAddFixedExpense: (e) => e.preventDefault(),
    handleCancelFixedForm: () => {}, showFixedForm: false, setShowFixedForm: () => {},
    editingFixedId: null,
    fixedForm: { name: '', category: 'servicios', amount: '', dueDay: '', paymentMethod: 'debito', cardId: '' },
    setFixedForm: () => {},
    cardLabel: () => 'Visa 4417',
    proximosCobros: upcomingCharges(estado, 8, '2026-09-08'),
    filteredTx: [...estado.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)),
    txFilters: { type: 'todos', month: 'todos', category: 'todas', paymentMethod: 'todos', fixed: 'todos', day: '' },
    setTxFilters: () => {},
    txFilterCategories: [{ id: 'alimentacion', label: 'Alimentación' }],
    /* Lo que el formulario de movimiento pide del store, ya calculado. */
    txFormCategories: [
      { id: 'alimentacion', label: 'Alimentación' },
      { id: 'transporte', label: 'Transporte' },
      { id: 'compras', label: 'Compras' },
    ],
    txIsUSD: false, txEffectiveRate: 4000, txChargeDate: null,
    handleEditTransaction: () => {}, handleDeleteTransaction: () => {},
    handleAddTransaction: (e) => e.preventDefault(),
    handleCancelTxForm: () => {}, handleOpenNewMovement: () => {},
    debtForm: { name: '', totalAmount: '', interestRate: '', monthlyPayment: '', dueDay: '', startDate: '2026-09-08', currency: 'COP', exchangeRate: '' },
    setDebtForm: () => {}, debtFormError: '', handleAddDebt: (e) => e.preventDefault(),
    handleCancelDebtForm: () => {}, showDebtForm: false, setShowDebtForm: () => {},
    showTxForm: false, setShowTxForm: () => {}, editingTxId: null, txFormError: '',
    txForm: { type: 'gasto', amount: '', category: 'alimentacion', date: '2026-09-08', note: '', paymentMethod: 'debito', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' },
    setTxForm: () => {}, txSelectedCard: null, usdRate: 4000,
    allExpenseCategories: [{ id: 'alimentacion', label: 'Alimentación' }],
    allIncomeCategories: [{ id: 'salario', label: 'Salario' }],
    getInstallmentGroup: () => [], handleRegisterNextInstallment: () => {},
    bucketInputs: {},
    setBucketInputs: () => {},
    bucketForm: { name: '', kind: 'meta', liquid: true, monthlyAmount: '', targetAmount: '', targetDate: '' },
    setBucketForm: () => {},
    showBucketForm: false,
    setShowBucketForm: () => {},
    handleAddBucket: (e) => e.preventDefault(),
    handleBucketMovement: () => {},
    handleDeleteBucket: () => {},
    handleEditBucket: () => {},
    handleCancelBucketForm: () => {},
    editingBucketId: null,
    handleToggleCollection: (shareId) => window.alert(`Marcaría el cobro ${shareId}. En el banco de pruebas no se guarda nada.`),
    availableMonths: ['2026-09', '2026-08', '2026-07'],
    monthReport: monthSummary(estado, MES),
    cardOutlook: {
      statements,
      dueNext: statements.reduce((s, c) => s + c.next.total, 0),
      groups,
      committed: groups.reduce((s, g) => s + g.monthly * g.remaining, 0),
    },
    ...overrides,
  };
}
