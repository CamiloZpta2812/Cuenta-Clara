import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { COLOR_CHOICES, COLORS } from '../lib/constants.js';
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
import { monthSummary, targetDebt, simulatePlanChange, myBucketShare } from '../lib/month.js';
import { comparePlans, monthlyRateOf, replayPayments } from '../lib/amortization.js';
import { buildCashFlow, currentBalance } from '../lib/cashflow.js';
import { buildQuincenas, monthGrid } from '../lib/quincenas.js';
import { upcomingCharges } from '../lib/upcoming.js';

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
  /* Resumen de entrada: es la foto, y desde ahí se baja al detalle. */
  const [activeTab, setActiveTab] = useState('resumen');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ''));
  }, []);

  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
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
  /* "Este mes este bucket va por tanto". Ver lib/month.js. */
  const [bucketAdjustments, setBucketAdjustments] = useState([]);
  const [monthlyPlans, setMonthlyPlans] = useState([]);
  const [setupCompletedAt, setSetupCompletedAt] = useState(null);

  /*
   * Desde cuándo la app sabe cuánto tienes: { date, amount }, o null si nadie
   * lo ha dicho todavía. Ver lib/cashflow.js.
   */
  const [balanceAnchor, setBalanceAnchor] = useState(null);

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
  const [txForm, setTxForm] = useState({ type: 'gasto', amount: '', category: 'alimentacion', date: todayStr(), note: '', paymentMethod: 'debito', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
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
  const [fixedForm, setFixedForm] = useState({ name: '', category: 'servicios', amount: '', dueDay: '', paymentMethod: 'debito', cardId: '' });

  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtForm, setDebtForm] = useState({ name: '', totalAmount: '', interestRate: '', monthlyPayment: '', dueDay: '', startDate: todayStr(), currency: 'COP', exchangeRate: '' });
  const [editingDebtId, setEditingDebtId] = useState(null);
  const [debtFormError, setDebtFormError] = useState('');
  const [paymentInputs, setPaymentInputs] = useState({});

  const [balanceInputs, setBalanceInputs] = useState({});
  const [paidDateInputs, setPaidDateInputs] = useState({});
  /*
   * A cuál deuda le mandas el abono extra. null = la que escoja el motor, que
   * es la más cara. Con una sola deuda esto nunca se usa.
   */
  const [selectedDebtId, setSelectedDebtId] = useState(null);
  const [bucketInputs, setBucketInputs] = useState({});
  const [showBucketForm, setShowBucketForm] = useState(false);
  const [editingBucketId, setEditingBucketId] = useState(null);
  const [bucketForm, setBucketForm] = useState({
    name: '', kind: 'meta', liquid: true, movesCash: true,
    monthlyAmount: '', depositDay: '', targetAmount: '', targetDate: '',
  });

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
    transactions, debts, creditCards, fixedExpenses,
    customCategories, categoryLabels,
    people, incomeSources, collections, buckets, monthlyPlans, setupCompletedAt,
    balanceAnchor, bucketAdjustments,
  }), [transactions, debts, creditCards, fixedExpenses,
       customCategories, categoryLabels,
       people, incomeSources, collections, buckets, monthlyPlans, setupCompletedAt,
       balanceAnchor, bucketAdjustments]);

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
        setBalanceAnchor(state.balanceAnchor || null);
        setBucketAdjustments(state.bucketAdjustments || []);
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
  /*
   * Lo apartado, contando solo tu parte de los potes compartidos y dejando por
   * fuera las reservas: en una reserva la plata nunca se movió, sigue en la
   * cuenta y ya está contada en el saldo.
   */
  const totalSavings = useMemo(() => buckets
    .filter((b) => b.movesCash !== false)
    .reduce((s, b) => s + (b.contributions || [])
      .reduce((a, c) => a + (Number(c.amount) || 0), 0), 0), [buckets]);
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
  const recommendations = useMemo(
    () => buildRecommendations(snapshot(), selectedMonth),
    [snapshot, selectedMonth],
  );
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
    setTxForm({ type: txForm.type, amount: '', category: txForm.type === 'gasto' ? EXPENSE_CATEGORIES[0].id : INCOME_CATEGORIES[0].id, date: todayStr(), note: '', paymentMethod: 'debito', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
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
    setTxForm({ type: 'gasto', amount: '', category: EXPENSE_CATEGORIES[0].id, date: todayStr(), note: '', paymentMethod: 'debito', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
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
    const datos = {
      name: debtForm.name.trim(),
      totalAmount: total,
      interestRate: debtForm.interestRate ? parseFloat(debtForm.interestRate) : 0,
      monthlyPayment: debtForm.monthlyPayment ? parseFloat(debtForm.monthlyPayment) : 0,
      dueDay: debtForm.dueDay ? parseInt(debtForm.dueDay, 10) : null,
      startDate: debtForm.startDate || todayStr(),
      currency: isUSD ? 'USD' : 'COP',
      exchangeRate: isUSD ? rate : null,
      /*
       * Los campos del modelo nuevo. Sin ellos la deuda entra invisible para
       * el plan y para la amortización: fixedPayment es lo que el plan resta
       * cada mes, y currentBalance de dónde arranca la proyección.
       */
      fixedPayment: debtForm.monthlyPayment ? parseFloat(debtForm.monthlyPayment) : 0,
    };

    if (editingDebtId) {
      /*
       * Al editar NO se toca currentBalance ni payments: el saldo lo mueven
       * los abonos, y pisarlo con el monto del formulario borraría de un golpe
       * todo lo que llevas pagado.
       */
      setDebts((prev) => prev.map((d) => (d.id === editingDebtId ? { ...d, ...datos } : d)));
      setEditingDebtId(null);
    } else {
      setDebts((prev) => [...prev, {
        id: uid(), ...datos, payoffMode: 'reducir-plazo', currentBalance: total, payments: [],
      }]);
    }
    setDebtForm({ name: '', totalAmount: '', interestRate: '', monthlyPayment: '', dueDay: '', startDate: todayStr(), currency: 'COP', exchangeRate: '' });
    setShowDebtForm(false);
  }
  /*
   * Editar una deuda.
   *
   * No existía: el formulario solo servía para crear, así que una deuda
   * sembrada por SQL —o cualquiera a la que se le olvidara un campo— quedaba
   * congelada. El día de pago del crédito estuvo vacío semanas por esto, y sin
   * él la cuota no aparecía en el Calendario: la salida más grande del mes,
   * invisible, sin forma de arreglarlo desde la app.
   */
  function handleEditDebt(d) {
    setDebtFormError('');
    setEditingDebtId(d.id);
    setDebtForm({
      name: d.name || '',
      totalAmount: d.totalAmount != null ? String(d.totalAmount) : '',
      interestRate: d.interestRate != null ? String(d.interestRate) : '',
      monthlyPayment: d.monthlyPayment != null ? String(d.monthlyPayment) : '',
      dueDay: d.dueDay != null ? String(d.dueDay) : '',
      startDate: d.startDate || todayStr(),
      currency: d.currency || 'COP',
      exchangeRate: d.exchangeRate != null ? String(d.exchangeRate) : '',
    });
    setShowDebtForm(true);
  }

  function handleCancelDebtForm() {
    setDebtFormError('');
    setEditingDebtId(null);
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
    setFixedForm({ name: '', category: EXPENSE_CATEGORIES[0].id, amount: '', dueDay: '', paymentMethod: 'debito', cardId: '' });
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
    setFixedForm({ name: '', category: EXPENSE_CATEGORIES[0].id, amount: '', dueDay: '', paymentMethod: 'debito', cardId: '' });
  }
  function handleDeleteFixedExpense(id) {
    if (!window.confirm('¿Eliminar este gasto fijo? Los movimientos que ya generó no se borran.')) return;
    setFixedExpenses((prev) => prev.filter((f) => f.id !== id));
  }
  function findFixedExpensePaidThisMonth(feId) {
    const key = monthKeyFromDate(todayStr());
    return transactions.find((t) => t.fixedExpenseId === feId && monthKeyFromDate(t.date) === key);
  }
  /*
   * Marcar un gasto fijo como pagado.
   *
   * `cuando` es opcional y viene del campo de fecha de la pantalla, que arranca
   * en hoy: casi siempre lo marcas el mismo día, pero a veces te acuerdas al
   * otro. Registrar todo como "hoy" corría los pagos de fin de mes al mes
   * siguiente y descuadraba el mes sin que se notara.
   */
  function handleMarkFixedExpensePaid(fe, cuando) {
    let date = cuando || todayStr();
    if (!cuando && fe.dueDay) {
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
      month: monthKeyFromDate(date),
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
    setCreditCards([]);
    setFixedExpenses([]);
    setCustomCategories([]);
    setCategoryLabels({});
  }

  /* ---------- Buckets: metas y colchones ---------- */

  const BUCKET_VACIO = {
    name: '', kind: 'meta', liquid: true, movesCash: true,
    monthlyAmount: '', depositDay: '', targetAmount: '', targetDate: '',
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
      movesCash: bucketForm.movesCash !== false,
      monthlyAmount: parseFloat(bucketForm.monthlyAmount) || 0,
      /* Vacío es null, no cero: cero no es un día del mes. */
      depositDay: bucketForm.depositDay === '' ? null : parseInt(bucketForm.depositDay, 10) || null,
      /* Un colchón no tiene objetivo: es margen, no una meta a la que llegar. */
      targetAmount: kind === 'meta' ? (parseFloat(bucketForm.targetAmount) || null) : null,
      targetDate: kind === 'meta' ? (bucketForm.targetDate || null) : null,
    };

    if (editingBucketId) {
      setBuckets((prev) => prev.map((b) => (b.id === editingBucketId ? { ...b, ...datos } : b)));
      setEditingBucketId(null);
    } else {
      setBuckets((prev) => [...prev, { id: uid(), ...datos, shares: [], contributions: [] }]);
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
      movesCash: b.movesCash !== false,
      monthlyAmount: b.monthlyAmount != null ? String(b.monthlyAmount) : '',
      depositDay: b.depositDay != null ? String(b.depositDay) : '',
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
  /*
   * Aportar y retirar no son la misma operación al revés.
   *
   * Lo que aportas es TUYO y entra tal cual: si pones 150.000 al fondo con
   * Sofi, saliste de 150.000, sin importar que el pote sean 600.000 al mes.
   *
   * Lo que retiras sale del POTE y te cuesta tu fracción: sacar 200.000 para
   * el veterinario de los gatos —que van a medias— te cuesta 100.000. Por eso
   * el retiro se convierte y el aporte no.
   */
  function handleBucketMovement(bucketId, sign) {
    const amt = parseFloat(bucketInputs[bucketId]);
    if (!amt || amt <= 0) return;
    const bucket = buckets.find((b) => b.id === bucketId);
    const total = Number(bucket && bucket.monthlyAmount) || 0;
    /* Sin monto mensual no hay proporción que sacar: el pote es todo tuyo. */
    const factor = total > 0 ? myBucketShare(bucket) / total : 1;
    const monto = sign < 0 ? -amt * factor : amt;
    const hoy = todayStr();
    setBuckets((prev) => prev.map((b) => (b.id === bucketId
      ? { ...b, contributions: [...(b.contributions || []),
          { id: uid(), amount: monto, date: hoy, month: monthKeyFromDate(hoy) }] }
      : b)));
    setBucketInputs((prev) => ({ ...prev, [bucketId]: '' }));
  }

  /* ---------- Fuentes de ingreso ---------- */

  /*
   * Las fuentes de ingreso se cargaban y se guardaban desde el primer día,
   * pero no había ni una pantalla para tocarlas: existían solo porque las
   * había creado un script. Cuando el calendario empezó a necesitar el día en
   * que cae cada una, el único camino era volver a abrir Supabase.
   *
   * `expected` es lo que ESPERAS, no lo que entró: lo que entró son
   * movimientos, y la app compara los dos.
   */
  function handleAddIncomeSource() {
    setIncomeSources((prev) => [...prev, {
      id: uid(), name: '', expected: 0, variable: true, active: true,
      day: null, startsPeriod: false,
    }]);
  }

  function handleUpdateIncomeSource(id, cambios) {
    setIncomeSources((prev) => prev.map((f) => (f.id === id ? { ...f, ...cambios } : f)));
  }

  /*
   * Borrar de verdad, no desactivar: para eso está el interruptor de activa.
   * Una fuente que dejaste de recibir se desactiva —así el historial sigue
   * teniendo sentido— y una que nunca debió existir se borra.
   */
  function handleDeleteIncomeSource(id) {
    setIncomeSources((prev) => prev.filter((f) => f.id !== id));
  }

  /*
   * Ajustar un bucket solo para el mes que se está mirando.
   *
   * Un monto vacío quita el ajuste en vez de guardar un cero: son cosas
   * distintas. Cero es "este mes no le meto nada" —una decisión— y quitar el
   * ajuste es "vuelve a lo de siempre". Guardar el vacío como cero convertiría
   * un arrepentimiento en un mes saltado.
   */
  function handleAdjustBucketMonth(bucketId, monto, month) {
    /*
     * El mes lo pone quien llama. Buckets no tiene selector de mes —siempre
     * habla del mes en curso— y tomar `selectedMonth`, que se mueve desde
     * Resumen, guardaría el ajuste en un mes que la pantalla no está mostrando.
     */
    const mes = month || currentMonthKey();
    const previo = bucketAdjustments.find(
      (a) => a.month === mes && a.bucketId === bucketId,
    );
    if (monto === '' || monto === null || monto === undefined) {
      if (previo) setBucketAdjustments((prev) => prev.filter((a) => a.id !== previo.id));
      return;
    }
    const n = Number(monto);
    if (Number.isNaN(n)) return;
    if (previo) {
      setBucketAdjustments((prev) => prev.map((a) => (a.id === previo.id ? { ...a, amount: n } : a)));
    } else {
      setBucketAdjustments((prev) => [...prev, { id: uid(), month: mes, bucketId, amount: n }]);
    }
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
   * Lo que se viene esta semana. El día de cobro estaba guardado desde
   * siempre y solo servía para escribir "día 5" en la lista: saber que el
   * arriendo es el 5 no sirve el día 3 si nadie te lo dice.
   */
  const proximosCobros = useMemo(() => upcomingCharges(snapshot(), 8), [snapshot]);

  /* El sello sale del plan, no de lo registrado. Ver lib/insights.js. */
  const status = getStatus(monthReport.plan);

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
    const deuda = targetDebt(estado, selectedDebtId);
    if (!deuda) return null;

    const extra = Math.max(0, monthReport.plan.availableForExtra);
    const principal = deuda.currentBalance != null
      ? deuda.currentBalance
      /* Sin saldo reportado por el banco, se deduce de lo abonado. */
      : Math.max(0, (Number(deuda.totalAmount) || 0)
        - (deuda.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0));

    /*
     * Lo que ya pagaste, corrido desde el monto original del crédito. Sin esto
     * la tabla es una simulación; con esto es tu plan de pago, con las cuotas
     * hechas marcadas y la proyección siguiendo desde ahí.
     */
    const hechas = replayPayments({
      principal: Number(deuda.totalAmount) || principal,
      monthlyRate: monthlyRateOf(deuda),
      payments: deuda.payments,
    });

    /*
     * La historia se reconstruye desde el monto original; la proyección arranca
     * del saldo de hoy. Si los dos no coinciden —porque el crédito traía saldo
     * de antes de usar la app, o porque el banco cobró algo que no modelamos—
     * la tabla mostraría un salto entre la última cuota pagada y la siguiente.
     *
     * El saldo de hoy es el dato más confiable, así que la última fila pagada
     * se cierra ahí. La diferencia se absorbe en su capital, que es donde de
     * verdad está: pagaste lo que pagaste, y el saldo quedó donde quedó.
     */
    const ultima = hechas[hechas.length - 1];
    if (ultima && Number.isFinite(principal) && Math.abs(ultima.closing - principal) > 1) {
      ultima.closing = principal;
      ultima.principal = ultima.opening + ultima.interest - principal;
    }

    return {
      debt: deuda,
      extra,
      hechas,
      ...comparePlans({
        principal,
        monthlyRate: monthlyRateOf(deuda),
        minimumPayment: Number(deuda.fixedPayment) || 0,
        extra,
      }),
    };
  }, [snapshot, monthReport, selectedDebtId]);

  /* "¿Y si le bajo al colchón?" — lo que se muestra ANTES de mover un número. */
  const simulate = useCallback(
    (cambios) => simulatePlanChange(snapshot(), cambios, selectedMonth, selectedDebtId),
    [snapshot, selectedMonth, selectedDebtId],
  );

  /*
   * A dónde va cada peso del plan. La suma da el ingreso completo, así que los
   * porcentajes se leen sin tener que hacer la cuenta: cuánto de lo que entra
   * ya tiene dueño antes de que llegue.
   */
  const planDistribution = useMemo(() => {
    const p = monthReport.plan;
    return [
      { name: 'Gastos fijos',   value: p.fixedExpenses, color: COLORS.debt },
      { name: 'Cuota de deuda', value: p.debtPayment,   color: '#8C6BB1' },
      { name: 'Abono extra',    value: Math.max(0, p.availableForExtra), color: COLORS.income },
      { name: 'Metas',          value: p.savings,       color: COLORS.savings },
      { name: 'Colchones',      value: p.cushion,       color: '#3E7FB0' },
      { name: 'Gasto variable', value: p.variable,      color: COLORS.expense },
    ].filter((x) => x.value > 0);
  }, [monthReport]);

  /* El pulso del mes, movimiento a movimiento. Ver lib/cashflow.js. */
  const cashFlow = useMemo(
    () => buildCashFlow(snapshot(), getLastMonthKeys(3, selectedMonth)),
    [snapshot, selectedMonth],
  );

  /*
   * Lo que hay en la cuenta hoy, o null mientras nadie haya anclado el saldo.
   * Null y cero son cosas distintas y las pantallas tienen que poder
   * distinguirlas: una dice "todavía no sé", la otra dice "no tienes nada".
   */
  const saldoReal = useMemo(() => currentBalance(snapshot()), [snapshot]);

  /* El mes partido de sueldo a sueldo. Ver lib/quincenas.js. */
  const quincenas = useMemo(
    () => buildQuincenas(snapshot(), selectedMonth),
    [snapshot, selectedMonth],
  );

  /* Lo mismo, en cuadrícula de calendario. */
  const calendarioRejilla = useMemo(
    () => monthGrid(snapshot(), selectedMonth),
    [snapshot, selectedMonth],
  );

  /*
   * Anclar es decir "hoy cerré con tanto". No crea un movimiento: los
   * movimientos son cosas que pasaron, y esto es una medición del resultado.
   * Escribir el saldo otra vez vuelve a anclar, que es como se corrige.
   */
  const handleAnchorBalance = useCallback((monto, fecha) => {
    const n = Number(monto);
    if (monto === '' || monto === null || Number.isNaN(n)) { setBalanceAnchor(null); return; }
    setBalanceAnchor({ date: (fecha || todayStr()).slice(0, 10), amount: n });
  }, []);

  const value = {
    activeTab,
    cashFlow,
    saldoReal,
    quincenas,
    calendarioRejilla,
    balanceAnchor,
    handleAnchorBalance,
    debtOutlook,
    planDistribution,
    selectedDebtId,
    setSelectedDebtId,
    simulatePlan: simulate,
    balanceInputs,
    bucketForm,
    paidDateInputs,
    proximosCobros,
    setPaidDateInputs,
    bucketInputs,
    cardOutlook,
    editingBucketId,
    handleAddBucket,
    handleCancelDebtForm,
    handleEditDebt,
    editingDebtId,
    handleBucketMovement,
    handleAdjustBucketMonth,
    handleAddIncomeSource,
    handleUpdateIncomeSource,
    handleDeleteIncomeSource,
    bucketAdjustments,
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
    creditCards,
    customCategories,
    debtForm,
    debtFormError,
    debtRemainingCOP,
    debts,
    editingCardId,
    editingFixedId,
    editingTxId,
    filteredTx,
    findFixedExpensePaidThisMonth,
    fixedExpenses,
    fixedForm,
    getInstallmentGroup,
    incomeSources,
    monthlyPlans,
    people,
    handleAddCard,
    handleAddCustomCategory,
    handleAddDebt,
    handleAddFixedExpense,
    handleAddPayment,
    handleAddTransaction,
    handleCancelCardForm,
    handleCancelFixedForm,
    handleCancelTxForm,
    handleDeleteCard,
    handleDeleteCustomCategory,
    handleDeleteDebt,
    handleDeleteFixedExpense,
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
    selMonthExpense,
    selMonthFixed,
    selMonthIncome,
    selMonthVariable,
    selectedMonth,
    setActiveTab,
    setCardForm,
    setCategoryLabels,
    setConfigTab,
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
    setLoading,
    setNewCatGasto,
    setNewCatIngreso,
    setPaymentInputs,
    setPinForm,
    setPinMessage,
    setSaveError,
    setSelectedMonth,
    setShowCardForm,
    setShowDebtForm,
    setShowFixedForm,
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
