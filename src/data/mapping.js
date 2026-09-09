/*
 * Traducción entre la forma que usa la app en memoria (camelCase, deudas con
 * sus abonos adentro) y las filas de Postgres (snake_case, tablas separadas).
 *
 * Todo aquí es una función pura a propósito: es el punto donde un error te
 * perdería datos al migrar, así que tiene que poder probarse sin base de datos.
 * Ver src/data/mapping.test.js.
 */

import { monthKeyFromDate } from '../lib/dates.js';

/*
 * Orden de escritura: cada tabla va después de aquellas a las que apunta con
 * una llave foránea. Para borrar hay que recorrerlo al revés.
 *
 * `transactions` va de última porque referencia gastos fijos, deudas, abonos,
 * buckets y fuentes de ingreso.
 */
/*
 * `savings_goals` y `goal_contributions` NO están en esta lista a propósito.
 * Las reemplazaron los buckets, que saben dos cosas que una meta no sabía: si
 * es meta o colchón, y si puedes tocar la plata.
 *
 * Las tablas siguen en Postgres, vacías, como respaldo. Fuera de aquí la app
 * ni las lee ni las escribe.
 */
export const TABLES = [
  'user_settings',
  'custom_categories',
  'credit_cards',
  'people',
  'income_sources',
  'fixed_expenses',
  'fixed_expense_shares',
  'collections',
  'debts',
  'debt_payments',
  'buckets',
  'bucket_shares',
  'bucket_contributions',
  'bucket_adjustments',
  'monthly_plans',
  'transactions',
];

export const WRITE_ORDER = TABLES;

/*
 * Con qué columna se identifica una fila dentro de su tabla. Casi todas usan
 * `id`; `monthly_plans` no tiene id propio porque solo puede haber un plan por
 * mes, así que el mes ES la llave. `user_settings` es la fila única del usuario.
 */
const KEY_BY_TABLE = { monthly_plans: 'month', user_settings: 'user_id' };

export const SINGLETON_TABLE = 'user_settings';

export function keyColumn(table) {
  return KEY_BY_TABLE[table] || 'id';
}

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const int = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10));
const str = (v) => (v === null || v === undefined ? null : String(v));
const bool = (v) => !!v;
const date = (v) => (v ? String(v).slice(0, 10) : null);

/*
 * A qué mes del plan cuenta un registro. Casi siempre el de su fecha, pero si
 * la quincena del 30 cae domingo y te pagan el 2, ese ingreso sigue contando
 * en el mes anterior — por eso el mes se guarda y no solo se deduce.
 */
const monthOf = (r) => r.month || monthKeyFromDate(r.date) || null;

/* ============================ estado -> filas ============================ */

export function transactionToRow(t) {
  return {
    id: t.id,
    type: t.type,
    amount: num(t.amount),
    category: t.category,
    date: date(t.date),
    note: t.note || '',
    payment_method: str(t.paymentMethod),
    card_id: str(t.cardId) || null,
    is_fixed: bool(t.isFixed),
    is_installment: bool(t.isInstallment),
    total_installments: int(t.totalInstallments),
    current_installment: int(t.currentInstallment),
    interest_rate: num(t.interestRate),
    total_amount: num(t.totalAmount),
    installment_group_id: str(t.installmentGroupId) || null,
    currency: t.currency === 'USD' ? 'USD' : 'COP',
    original_amount: num(t.originalAmount),
    exchange_rate_used: num(t.exchangeRateUsed),
    fixed_expense_id: str(t.fixedExpenseId) || null,
    debt_id: str(t.debtId) || null,
    debt_payment_id: str(t.debtPaymentId) || null,
    bucket_id: str(t.bucketId) || null,
    income_source_id: str(t.incomeSourceId) || null,
    month: monthOf(t),
    // Cuándo sale la plata de verdad: con débito es el mismo día, con tarjeta
    // de crédito es cuando pagas la factura.
    cash_out_date: date(t.cashOutDate) || date(t.date),
  };
}

export function cardToRow(c) {
  return {
    id: c.id,
    name: c.name,
    last_four: str(c.lastFour),
    currency: c.currency === 'USD' ? 'USD' : 'COP',
    cut_day: int(c.cutDay),
    payment_day: int(c.paymentDay),
  };
}

export function fixedExpenseToRow(f) {
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    /*
     * `amount` es la columna vieja: lo que pagabas antes de que existiera el
     * reparto. Sigue ahí porque las pantallas actuales todavía la leen, pero la
     * verdad de cuánto te toca a ti es myShare() en lib/month.js — total menos
     * lo repartido. Se va cuando las pantallas migren.
     */
    amount: num(f.amount),
    total_amount: num(f.totalAmount) !== null ? num(f.totalAmount) : num(f.amount),
    due_day: int(f.dueDay),
    payment_method: str(f.paymentMethod),
    card_id: str(f.cardId) || null,
  };
}

