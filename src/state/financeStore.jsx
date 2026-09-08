import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { COLOR_CHOICES } from '../lib/constants.js';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, ALL_CATEGORIES, ICON_CHOICES, getCategory } from '../lib/categories.js';
import { todayStr, daysInMonth, monthKeyFromDate, currentMonthKey, monthLabel, computeChargeDate, addMonths } from '../lib/dates.js';
import { supabase } from '../supabaseClient.js';
import { getLastMonthKeys } from '../lib/dates.js';
import { fetchAllRows, migrateLegacyBlobIfNeeded, applyDiff, currentUserIdSafe } from '../data/api.js';
import { rowsToState, stateToRows } from '../data/mapping.js';
import { diffState, isEmptyDiff, replayLocalChanges } from '../data/sync.js';
import { readCache, writeCache } from '../data/localCache.js';
import { userConfig } from '../lib/userConfig.js';
import { uid } from '../lib/id.js';
import { buildRecommendations, getStatus } from '../lib/insights.js';
import { buildCardStatements, nextStatement, buildCommitments, activeInstallmentGroups } from '../lib/projections.js';
import { monthSummary, targetDebt, simulatePlanChange } from '../lib/month.js';
import { comparePlans, monthlyRateOf } from '../lib/amortization.js';

/*
 * Todo el estado de la app vive aquí: lo que se persiste en Supabase, lo que se
 * deriva de eso y las acciones que lo modifican. Las vistas lo consumen con
 * useFinance() en vez de recibir treinta props cada una.
 */
/*
 * Se exporta para el banco de pruebas de src/preview, que monta las pantallas
 * con datos de mentira y sin Supabase. Sirve para verlas sin tener que entrar
 * con una cuenta real, que es lo único que no se puede automatizar aquí.
 */
export const FinanceContext = createContext(null);

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error('useFinance() se usó fuera de <FinanceProvider>');
  return ctx;
}

