import { monthSummary } from '../lib/month.js';
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
  ],
  incomeSources: [
    { id: 'inc-salario', name: 'Salario', expected: 3_400_000, variable: true, active: true },
    { id: 'inc-club',    name: 'Club Aletas', expected: 200_000, variable: true, active: true },
  ],
  fixedExpenses: [
    { id: 'fix-hbo', name: 'HBO Max', category: 'entretenimiento', amount: 8_300,
      totalAmount: 12_450, paymentMethod: 'debito',
      shares: [{ id: 'shr-hbo-juanjo', personId: 'p-juanjo', amount: 4_150 }] },
    { id: 'fix-spotify', name: 'Spotify', category: 'entretenimiento', amount: 6_100,
      totalAmount: 30_500, paymentMethod: 'debito',
      shares: [
        { id: 'shr-sp-yeison', personId: 'p-yeison', amount: 6_100 },
        { id: 'shr-sp-andy',   personId: 'p-andy',   amount: 6_100 },
        { id: 'shr-sp-paula',  personId: 'p-paula',  amount: 6_100 },
        { id: 'shr-sp-alex',   personId: 'p-alex',   amount: 6_100 },
      ] },
    { id: 'fix-icloud',   name: 'iCloud',        category: 'servicios',   amount: 11_300,  totalAmount: 11_300,  paymentMethod: 'debito', shares: [] },
    { id: 'fix-disney',   name: 'Disney+',       category: 'entretenimiento', amount: 12_000, totalAmount: 12_000, paymentMethod: 'debito', shares: [] },
    { id: 'fix-celular',  name: 'Plan Celular',  category: 'servicios',   amount: 53_900,  totalAmount: 53_900,  paymentMethod: 'debito', shares: [] },
    { id: 'fix-corte',    name: 'Corte de cabello', category: 'otros_gasto', amount: 40_000, totalAmount: 40_000, paymentMethod: 'debito', shares: [] },
    { id: 'fix-casa',     name: 'Aporte Casa',   category: 'vivienda',    amount: 300_000, totalAmount: 300_000, paymentMethod: 'debito', shares: [] },
    { id: 'fix-gimnasio', name: 'Gimnasio',      category: 'salud',       amount: 103_400, totalAmount: 103_400, paymentMethod: 'debito', shares: [] },
    { id: 'fix-gasolina', name: 'Gasolina',      category: 'transporte',  amount: 160_000, totalAmount: 160_000, paymentMethod: 'debito', shares: [] },
    { id: 'fix-manejo',   name: 'Cuota de manejo tarjeta', category: 'servicios', amount: 51_000, totalAmount: 51_000, paymentMethod: 'debito', shares: [] },
  ],
  /* Yeison ya pagó su Spotify; los otros cuatro cobros siguen pendientes. */
  collections: [
    { id: 'co-1', month: MES, shareId: 'shr-sp-yeison', collectedAt: '2026-09-03' },
  ],
  buckets: [
    { id: 'bkt-ahorro-1', name: 'Ahorro personal 1', kind: 'meta', liquid: true, monthlyAmount: 50_000,
      contributions: [{ id: 'ap-1', amount: 50_000, date: '2026-09-05' }] },
    { id: 'bkt-ahorro-2', name: 'Ahorro personal 2', kind: 'meta', liquid: true, monthlyAmount: 300_000, contributions: [] },
    { id: 'bkt-coop',     name: 'Cooperativa', kind: 'meta', liquid: false, monthlyAmount: 76_000, contributions: [] },
    { id: 'bkt-gatos',    name: 'Colchón gatos', kind: 'colchon', liquid: true, monthlyAmount: 65_000,
      contributions: [{ id: 'ap-2', amount: 65_000, date: '2026-09-05' }] },
    { id: 'bkt-moto',     name: 'Colchón moto', kind: 'colchon', liquid: true, monthlyAmount: 100_000, contributions: [] },
    { id: 'bkt-seg',      name: 'Colchón de seguridad', kind: 'colchon', liquid: true, monthlyAmount: 300_000, contributions: [] },
  ],
  debts: [
    { id: 'debt-li', name: 'Libre inversión Bancolombia', totalAmount: 14_000_000,
      interestRate: 1.67, monthlyPayment: 446_413, fixedPayment: 446_413,
      payoffMode: 'reducir-plazo', currentBalance: 14_000_000, startDate: '2026-09-01',
      currency: 'COP',
      payments: [{ id: 'pd-1', amount: 446_413, date: '2026-09-10' }] },
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
    { id: 't4', type: 'gasto', amount: 160_000, category: 'transporte', date: '2026-09-02', fixedExpenseId: 'fix-gasolina', paymentMethod: 'debito' },
    { id: 't5', type: 'gasto', amount: 420_000, category: 'alimentacion', date: '2026-09-10', paymentMethod: 'debito' },
    /* Compra a cuotas: gasto de septiembre, plata que sale en noviembre. */
    { id: 't6', type: 'gasto', amount: 100_000, category: 'compras', date: '2026-09-20', note: 'Audífonos',
      paymentMethod: 'credito', cardId: 'card-1', cashOutDate: '2026-11-05',
      isInstallment: true, totalInstallments: 12, currentInstallment: 1, installmentGroupId: 'g1' },
  ],
  customCategories: [],
  categoryLabels: {},
  savingsGoals: [],
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

  return {
    ...estado,
    selectedMonth: MES,
    setSelectedMonth: () => {},
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