export function debtToRow(d) {
  return {
    id: d.id,
    name: d.name,
    total_amount: num(d.totalAmount),
    interest_rate: num(d.interestRate) || 0,
    monthly_payment: num(d.monthlyPayment) || 0,
    due_day: int(d.dueDay),
    start_date: date(d.startDate),
    currency: d.currency === 'USD' ? 'USD' : 'COP',
    exchange_rate: num(d.exchangeRate),
    /* La cuota pactada con el banco, que no cambia al abonar de más. */
    fixed_payment: num(d.fixedPayment) !== null ? num(d.fixedPayment) : num(d.monthlyPayment) || 0,
    payoff_mode: d.payoffMode === 'reducir-cuota' ? 'reducir-cuota' : 'reducir-plazo',
    /* El saldo que reporta el banco. Si es null, se deduce de los abonos. */
    current_balance: num(d.currentBalance),
  };
}

export function personToRow(p) {
  return {
    id: p.id,
    name: p.name,
    /* Reservado para cuando dos cuentas se vinculen. Hoy siempre null. */
    linked_user_id: p.linkedUserId || null,
  };
}

export function incomeSourceToRow(i) {
  return {
    id: i.id,
    name: i.name,
    /* Lo esperado es el PLAN, no la verdad: lo que entró son movimientos. */
    expected: num(i.expected) || 0,
    variable: bool(i.variable),
    active: i.active === undefined ? true : bool(i.active),
    /* Qué día cae, y si ese día abre una quincena. Ver lib/quincenas.js. */
    day: int(i.day),
    starts_period: bool(i.startsPeriod),
  };
}

/*
 * "Este mes este bucket va por tanto". Ver schema-v5-ajustes-del-mes.sql: el
 * monto es TU parte para ese mes, no la del pote, porque es la cifra contra la
 * que se juzga el mes.
 */
export function bucketAdjustmentToRow(a) {
  return {
    id: a.id,
    month: a.month,
    bucket_id: a.bucketId,
    amount: num(a.amount) || 0,
  };
}

export function collectionToRow(c) {
  return {
    id: c.id,
    month: c.month,
    share_id: c.shareId,
    collected_at: date(c.collectedAt),
  };
}

export function bucketToRow(b) {
  return {
    id: b.id,
    name: b.name,
    /* 'meta' tiene un objetivo al que llegar; 'colchon' es margen sin destino. */
    kind: b.kind === 'colchon' ? 'colchon' : 'meta',
    /*
     * false = reserva: no mueves la plata, solo apartas el cupo, y va saliendo
     * con cada gasto. La gasolina. Ver lib/month.js.
     */
    moves_cash: b.movesCash === undefined ? true : bool(b.movesCash),
    /* false = está ahí pero no lo puedes tocar (aporte a cooperativa). */
    liquid: b.liquid === undefined ? true : bool(b.liquid),
    monthly_amount: num(b.monthlyAmount) || 0,
    /* Qué día apartas. Es la palanca con la que se equilibra un mes torcido. */
    deposit_day: int(b.depositDay),
    target_amount: num(b.targetAmount),
    target_date: date(b.targetDate),
  };
}

export function monthlyPlanToRow(p) {
  return {
    month: p.month,
    expected_income: num(p.expectedIncome) || 0,
    fixed_expenses: num(p.fixedExpenses) || 0,
    debt_payment: num(p.debtPayment) || 0,
    savings: num(p.savings) || 0,
    variable_estimate: num(p.variableEstimate) || 0,
    cushion: num(p.cushion) || 0,
    /* Un mes cerrado ya no se recalcula: se juzga contra el plan que tenía. */
    locked: bool(p.locked),
  };
}

export function customCategoryToRow(c) {
  return {
    id: c.id,
    type: c.type,
    label: c.label,
    icon_key: str(c.iconKey),
    color: str(c.color),
  };
}

/*
 * El ancla del saldo viaja en dos columnas y no en un jsonb porque es un dato
 * que se consulta —"¿desde cuándo sé cuánto tengo?"— y no una bolsa de
 * preferencias. Sin fecha no hay ancla, así que las dos se guardan o ninguna:
 * un monto suelto no diría de qué día es.
 */
export function settingsToRow(state) {
  const ancla = state.balanceAnchor;
  return {
    category_labels: state.categoryLabels || {},
    setup_completed_at: state.setupCompletedAt || null,
    balance_anchor_date: ancla && ancla.date ? date(ancla.date) : null,
    balance_anchor_amount: ancla && ancla.date ? num(ancla.amount) || 0 : null,
  };
}