export function FinanceProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(false);
  const [exporting, setExporting] = useState('');   // '' | 'trabajando' | mensaje de error
  /* Arranca en El mes: es la pregunta que la app existe para responder. */
  const [activeTab, setActiveTab] = useState('mes');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ''));
  }, []);

  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [categoryLabels, setCategoryLabelsState] = useState({});
  const [customCategories, setCustomCategoriesState] = useState([]);

  /*
   * Esquema v2: plan mensual, gastos compartidos y buckets. Las pantallas que
   * los editan todavía no existen, pero el estado tiene que cargarlos igual —
   * si no, el primer guardado los vería ausentes y los borraría de Supabase.
   */
  const [people, setPeople] = useState([]);
  const [incomeSources, setIncomeSources] = useState([]);
  const [collections, setCollections] = useState([]);
  const [buckets, setBuckets] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [setupCompletedAt, setSetupCompletedAt] = useState(null);

  /*
   * Estos setters dejan userConfig sincronizado ANTES de pedir el re-render,
   * desde el manejador de evento y no desde el cuerpo del componente.
   * Reciben siempre el valor final (no un updater), a propósito.
   */
  function setCategoryLabels(next) { userConfig.categoryLabels = next; setCategoryLabelsState(next); }
  function setCustomCategories(next) { userConfig.customCategories = next; setCustomCategoriesState(next); }

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  const [showTxForm, setShowTxForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [txForm, setTxForm] = useState({ type: 'gasto', amount: '', category: 'alimentacion', date: todayStr(), note: '', paymentMethod: 'efectivo', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
  const [txFilters, setTxFilters] = useState({ type: 'todos', month: 'todos', category: 'todas', paymentMethod: 'todos', fixed: 'todos', day: '' });
  const [txFormError, setTxFormError] = useState('');

  const [usdRate, setUsdRate] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('https://open.er-api.com/v6/latest/USD')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data && data.rates && data.rates.COP) setUsdRate(Math.round(data.rates.COP));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState(null);
  const [cardForm, setCardForm] = useState({ name: '', lastFour: '', currency: 'COP', cutDay: '', paymentDay: '' });

  const [showFixedForm, setShowFixedForm] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState(null);
  const [fixedForm, setFixedForm] = useState({ name: '', category: 'servicios', amount: '', dueDay: '', paymentMethod: 'efectivo', cardId: '' });

  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtForm, setDebtForm] = useState({ name: '', totalAmount: '', interestRate: '', monthlyPayment: '', dueDay: '', startDate: todayStr(), currency: 'COP', exchangeRate: '' });
  const [debtFormError, setDebtFormError] = useState('');
  const [paymentInputs, setPaymentInputs] = useState({});

  const [balanceInputs, setBalanceInputs] = useState({});
  const [bucketInputs, setBucketInputs] = useState({});
  const [showBucketForm, setShowBucketForm] = useState(false);
  const [editingBucketId, setEditingBucketId] = useState(null);
  const [bucketForm, setBucketForm] = useState({
    name: '', kind: 'meta', liquid: true, monthlyAmount: '', targetAmount: '', targetDate: '',
  });

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', targetDate: '', initialAmount: '' });
  const [contributionInputs, setContributionInputs] = useState({});

  const [pinForm, setPinForm] = useState({ newPin: '', confirmPin: '' });
  const [pinMessage, setPinMessage] = useState(null); // { kind: 'success' | 'error', text }
  const [configTab, setConfigTab] = useState('categorias');
  const [newCatGasto, setNewCatGasto] = useState({ label: '', iconKey: ICON_CHOICES[0].key, color: COLOR_CHOICES[0] });
  const [newCatIngreso, setNewCatIngreso] = useState({ label: '', iconKey: ICON_CHOICES[0].key, color: COLOR_CHOICES[0] });

  /*
   * La foto completa del estado, en un solo lugar. Antes esta lista estaba
   * escrita tres veces —guardado, reintento y export— y agregar una tabla
   * significaba acordarse de las tres: la que se olvidara se guardaría vacía y
   * borraría esos datos en el servidor.
   */
  const snapshot = useCallback(() => ({
    transactions, debts, savingsGoals, creditCards, fixedExpenses,
    customCategories, categoryLabels,
    people, incomeSources, collections, buckets, monthlyPlans, setupCompletedAt,
  }), [transactions, debts, savingsGoals, creditCards, fixedExpenses,
       customCategories, categoryLabels,
       people, incomeSources, collections, buckets, monthlyPlans, setupCompletedAt]);

  /*
   * persistedRef guarda la última foto que sabemos que está en la base. El
   * guardado compara contra ella, así que si una escritura falla el cambio
   * queda pendiente y se reintenta junto con el siguiente, sin perderse.
   */
  const persistedRef = useRef(null);
  const saveTimer = useRef(null);
  const userIdRef = useRef(null);
  const retryRef = useRef(null);

  /* ---------- Carga inicial ---------- */
  useEffect(() => {
    (async () => {
      const userId = await currentUserIdSafe();
      userIdRef.current = userId;
      const cache = readCache(userId);

      function aplicar(state) {
        setTransactions(state.transactions || []);
        setDebts((state.debts || []).map((d) => ({ ...d, payments: d.payments || [] })));
        setSavingsGoals((state.savingsGoals || []).map((g) => ({ ...g, contributions: g.contributions || [] })));
        setCreditCards(state.creditCards || []);
        setFixedExpenses(state.fixedExpenses || []);
        setCategoryLabels(state.categoryLabels || {});
        setCustomCategories(state.customCategories || []);
        setPeople(state.people || []);
        setIncomeSources(state.incomeSources || []);
        setCollections(state.collections || []);
        setBuckets((state.buckets || []).map((b) => ({ ...b, contributions: b.contributions || [] })));
        setMonthlyPlans(state.monthlyPlans || []);
        setSetupCompletedAt(state.setupCompletedAt || null);
        setSelectedMonth(monthKeyFromDate(todayStr()));
      }

      try {
        const rows = await fetchAllRows();
        // La primera vez con el esquema nuevo, se trae lo que hubiera en el
        // JSON viejo de kv_store. kv_store no se borra: queda de respaldo.
        const migrated = await migrateLegacyBlobIfNeeded(rows);
        const serverState = migrated || rowsToState(rows);

        // ¿Quedaron cambios sin subir de la última vez que estuvimos sin señal?
        const pendiente = cache ? diffState(cache.persisted, cache.state) : null;
        if (pendiente && !isEmptyDiff(pendiente)) {
          const merged = rowsToState(replayLocalChanges(stateToRows(serverState), pendiente));
          aplicar(merged);
          persistedRef.current = serverState;   // lo pendiente se sube solo
          setPendingChanges(true);
        } else {
          aplicar(serverState);
          persistedRef.current = serverState;
          writeCache(userId, serverState, serverState);
        }
        setLoadError('');
        setOffline(false);
      } catch (err) {
        if (cache) {
          // Sin conexión pero con copia local: la app abre y se puede seguir
          // registrando. Lo pendiente se sube cuando vuelva la señal.
          aplicar(cache.state);
          persistedRef.current = cache.persisted;
          setOffline(true);
          setLoadError('');
        } else {
          // Ni servidor ni copia local: se arranca vacío pero SIN escribir,
          // porque sobreescribir sin saber qué había sería peor.
          setLoadError(err.message || 'No pudimos cargar tus datos.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- Guardado automático ---------- */
  useEffect(() => {
    if (loading || loadError) return undefined;
    const next = snapshot();
    const prev = persistedRef.current;
    if (!prev) { persistedRef.current = next; return undefined; }

    const diff = diffState(prev, next);
    if (isEmptyDiff(diff)) return undefined;

    // La copia local se actualiza de una: si el navegador se cierra antes de
    // que suba el cambio, al volver a abrir sigue ahí.
    writeCache(userIdRef.current, next, prev);
    setPendingChanges(true);

    // Al servidor se manda solo lo que cambió, y con un respiro para no soltar
    // una petición por cada tecla al editar un campo.
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await applyDiff(diff);
        persistedRef.current = next;
        writeCache(userIdRef.current, next, next);
        setSaveError(false);
        setOffline(false);
        setPendingChanges(false);
      } catch (err) {
        // persistedRef no avanza: el cambio queda pendiente y se reintenta
        // junto con el siguiente, o cuando vuelva la conexión.
        if (typeof navigator !== 'undefined' && !navigator.onLine) setOffline(true);
        else setSaveError(true);
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
    // snapshot cambia cuando cambia cualquier parte del estado, así que agregar
    // una tabla nueva arriba no obliga a acordarse de esta lista.
  }, [snapshot, loading, loadError]);

  /* ---------- Conexión ---------- */
  /*
   * Al volver la señal se reintenta lo pendiente. retryRef guarda la función
   * más reciente para que el listener no se quede con un cierre viejo.
   */
  async function reintentarPendientes() {
    const prev = persistedRef.current;
    if (!prev) return;
    const next = snapshot();
    const diff = diffState(prev, next);
    if (isEmptyDiff(diff)) { setOffline(false); setPendingChanges(false); return; }
    try {
      await applyDiff(diff);
      persistedRef.current = next;
      writeCache(userIdRef.current, next, next);
      setOffline(false);
      setSaveError(false);
      setPendingChanges(false);
    } catch {
      setOffline(true);
    }
  }

  // Patrón de "ref al último valor": el listener se registra una sola vez, pero
  // siempre llama a la versión recién renderizada, sin mutar nada en el render.
  useEffect(() => { retryRef.current = reintentarPendientes; });

  useEffect(() => {
    const alVolver = () => { if (retryRef.current) retryRef.current(); };
    const alCaerse = () => setOffline(true);
    window.addEventListener('online', alVolver);
    window.addEventListener('offline', alCaerse);
    return () => {
      window.removeEventListener('online', alVolver);
      window.removeEventListener('offline', alCaerse);
    };
  }, []);

  /* ---------- Datos derivados ---------- */
  const monthsWindow = useMemo(() => getLastMonthKeys(6, currentMonthKey()), []);

  // Los 6 meses que VIENEN, para ver lo que ya está comprometido.
  const futureMonths = useMemo(
    () => Array.from({ length: 6 }, (_, i) => addMonths(currentMonthKey(), i + 1)),
    [],
  );
  const commitments = useMemo(
    () => buildCommitments(transactions, fixedExpenses, futureMonths),
    [transactions, fixedExpenses, futureMonths],
  );

  // Factura por tarjeta: qué se cobra y cuándo, en vez de restar del saldo el
  // día de la compra.
  const cardStatements = useMemo(() => {
    const out = {};
    creditCards.forEach((card) => {
      const facturas = buildCardStatements(transactions, card);
      out[card.id] = { all: facturas, next: nextStatement(facturas, todayStr()) };
    });
    return out;
  }, [transactions, creditCards]);

  const availableMonths = useMemo(() => {
    const set = new Set([currentMonthKey(), ...transactions.map((t) => monthKeyFromDate(t.date))]);
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const totalIncome = useMemo(() => transactions.filter((t) => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0), [transactions]);
  const totalExpense = useMemo(() => transactions.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0), [transactions]);
  const cashBalance = totalIncome - totalExpense;
  const totalSavings = useMemo(() => savingsGoals.reduce((s, g) => s + g.contributions.reduce((a, c) => a + c.amount, 0), 0), [savingsGoals]);
  function debtRemainingCOP(d) {
    const paid = d.payments.reduce((a, p) => a + p.amount, 0);
    const remaining = Math.max(0, parseFloat(d.totalAmount) - paid);
    return d.currency === 'USD' ? remaining * (d.exchangeRate || 0) : remaining;
  }
  const totalDebtRemaining = useMemo(() => debts.reduce((s, d) => s + debtRemainingCOP(d), 0), [debts]);
  const totalCardSpendCOP = useMemo(
    () => transactions.filter((t) => t.type === 'gasto' && t.cardId).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const netWorth = cashBalance + totalSavings - totalDebtRemaining;

  const selMonthIncome = useMemo(() => transactions.filter((t) => t.type === 'ingreso' && monthKeyFromDate(t.date) === selectedMonth).reduce((s, t) => s + t.amount, 0), [transactions, selectedMonth]);
  const selMonthExpense = useMemo(() => transactions.filter((t) => t.type === 'gasto' && monthKeyFromDate(t.date) === selectedMonth).reduce((s, t) => s + t.amount, 0), [transactions, selectedMonth]);
  const selMonthFixed = useMemo(() => transactions.filter((t) => t.type === 'gasto' && t.isFixed && monthKeyFromDate(t.date) === selectedMonth).reduce((s, t) => s + t.amount, 0), [transactions, selectedMonth]);
  const selMonthVariable = Math.max(0, selMonthExpense - selMonthFixed);
  function cardLabel(cardId) {
    const c = creditCards.find((card) => card.id === cardId);
    return c ? `${c.name} *${c.lastFour}` : 'tarjeta eliminada';
  }

  const monthlyIncomeExpense = useMemo(() => monthsWindow.map((key) => {
    const txs = transactions.filter((t) => monthKeyFromDate(t.date) === key);
    return {
      label: monthLabel(key),
      Ingresos: txs.filter((t) => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0),
      Gastos: txs.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0),
    };
  }), [transactions, monthsWindow]);

  const pieData = useMemo(() => {
    const map = {};
    transactions.filter((t) => t.type === 'gasto' && monthKeyFromDate(t.date) === selectedMonth).forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([id, value]) => {
      const c = getCategory(id);
      return { name: c.label, value, color: c.color };
    }).sort((a, b) => b.value - a.value);
    // categoryLabels y customCategories sí hacen falta: getCategory() los lee
    // a través de userConfig, cosa que ESLint no puede ver desde aquí.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, selectedMonth, categoryLabels, customCategories]);

  const equityEvolution = useMemo(() => monthsWindow.map((key) => {
    const ahorro = savingsGoals.reduce((sum, g) => sum + g.contributions.filter((c) => monthKeyFromDate(c.date) <= key).reduce((s, c) => s + c.amount, 0), 0);
    const deuda = debts.reduce((sum, d) => {
      if (monthKeyFromDate(d.startDate) > key) return sum;
      const paid = d.payments.filter((p) => monthKeyFromDate(p.date) <= key).reduce((s, p) => s + p.amount, 0);
      const remaining = Math.max(0, parseFloat(d.totalAmount) - paid);
      // Igual que debtRemainingCOP: una deuda en USD tiene que convertirse,
      // si no la línea del gráfico y la tarjeta "Deuda pendiente" no cuadran.
      return sum + (d.currency === 'USD' ? remaining * (d.exchangeRate || 0) : remaining);
    }, 0);
    return { label: monthLabel(key), Ahorro: Math.max(0, ahorro), Deuda: deuda };
  }), [monthsWindow, savingsGoals, debts]);

  const filteredTx = useMemo(() => transactions
    .filter((t) => txFilters.type === 'todos' || t.type === txFilters.type)
    .filter((t) => txFilters.month === 'todos' || monthKeyFromDate(t.date) === txFilters.month)
    .filter((t) => txFilters.category === 'todas' || t.category === txFilters.category)
    .filter((t) => txFilters.paymentMethod === 'todos' || t.paymentMethod === txFilters.paymentMethod)
    .filter((t) => txFilters.fixed === 'todos' || (txFilters.fixed === 'fijo' ? t.isFixed : !t.isFixed))
    .filter((t) => !txFilters.day || t.date === txFilters.day)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [transactions, txFilters]);

  // Igual que arriba: buildRecommendations() etiqueta categorías por dentro.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recommendations = useMemo(() => buildRecommendations(transactions, debts, savingsGoals), [transactions, debts, savingsGoals, categoryLabels, customCategories]);
  const status = getStatus(selMonthIncome, selMonthExpense);
  const allExpenseCategories = [...EXPENSE_CATEGORIES, ...customCategories.filter((c) => c.type === 'gasto')];
  const allIncomeCategories = [...INCOME_CATEGORIES, ...customCategories.filter((c) => c.type === 'ingreso')];
  const txFilterCategories = (txFilters.type === 'ingreso' ? allIncomeCategories : txFilters.type === 'gasto' ? allExpenseCategories : [...allExpenseCategories, ...allIncomeCategories]).map((c) => getCategory(c.id));
  const txFormCategories = (txForm.type === 'gasto' ? allExpenseCategories : allIncomeCategories).map((c) => getCategory(c.id));

  const txSelectedCard = txForm.cardId ? creditCards.find((c) => c.id === txForm.cardId) : null;
  const txIsUSD = txForm.paymentMethod === 'credito' && txSelectedCard?.currency === 'USD';
  const txEffectiveRate = txForm.exchangeRate !== '' ? parseFloat(txForm.exchangeRate) : (usdRate || 0);
  const txChargeDate = txForm.paymentMethod === 'credito' && txSelectedCard?.cutDay && txSelectedCard?.paymentDay
    ? computeChargeDate(txForm.date, txSelectedCard.cutDay, txSelectedCard.paymentDay)
    : null;

  /* ---------- Acciones ---------- */
  function handleAddTransaction(e) {
    e.preventDefault();
    setTxFormError('');
    const enteredAmount = parseFloat(txForm.amount);
    if (!enteredAmount || enteredAmount <= 0) {
      setTxFormError('Escribe un monto mayor a cero.');
      return;
    }
    const isGasto = txForm.type === 'gasto';
    const isCredito = isGasto && txForm.paymentMethod === 'credito';
    const isCreditoConCuotas = isCredito && txForm.isInstallment;
    const isUSD = isCredito && txSelectedCard?.currency === 'USD';
    const rate = isUSD ? (txForm.exchangeRate !== '' ? parseFloat(txForm.exchangeRate) : (usdRate || 0)) : 1;
    if (isUSD && !rate) {
      setTxFormError('No pudimos traer la tasa de cambio automáticamente. Escribe la tasa (COP por USD) para guardar este gasto.');
      return;
    }
    const totalCOP = enteredAmount * rate;
    const totalInstallmentsNum = isCreditoConCuotas && txForm.totalInstallments ? parseInt(txForm.totalInstallments, 10) : null;
    const monthlyCOP = isCreditoConCuotas && totalInstallmentsNum ? totalCOP / totalInstallmentsNum : totalCOP;
    const built = {
      type: txForm.type,
      amount: monthlyCOP,
      category: txForm.category,
      date: txForm.date || todayStr(),
      note: txForm.note.trim(),
      paymentMethod: isGasto ? txForm.paymentMethod : null,
      cardId: isCredito ? (txForm.cardId || null) : null,
      isFixed: isGasto ? !!txForm.isFixed : false,
      isInstallment: isCreditoConCuotas,
      totalInstallments: totalInstallmentsNum,
      currentInstallment: isCreditoConCuotas && txForm.currentInstallment ? parseInt(txForm.currentInstallment, 10) : null,
      interestRate: isCreditoConCuotas && txForm.interestRate !== '' ? parseFloat(txForm.interestRate) : null,
      totalAmount: isCreditoConCuotas ? totalCOP : null,
      installmentGroupId: isCreditoConCuotas ? (editingTxId ? (transactions.find((t) => t.id === editingTxId)?.installmentGroupId || uid()) : uid()) : null,
      currency: isUSD ? 'USD' : 'COP',
      originalAmount: isUSD ? enteredAmount : null,
      exchangeRateUsed: isUSD ? rate : null,
    };
    if (editingTxId) {
      setTransactions((prev) => prev.map((t) => (t.id === editingTxId ? { ...t, ...built } : t)));
      setEditingTxId(null);
    } else {
      setTransactions((prev) => [...prev, { id: uid(), ...built }]);
    }
    setTxForm({ type: txForm.type, amount: '', category: txForm.type === 'gasto' ? EXPENSE_CATEGORIES[0].id : INCOME_CATEGORIES[0].id, date: todayStr(), note: '', paymentMethod: 'efectivo', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
    setShowTxForm(false);
  }
  function handleEditTransaction(t) {
    const amountForForm = t.currency === 'USD'
      ? String(t.originalAmount)
      : (t.isInstallment && t.totalAmount != null ? String(t.totalAmount) : String(t.amount));
    setTxForm({
      type: t.type,
      amount: amountForForm,
      category: t.category,
      date: t.date,
      note: t.note || '',
      paymentMethod: t.paymentMethod || 'efectivo',
      cardId: t.cardId || '',
      isFixed: !!t.isFixed,
      isInstallment: !!t.isInstallment,
      totalInstallments: t.totalInstallments != null ? String(t.totalInstallments) : '',
      currentInstallment: t.currentInstallment != null ? String(t.currentInstallment) : '1',
      interestRate: t.interestRate != null ? String(t.interestRate) : '',
      exchangeRate: t.exchangeRateUsed != null ? String(t.exchangeRateUsed) : '',
    });
    setEditingTxId(t.id);
    setShowTxForm(true);
  }
  function handleCancelTxForm() {
    setEditingTxId(null);
    setShowTxForm(false);
    setTxFormError('');
    setTxForm({ type: 'gasto', amount: '', category: EXPENSE_CATEGORIES[0].id, date: todayStr(), note: '', paymentMethod: 'efectivo', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
  }
  function handleDeleteTransaction(id) {
    const tx = transactions.find((t) => t.id === id);
    // Un abono a deuda genera dos registros (el movimiento y el pago dentro de
    // la deuda). Si se borra solo uno, la deuda queda mal contabilizada.
    const linkedDebt = tx && tx.debtPaymentId ? debts.find((d) => d.id === tx.debtId) : null;
    if (linkedDebt) {
      if (!window.confirm(`Este movimiento es un abono a "${linkedDebt.name}". Al borrarlo también se deshace el abono en la deuda. ¿Continuar?`)) return;
      setDebts((prev) => prev.map((d) => (d.id === linkedDebt.id
        ? { ...d, payments: d.payments.filter((pay) => pay.id !== tx.debtPaymentId) }
        : d)));
    }
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }
  function getInstallmentGroup(groupId) {
    return transactions
      .filter((t) => t.installmentGroupId === groupId)
      .sort((a, b) => (a.currentInstallment || 0) - (b.currentInstallment || 0));
  }
  function handleRegisterNextInstallment(groupId) {
    const group = getInstallmentGroup(groupId);
    if (group.length === 0) return;
    const last = group[group.length - 1];
    const next = (last.currentInstallment || 0) + 1;
    if (last.totalInstallments && next > last.totalInstallments) return;
    const key = monthKeyFromDate(todayStr());
    if (group.some((t) => monthKeyFromDate(t.date) === key)) return; // ya hay una cuota registrada este mes
    setTransactions((prev) => [...prev, {
      id: uid(),
      type: 'gasto',
      amount: last.amount,
      category: last.category,
      date: todayStr(),
      note: last.note,
      paymentMethod: last.paymentMethod,
      cardId: last.cardId,
      isFixed: false,
      isInstallment: true,
      totalInstallments: last.totalInstallments,
      currentInstallment: next,
      interestRate: last.interestRate,
      totalAmount: last.totalAmount,
      installmentGroupId: groupId,
      currency: last.currency,
      originalAmount: last.originalAmount,
      exchangeRateUsed: last.exchangeRateUsed,
    }]);
  }

  function handleOpenNewMovement() {
    setActiveTab('movimientos');
    setEditingTxId(null);
    setTxFormError('');
    setShowTxForm(true);
  }

  function handleAddDebt(e) {
    e.preventDefault();
    setDebtFormError('');
    const total = parseFloat(debtForm.totalAmount);
    if (!debtForm.name.trim() || !total || total <= 0) {
      setDebtFormError('Ponle un nombre a la deuda y un monto mayor a cero.');
      return;
    }
    const isUSD = debtForm.currency === 'USD';
    const rate = isUSD ? (debtForm.exchangeRate !== '' ? parseFloat(debtForm.exchangeRate) : (usdRate || 0)) : 1;
    if (isUSD && !rate) {
      setDebtFormError('No pudimos traer la tasa de cambio automáticamente. Escribe la tasa (COP por USD) para guardar esta deuda.');
      return;
    }
    setDebts((prev) => [...prev, {
      id: uid(),
      name: debtForm.name.trim(),
      totalAmount: total,
      interestRate: debtForm.interestRate ? parseFloat(debtForm.interestRate) : 0,
      monthlyPayment: debtForm.monthlyPayment ? parseFloat(debtForm.monthlyPayment) : 0,
      dueDay: debtForm.dueDay ? parseInt(debtForm.dueDay, 10) : null,
      startDate: debtForm.startDate || todayStr(),
      currency: isUSD ? 'USD' : 'COP',
      exchangeRate: isUSD ? rate : null,
      payments: [],
    }]);
    setDebtForm({ name: '', totalAmount: '', interestRate: '', monthlyPayment: '', dueDay: '', startDate: todayStr(), currency: 'COP', exchangeRate: '' });
    setShowDebtForm(false);
  }
  function handleDeleteDebt(id) {
    const debt = debts.find((d) => d.id === id);
    if (!window.confirm(`¿Eliminar la deuda "${debt ? debt.name : ''}" y su historial de abonos? Los movimientos que ya generó no se borran.`)) return;
    setDebts((prev) => prev.filter((d) => d.id !== id));
  }
  /*
   * Registrar un abono a la deuda.
   *
   * Además de guardar el abono, baja el saldo. Si no lo bajara, la proyección
   * seguiría arrancando desde el saldo del primer día para siempre: la deuda
   * se vería igual de larga en enero que en diciembre, hubieras pagado lo que
   * hubieras pagado.
   */
  function handleAddPayment(debtId) {
    const amt = parseFloat(paymentInputs[debtId]);
    if (!amt || amt <= 0) return;
    const debt = debts.find((d) => d.id === debtId);
    const paymentId = uid();
    const hoy = todayStr();

    const reportado = parseFloat(balanceInputs[debtId]);
    const hayReportado = Number.isFinite(reportado) && reportado >= 0;

    /*
     * El saldo que queda. Si el banco te lo dice, manda ese: es la verdad, y
     * poder cuadrar el modelo contra el extracto es justamente el punto.
     * Si no, se modela igual que el crédito: saldo + intereses del mes − pago.
     */
    const previo = debt && debt.currentBalance != null ? Number(debt.currentBalance) : null;
    let saldoNuevo = null;
    if (hayReportado) saldoNuevo = reportado;
    else if (previo != null) {
      saldoNuevo = Math.max(0, previo + (previo * monthlyRateOf(debt)) - amt);
    }

    setDebts((prev) => prev.map((d) => (d.id === debtId ? {
      ...d,
      currentBalance: saldoNuevo != null ? saldoNuevo : d.currentBalance,
      payments: [...d.payments, {
        id: paymentId, amount: amt, date: hoy, month: monthKeyFromDate(hoy),
        balanceAfter: hayReportado ? reportado : null,
      }],
    } : d)));

    // debtId/debtPaymentId enlazan el movimiento con el abono, para poder
    // deshacer los dos juntos desde Movimientos.
    setTransactions((prev) => [...prev, { id: uid(), type: 'gasto', category: 'deudas', amount: amt, date: hoy, note: debt ? `Abono a ${debt.name}` : 'Abono a deuda', paymentMethod: 'debito', cardId: null, isFixed: false, debtId, debtPaymentId: paymentId }]);
    setPaymentInputs((prev) => ({ ...prev, [debtId]: '' }));
    setBalanceInputs((prev) => ({ ...prev, [debtId]: '' }));
  }

  function handleAddGoal(e) {
    e.preventDefault();
    if (!goalForm.name.trim()) return;
    const target = goalForm.targetAmount !== '' ? parseFloat(goalForm.targetAmount) : null;
    if (target != null && (!target || target <= 0)) return;
    const initial = goalForm.initialAmount !== '' ? parseFloat(goalForm.initialAmount) : 0;
    const contributions = initial > 0 ? [{ id: uid(), amount: initial, date: todayStr() }] : [];
    setSavingsGoals((prev) => [...prev, { id: uid(), name: goalForm.name.trim(), targetAmount: target, targetDate: target ? (goalForm.targetDate || '') : '', contributions }]);
    setGoalForm({ name: '', targetAmount: '', targetDate: '', initialAmount: '' });
    setShowGoalForm(false);
  }
  function handleDeleteGoal(id) {
    const goal = savingsGoals.find((g) => g.id === id);
    if (!window.confirm(`¿Eliminar la meta "${goal ? goal.name : ''}" y todos sus aportes?`)) return;
    setSavingsGoals((prev) => prev.filter((g) => g.id !== id));
  }
  function handleContribution(goalId, sign) {
    const amt = parseFloat(contributionInputs[goalId]);
    if (!amt || amt <= 0) return;
    setSavingsGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, contributions: [...g.contributions, { id: uid(), amount: amt * sign, date: todayStr() }] } : g)));
    setContributionInputs((prev) => ({ ...prev, [goalId]: '' }));
  }

  function handleAddCard(e) {
    e.preventDefault();
    if (!cardForm.name.trim() || cardForm.lastFour.length !== 4) return;
    const cardData = {
      name: cardForm.name.trim(),
      lastFour: cardForm.lastFour,
      currency: cardForm.currency === 'USD' ? 'USD' : 'COP',
      cutDay: cardForm.cutDay ? parseInt(cardForm.cutDay, 10) : null,
      paymentDay: cardForm.paymentDay ? parseInt(cardForm.paymentDay, 10) : null,
    };
    if (editingCardId) {
      setCreditCards((prev) => prev.map((c) => (c.id === editingCardId ? { ...c, ...cardData } : c)));
      setEditingCardId(null);
    } else {
      setCreditCards((prev) => [...prev, { id: uid(), ...cardData }]);
    }
    setCardForm({ name: '', lastFour: '', currency: 'COP', cutDay: '', paymentDay: '' });
    setShowCardForm(false);
  }
  function handleEditCard(card) {
    setCardForm({
      name: card.name,
      lastFour: card.lastFour,
      currency: card.currency || 'COP',
      cutDay: card.cutDay != null ? String(card.cutDay) : '',
      paymentDay: card.paymentDay != null ? String(card.paymentDay) : '',
    });
    setEditingCardId(card.id);
    setShowCardForm(true);
  }
  function handleCancelCardForm() {
    setEditingCardId(null);
    setShowCardForm(false);
    setCardForm({ name: '', lastFour: '', currency: 'COP', cutDay: '', paymentDay: '' });
  }
  function handleDeleteCard(id) {
    const card = creditCards.find((c) => c.id === id);
    if (!window.confirm(`¿Eliminar la tarjeta "${card ? card.name : ''}"? Sus movimientos se quedan registrados, pero ya no aparecerán agrupados aquí.`)) return;
    setCreditCards((prev) => prev.filter((c) => c.id !== id));
  }

  function handleAddFixedExpense(e) {
    e.preventDefault();
    const amt = parseFloat(fixedForm.amount);
    if (!fixedForm.name.trim() || !amt || amt <= 0) return;
    const data = {
      name: fixedForm.name.trim(),
      category: fixedForm.category,
      amount: amt,
      dueDay: fixedForm.dueDay ? parseInt(fixedForm.dueDay, 10) : null,
      paymentMethod: fixedForm.paymentMethod,
      cardId: fixedForm.paymentMethod === 'credito' ? (fixedForm.cardId || null) : null,
    };
    if (editingFixedId) {
      setFixedExpenses((prev) => prev.map((f) => (f.id === editingFixedId ? { ...f, ...data } : f)));
      setEditingFixedId(null);
    } else {
      setFixedExpenses((prev) => [...prev, { id: uid(), ...data }]);
    }
    setFixedForm({ name: '', category: EXPENSE_CATEGORIES[0].id, amount: '', dueDay: '', paymentMethod: 'efectivo', cardId: '' });
    setShowFixedForm(false);
  }
  function handleEditFixedExpense(fe) {
    setFixedForm({
      name: fe.name,
      category: fe.category,
      amount: String(fe.amount),
      dueDay: fe.dueDay != null ? String(fe.dueDay) : '',
      paymentMethod: fe.paymentMethod || 'efectivo',
      cardId: fe.cardId || '',
    });
    setEditingFixedId(fe.id);
    setShowFixedForm(true);
  }
  function handleCancelFixedForm() {
    setEditingFixedId(null);
    setShowFixedForm(false);
    setFixedForm({ name: '', category: EXPENSE_CATEGORIES[0].id, amount: '', dueDay: '', paymentMethod: 'efectivo', cardId: '' });
  }
  function handleDeleteFixedExpense(id) {
    if (!window.confirm('¿Eliminar este gasto fijo? Los movimientos que ya generó no se borran.')) return;
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  }
  function findFixedExpensePaidThisMonth(feId) {
    const key = monthKeyFromDate(todayStr());
    return transactions.find((t) => t.fixedExpenseId === feId && monthKeyFromDate(t.date) === key);
  }
  function handleMarkFixedExpensePaid(fe) {
    let date = todayStr();
    if (fe.dueDay) {
      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth();
      const day = Math.min(fe.dueDay, daysInMonth(y, m));
      date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    setTransactions((prev) => [...prev, {
      id: uid(),
      type: 'gasto',
      category: fe.category,
      amount: fe.amount,
      date,
      note: fe.name,
      paymentMethod: fe.paymentMethod,
      cardId: fe.cardId || null,
      isFixed: true,
      fixedExpenseId: fe.id,
    }]);
  }
  function handleUndoFixedExpensePaid(fe) {
    const tx = findFixedExpensePaidThisMonth(fe.id);
    if (!tx) return;
    setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
  }

  function handleUpdateCategoryLabel(id, rawLabel) {
    const original = ALL_CATEGORIES.find((c) => c.id === id) || customCategories.find((c) => c.id === id);
    if (!original) return;
    const trimmed = rawLabel.trim();
    const next = { ...categoryLabels };
    if (!trimmed || trimmed === original.label) {
      delete next[id];
    } else {
      next[id] = trimmed;
    }
    setCategoryLabels(next);
  }

  function handleAddCustomCategory(type) {
    const form = type === 'gasto' ? newCatGasto : newCatIngreso;
    if (!form.label.trim()) return;
    const newCat = { id: `custom-${uid()}`, type, label: form.label.trim(), iconKey: form.iconKey, color: form.color };
    setCustomCategories([...customCategories, newCat]);
    const reset = { label: '', iconKey: ICON_CHOICES[0].key, color: COLOR_CHOICES[0] };
    if (type === 'gasto') setNewCatGasto(reset); else setNewCatIngreso(reset);
  }
  function handleDeleteCustomCategory(id) {
    if (!window.confirm('¿Eliminar esta categoría? Los movimientos que ya la usan se mostrarán como "Otros".')) return;
    setCustomCategories(customCategories.filter((c) => c.id !== id));
  }

  async function handleSetPin(e) {
    e.preventDefault();
    setPinMessage(null);
    if (pinForm.newPin.length < 6) {
      setPinMessage({ kind: 'error', text: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinMessage({ kind: 'error', text: 'Las dos contraseñas no coinciden.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pinForm.newPin });
    if (error) {
      setPinMessage({ kind: 'error', text: error.message });
    } else {
      setPinForm({ newPin: '', confirmPin: '' });
      setPinMessage({ kind: 'success', text: 'Listo, tu contraseña quedó actualizada.' });
    }
  }

  async function handleExportExcel() {
    setExporting('trabajando');
    try {
      // import() dinámico: ExcelJS solo se descarga cuando de verdad se usa.
      const { exportToExcel } = await import('../lib/exportExcel.js');
      await exportToExcel(snapshot());
      setExporting('');
    } catch (err) {
      setExporting(err.message || 'No se pudo generar el archivo.');
    }
  }

  function handleResetAll() {
    if (!window.confirm('¿Seguro que quieres borrar todos tus datos financieros? Esta acción no se puede deshacer.')) return;
    setTransactions([]);
    setDebts([]);
    setSavingsGoals([]);
    setCreditCards([]);
    setFixedExpenses([]);
    setCustomCategories([]);
    setCategoryLabels({});
  }

  /* ---------- Buckets: metas y colchones ---------- */

  const BUCKET_VACIO = {
    name: '', kind: 'meta', liquid: true, monthlyAmount: '', targetAmount: '', targetDate: '',
  };

  /*
   * Crear y editar por el mismo formulario. Los aportes no se tocan: cambiarle
   * el nombre a un colchón no debería mover ni un peso de lo que ya guardaste.
   */
  function handleAddBucket(e) {
    e.preventDefault();
    if (!bucketForm.name.trim()) return;
    const kind = bucketForm.kind === 'colchon' ? 'colchon' : 'meta';
    const datos = {
      name: bucketForm.name.trim(),
      kind,
      liquid: !!bucketForm.liquid,
      monthlyAmount: parseFloat(bucketForm.monthlyAmount) || 0,
      /* Un colchón no tiene objetivo: es margen, no una meta a la que llegar. */
      targetAmount: kind === 'meta' ? (parseFloat(bucketForm.targetAmount) || null) : null,
      targetDate: kind === 'meta' ? (bucketForm.targetDate || null) : null,
    };

    if (editingBucketId) {
      setBuckets((prev) => prev.map((b) => (b.id === editingBucketId ? { ...b, ...datos } : b)));
      setEditingBucketId(null);
    } else {
      setBuckets((prev) => [...prev, { id: uid(), ...datos, contributions: [] }]);
    }
    setBucketForm(BUCKET_VACIO);
    setShowBucketForm(false);
  }

  function handleEditBucket(b) {
    setEditingBucketId(b.id);
    setBucketForm({
      name: b.name,
      kind: b.kind === 'colchon' ? 'colchon' : 'meta',
      liquid: b.liquid !== false,
      monthlyAmount: b.monthlyAmount != null ? String(b.monthlyAmount) : '',
      targetAmount: b.targetAmount != null ? String(b.targetAmount) : '',
      targetDate: b.targetDate || '',
    });
    setShowBucketForm(true);
  }

  function handleCancelBucketForm() {
    setEditingBucketId(null);
    setBucketForm(BUCKET_VACIO);
    setShowBucketForm(false);
  }

  function handleDeleteBucket(id) {
    const b = buckets.find((x) => x.id === id);
    if (!window.confirm(`¿Eliminar "${b ? b.name : ''}" y todos sus aportes?`)) return;
    setBuckets((prev) => prev.filter((x) => x.id !== id));
  }

  /*
   * Un retiro es un aporte negativo, no una tabla aparte: es el mismo hecho
   * —plata que entra o sale del bucket— y separarlos obligaría a sumar dos
   * listas para saber cuánto hay.
   */
  function handleBucketMovement(bucketId, sign) {
    const amt = parseFloat(bucketInputs[bucketId]);
    if (!amt || amt <= 0) return;
    const hoy = todayStr();
    setBuckets((prev) => prev.map((b) => (b.id === bucketId
      ? { ...b, contributions: [...(b.contributions || []),
          { id: uid(), amount: amt * sign, date: hoy, month: monthKeyFromDate(hoy) }] }
      : b)));
    setBucketInputs((prev) => ({ ...prev, [bucketId]: '' }));
  }

  /*
   * Marcar (o desmarcar) un cobro.
   *
   * Solo se guarda lo YA cobrado: lo pendiente se deduce del reparto. Por eso
   * desmarcar es borrar la fila, no ponerle un `false` — así no hay que generar
   * cinco filas cada mes ni salir a limpiarlas si entra alguien nuevo.
   */
  function handleToggleCollection(shareId) {
    const ya = collections.find((c) => c.month === selectedMonth && c.shareId === shareId);
    if (ya) setCollections((prev) => prev.filter((c) => c.id !== ya.id));
    else setCollections((prev) => [...prev,
      { id: uid(), month: selectedMonth, shareId, collectedAt: todayStr() }]);
  }

  /*
   * El mes: plan contra realidad. Todo el cálculo vive en lib/month.js, que es
   * puro y está probado; aquí solo se le pasa el estado y el mes elegido.
   */
  const monthReport = useMemo(() => monthSummary(snapshot(), selectedMonth), [snapshot, selectedMonth]);

  /*
   * Lo que la tarjeta de crédito aplaza.
   *
   * No hace falta una pantalla para navegar los movimientos de la tarjeta —eso
   * es un filtro—. Lo que no se puede ver de otra forma son dos cosas: qué va a
   * llegar en la próxima factura, y cuánta plata está ya comprometida en cuotas
   * que todavía no se han cobrado. Eso segundo es justo lo que uno cree tener
   * libre y no tiene.
   */
  const cardOutlook = useMemo(() => {
    const statements = creditCards
      .map((card) => ({ card, next: nextStatement(buildCardStatements(transactions, card)) }))
      .filter((c) => c.next);
    const groups = activeInstallmentGroups(transactions);
    return {
      statements,
      dueNext: statements.reduce((s, c) => s + c.next.total, 0),
      groups,
      committed: groups.reduce((s, g) => s + g.monthly * g.remaining, 0),
    };
  }, [creditCards, transactions]);

  /*
   * La deuda que estás atacando, corrida con y sin el abono extra del plan.
   *
   * El número que motiva no es el saldo: es cuántos meses y cuántos intereses
   * te ahorras por mandarle lo que te sobra. Sin comparar contra pagar solo la
   * cuota, "abonar de más" es un acto de fe.
   */
  const debtOutlook = useMemo(() => {
    const estado = snapshot();
    const deuda = targetDebt(estado);
    if (!deuda) return null;

    const extra = Math.max(0, monthReport.plan.availableForExtra);
    const principal = deuda.currentBalance != null
      ? deuda.currentBalance
      /* Sin saldo reportado por el banco, se deduce de lo abonado. */
      : Math.max(0, (Number(deuda.totalAmount) || 0)
        - (deuda.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));

    return {
      debt: deuda,
      extra,
      ...comparePlans({
        principal,
        monthlyRate: monthlyRateOf(deuda),
        minimumPayment: Number(deuda.fixedPayment) || 0,
        extra,
      }),
    };
  }, [snapshot, monthReport]);

  /* "¿Y si le bajo al colchón?" — lo que se muestra ANTES de mover un número. */
  const simulate = useCallback(
    (cambios) => simulatePlanChange(snapshot(), cambios, selectedMonth),
    [snapshot, selectedMonth],
  );

  const value = {
    activeTab,
    debtOutlook,
    simulatePlan: simulate,
    balanceInputs,
    bucketForm,
    bucketInputs,
    cardOutlook,
    editingBucketId,
    handleAddBucket,
    handleBucketMovement,
    handleCancelBucketForm,
    handleEditBucket,
    handleDeleteBucket,
    handleToggleCollection,
    monthReport,
    setBalanceInputs,
    setBucketForm,
    setBucketInputs,
    setShowBucketForm,
    showBucketForm,
    allExpenseCategories,
    allIncomeCategories,
    availableMonths,
    cardForm,
    cardLabel,
    buckets,
    cashBalance,
    categoryLabels,
    collections,
    configTab,
    contributionInputs,
    creditCards,
    customCategories,
    debtForm,
    debtFormError,
    debtRemainingCOP,
    debts,
    editingCardId,
    editingFixedId,
    editingTxId,
    equityEvolution,
    filteredTx,
    findFixedExpensePaidThisMonth,
    fixedExpenses,
    fixedForm,
    getInstallmentGroup,
    incomeSources,
    monthlyPlans,
    people,
    goalForm,
    handleAddCard,
    handleAddCustomCategory,
    handleAddDebt,
    handleAddFixedExpense,
    handleAddGoal,
    handleAddPayment,
    handleAddTransaction,
    handleCancelCardForm,
    handleCancelFixedForm,
    handleCancelTxForm,
    handleContribution,
    handleDeleteCard,
    handleDeleteCustomCategory,
    handleDeleteDebt,
    handleDeleteFixedExpense,
    handleDeleteGoal,
    handleDeleteTransaction,
    handleEditCard,
    handleEditFixedExpense,
    handleEditTransaction,
    handleMarkFixedExpensePaid,
    handleOpenNewMovement,
    handleRegisterNextInstallment,
    handleExportExcel,
    handleResetAll,
    handleSetPin,
    handleUndoFixedExpensePaid,
    handleUpdateCategoryLabel,
    loadError,
    exporting,
    offline,
    pendingChanges,
    loading,
    monthlyIncomeExpense,
    monthsWindow,
    futureMonths,
    commitments,
    cardStatements,
    netWorth,
    newCatGasto,
    newCatIngreso,
    paymentInputs,
    pieData,
    pinForm,
    pinMessage,
    recommendations,
    saveError,
    savingsGoals,
    selMonthExpense,
    selMonthFixed,
    selMonthIncome,
    selMonthVariable,
    selectedMonth,
    setActiveTab,
    setCardForm,
    setCategoryLabels,
    setConfigTab,
    setContributionInputs,
    setCreditCards,
    setCustomCategories,
    setDebtForm,
    setDebtFormError,
    setDebts,
    setEditingCardId,
    setEditingFixedId,
    setEditingTxId,
    setFixedExpenses,
    setFixedForm,
    setGoalForm,
    setLoading,
    setNewCatGasto,
    setNewCatIngreso,
    setPaymentInputs,
    setPinForm,
    setPinMessage,
    setSaveError,
    setSavingsGoals,
    setSelectedMonth,
    setShowCardForm,
    setShowDebtForm,
    setShowFixedForm,
    setShowGoalForm,
    setShowTxForm,
    setTransactions,
    setTxFilters,
    setTxForm,
    setTxFormError,
    setUsdRate,
    setUserEmail,
    showCardForm,
    showDebtForm,
    showFixedForm,
    showGoalForm,
    showTxForm,
    status,
    totalCardSpendCOP,
    totalDebtRemaining,
    totalExpense,
    totalIncome,
    totalSavings,
    transactions,
    txChargeDate,
    txEffectiveRate,
    txFilterCategories,
    txFilters,
    txForm,
    txFormCategories,
    txFormError,
    txIsUSD,
    txSelectedCard,
    usdRate,
    userEmail,
  };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
