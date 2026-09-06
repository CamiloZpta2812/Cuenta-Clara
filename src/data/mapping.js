/*
 * Traducción entre la forma que usa la app en memoria (camelCase, deudas con
 * sus abonos adentro) y las filas de Postgres (snake_case, tablas separadas).
 *
 * Todo aquí es una función pura a propósito: es el punto donde un error te
 * perdería datos al migrar, así que tiene que poder probarse sin base de datos.
 * Ver src/data/mapping.test.js.
 */

export const TABLES = [
  'user_settings',
  'custom_categories',
  'credit_cards',
  'fixed_expenses',
  'debts',
  'debt_payments',
  'savings_goals',
  'goal_contributions',
  'transactions',
];

/*
 * Orden de escritura: las tablas con llaves foráneas van después de aquellas a
 * las que apuntan. Para borrar hay que ir al revés.
 */
export const WRITE_ORDER = TABLES;

const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const int = (v) => (v === '' || v === null || v === undefined ? null : parseInt(v, 10));
const str = (v) => (v === null || v === undefined ? null : String(v));
const bool = (v) => !!v;
const date = (v) => (v ? String(v).slice(0, 10) : null);

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
    amount: num(f.amount),
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
  };
}

export function goalToRow(g) {
  return {
    id: g.id,
    name: g.name,
    target_amount: num(g.targetAmount),
    target_date: date(g.targetDate) || null,
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

export function settingsToRow(state) {
  return {
    category_labels: state.categoryLabels || {},
  };
}

/* Aplana las deudas y metas: los abonos y aportes viven en su propia tabla. */
export function stateToRows(state) {
  const debtPayments = [];
  (state.debts || []).forEach((d) => {
    (d.payments || []).forEach((p) => {
      debtPayments.push({ id: p.id, debt_id: d.id, amount: num(p.amount), date: date(p.date) });
    });
  });

  const goalContributions = [];
  (state.savingsGoals || []).forEach((g) => {
    (g.contributions || []).forEach((c) => {
      goalContributions.push({ id: c.id, goal_id: g.id, amount: num(c.amount), date: date(c.date) });
    });
  });

  return {
    user_settings: [settingsToRow(state)],
    custom_categories: (state.customCategories || []).map(customCategoryToRow),
    credit_cards: (state.creditCards || []).map(cardToRow),
    fixed_expenses: (state.fixedExpenses || []).map(fixedExpenseToRow),
    debts: (state.debts || []).map(debtToRow),
    debt_payments: debtPayments,
    savings_goals: (state.savingsGoals || []).map(goalToRow),
    goal_contributions: goalContributions,
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
  };
}

export function rowsToState(rows) {
  const settings = (rows.user_settings || [])[0] || {};
  const paymentsByDebt = {};
  (rows.debt_payments || []).forEach((p) => {
    (paymentsByDebt[p.debt_id] = paymentsByDebt[p.debt_id] || []).push({
      id: p.id, amount: num(p.amount), date: date(p.date),
    });
  });
  const contributionsByGoal = {};
  (rows.goal_contributions || []).forEach((c) => {
    (contributionsByGoal[c.goal_id] = contributionsByGoal[c.goal_id] || []).push({
      id: c.id, amount: num(c.amount), date: date(c.date),
    });
  });

  return {
    transactions: (rows.transactions || []).map(rowToTransaction),
    creditCards: (rows.credit_cards || []).map((c) => ({
      id: c.id, name: c.name, lastFour: c.last_four,
      currency: c.currency === 'USD' ? 'USD' : 'COP',
      cutDay: int(c.cut_day), paymentDay: int(c.payment_day),
    })),
    fixedExpenses: (rows.fixed_expenses || []).map((f) => ({
      id: f.id, name: f.name, category: f.category, amount: num(f.amount),
      dueDay: int(f.due_day), paymentMethod: f.payment_method, cardId: f.card_id,
    })),
    debts: (rows.debts || []).map((d) => ({
      id: d.id, name: d.name, totalAmount: num(d.total_amount),
      interestRate: num(d.interest_rate) || 0, monthlyPayment: num(d.monthly_payment) || 0,
      dueDay: int(d.due_day), startDate: date(d.start_date),
      currency: d.currency === 'USD' ? 'USD' : 'COP', exchangeRate: num(d.exchange_rate),
      payments: paymentsByDebt[d.id] || [],
    })),
    savingsGoals: (rows.savings_goals || []).map((g) => ({
      id: g.id, name: g.name, targetAmount: num(g.target_amount),
      targetDate: date(g.target_date) || '',
      contributions: contributionsByGoal[g.id] || [],
    })),
    customCategories: (rows.custom_categories || []).map((c) => ({
      id: c.id, type: c.type, label: c.label, iconKey: c.icon_key, color: c.color,
    })),
    categoryLabels: settings.category_labels || {},
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