/*
 * Aplana los hijos que en memoria viven dentro de su padre: los abonos dentro
 * de la deuda, los aportes dentro del bucket, el reparto dentro del gasto fijo.
 * En Postgres cada uno es su propia tabla.
 */
export function stateToRows(state) {
  const debtPayments = [];
  (state.debts || []).forEach((d) => {
    (d.payments || []).forEach((p) => {
      debtPayments.push({
        id: p.id, debt_id: d.id, amount: num(p.amount), date: date(p.date),
        month: monthOf(p),
        /* El saldo que quedó según el banco, para cuadrar contra el modelo. */
        balance_after: num(p.balanceAfter),
      });
    });
  });

  const shares = [];
  (state.fixedExpenses || []).forEach((f) => {
    (f.shares || []).forEach((r) => {
      shares.push({
        id: r.id, fixed_expense_id: f.id, person_id: r.personId, amount: num(r.amount) || 0,
      });
    });
  });

  const bucketShares = [];
  (state.buckets || []).forEach((b) => {
    (b.shares || []).forEach((r) => {
      bucketShares.push({
        id: r.id, bucket_id: b.id, person_id: r.personId, amount: num(r.amount) || 0,
      });
    });
  });

  const bucketContributions = [];
  (state.buckets || []).forEach((b) => {
    (b.contributions || []).forEach((c) => {
      bucketContributions.push({
        id: c.id, bucket_id: b.id, amount: num(c.amount), date: date(c.date), month: monthOf(c),
      });
    });
  });

  return {
    user_settings: [settingsToRow(state)],
    custom_categories: (state.customCategories || []).map(customCategoryToRow),
    credit_cards: (state.creditCards || []).map(cardToRow),
    people: (state.people || []).map(personToRow),
    income_sources: (state.incomeSources || []).map(incomeSourceToRow),
    fixed_expenses: (state.fixedExpenses || []).map(fixedExpenseToRow),
    fixed_expense_shares: shares,
    bucket_adjustments: (state.bucketAdjustments || []).map(bucketAdjustmentToRow),
    collections: (state.collections || []).map(collectionToRow),
    debts: (state.debts || []).map(debtToRow),
    debt_payments: debtPayments,
    buckets: (state.buckets || []).map(bucketToRow),
    bucket_shares: bucketShares,
    bucket_contributions: bucketContributions,
    monthly_plans: (state.monthlyPlans || []).map(monthlyPlanToRow),
    transactions: (state.transactions || []).map(transactionToRow),
  };
}

/* ============================ filas -> estado ============================ */

export function rowToTransaction(r) {
  return {
    id: r.id,
    type: r.type,
    amount: num(r.amount),
    category: r.category,
    date: date(r.date),
    note: r.note || '',
    paymentMethod: r.payment_method,
    cardId: r.card_id,
    isFixed: bool(r.is_fixed),
    isInstallment: bool(r.is_installment),
    totalInstallments: int(r.total_installments),
    currentInstallment: int(r.current_installment),
    interestRate: num(r.interest_rate),
    totalAmount: num(r.total_amount),
    installmentGroupId: r.installment_group_id,
    currency: r.currency === 'USD' ? 'USD' : 'COP',
    originalAmount: num(r.original_amount),
    exchangeRateUsed: num(r.exchange_rate_used),
    fixedExpenseId: r.fixed_expense_id,
    debtId: r.debt_id,
    debtPaymentId: r.debt_payment_id,
    bucketId: r.bucket_id || null,
    incomeSourceId: r.income_source_id || null,
    month: r.month || monthKeyFromDate(r.date) || null,
    cashOutDate: date(r.cash_out_date) || date(r.date),
  };
}

export function rowsToState(rows) {
  const settings = (rows.user_settings || [])[0] || {};

  const groupBy = (list, field, make) => {
    const out = {};
    (list || []).forEach((r) => {
      (out[r[field]] = out[r[field]] || []).push(make(r));
    });
    return out;
  };

  const paymentsByDebt = groupBy(rows.debt_payments, 'debt_id', (p) => ({
    id: p.id, amount: num(p.amount), date: date(p.date),
    month: p.month || monthKeyFromDate(p.date) || null,
    balanceAfter: num(p.balance_after),
  }));
  const sharesByExpense = groupBy(rows.fixed_expense_shares, 'fixed_expense_id', (r) => ({
    id: r.id, personId: r.person_id, amount: num(r.amount) || 0,
  }));
  const sharesByBucket = groupBy(rows.bucket_shares, 'bucket_id', (r) => ({
    id: r.id, personId: r.person_id, amount: num(r.amount) || 0,
  }));
  const contributionsByBucket = groupBy(rows.bucket_contributions, 'bucket_id', (c) => ({
    id: c.id, amount: num(c.amount), date: date(c.date),
    month: c.month || monthKeyFromDate(c.date) || null,
  }));

  return {
    transactions: (rows.transactions || []).map(rowToTransaction),
    creditCards: (rows.credit_cards || []).map((c) => ({
      id: c.id, name: c.name, lastFour: c.last_four,
      currency: c.currency === 'USD' ? 'USD' : 'COP',
      cutDay: int(c.cut_day), paymentDay: int(c.payment_day),
    })),
    people: (rows.people || []).map((p) => ({
      id: p.id, name: p.name, linkedUserId: p.linked_user_id || null,
    })),
    incomeSources: (rows.income_sources || []).map((i) => ({
      id: i.id, name: i.name, expected: num(i.expected) || 0,
      variable: bool(i.variable), active: i.active === undefined ? true : bool(i.active),
      day: int(i.day), startsPeriod: bool(i.starts_period),
    })),
    fixedExpenses: (rows.fixed_expenses || []).map((f) => ({
      id: f.id, name: f.name, category: f.category, amount: num(f.amount),
      totalAmount: num(f.total_amount) !== null ? num(f.total_amount) : num(f.amount),
      dueDay: int(f.due_day), paymentMethod: f.payment_method, cardId: f.card_id,
      shares: sharesByExpense[f.id] || [],
    })),
    /*
     * Los cobros van sueltos y no dentro del gasto fijo: solo existen los que
     * YA se cobraron. Lo pendiente se deduce del reparto, así no hay que
     * generar cinco filas cada mes ni salir a limpiarlas si algo cambia.
     */
    collections: (rows.collections || []).map((c) => ({
      id: c.id, month: c.month, shareId: c.share_id, collectedAt: date(c.collected_at),
    })),
    bucketAdjustments: (rows.bucket_adjustments || []).map((a) => ({
      id: a.id, month: a.month, bucketId: a.bucket_id, amount: num(a.amount) || 0,
    })),
    debts: (rows.debts || []).map((d) => ({
      id: d.id, name: d.name, totalAmount: num(d.total_amount),
      interestRate: num(d.interest_rate) || 0, monthlyPayment: num(d.monthly_payment) || 0,
      dueDay: int(d.due_day), startDate: date(d.start_date),
      currency: d.currency === 'USD' ? 'USD' : 'COP', exchangeRate: num(d.exchange_rate),
      fixedPayment: num(d.fixed_payment) !== null ? num(d.fixed_payment) : num(d.monthly_payment) || 0,
      payoffMode: d.payoff_mode === 'reducir-cuota' ? 'reducir-cuota' : 'reducir-plazo',
      currentBalance: num(d.current_balance),
      payments: paymentsByDebt[d.id] || [],
    })),
    buckets: (rows.buckets || []).map((b) => ({
      id: b.id, name: b.name,
      kind: b.kind === 'colchon' ? 'colchon' : 'meta',
      liquid: b.liquid === undefined ? true : bool(b.liquid),
      monthlyAmount: num(b.monthly_amount) || 0,
      depositDay: int(b.deposit_day),
      movesCash: b.moves_cash === undefined ? true : bool(b.moves_cash),
      targetAmount: num(b.target_amount), targetDate: date(b.target_date),
      shares: sharesByBucket[b.id] || [],
      contributions: contributionsByBucket[b.id] || [],
    })),
    monthlyPlans: (rows.monthly_plans || []).map((p) => ({
      month: p.month,
      expectedIncome: num(p.expected_income) || 0,
      fixedExpenses: num(p.fixed_expenses) || 0,
      debtPayment: num(p.debt_payment) || 0,
      savings: num(p.savings) || 0,
      variableEstimate: num(p.variable_estimate) || 0,
      cushion: num(p.cushion) || 0,
      locked: bool(p.locked),
    })),
    customCategories: (rows.custom_categories || []).map((c) => ({
      id: c.id, type: c.type, label: c.label, iconKey: c.icon_key, color: c.color,
    })),
    categoryLabels: settings.category_labels || {},
    setupCompletedAt: settings.setup_completed_at || null,
    balanceAnchor: settings.balance_anchor_date
      ? { date: date(settings.balance_anchor_date), amount: num(settings.balance_anchor_amount) || 0 }
      : null,
  };
}

/*
 * Deja el estado en la forma canónica que produce rowsToState(). Sirve para
 * comparar un blob viejo de kv_store contra lo que quedó en las tablas, sin que
 * un campo ausente vs. null cuente como diferencia.
 */
export function normalizeState(state) {
  return rowsToState(stateToRows(state));
}
