import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, ArrowLeftRight, CreditCard, PiggyBank, Plus, Trash2,
  AlertTriangle, TrendingUp, TrendingDown, Wallet, Utensils, Car, Home,
  Film, HeartPulse, GraduationCap, Zap, ShoppingBag, MoreHorizontal,
  Briefcase, Laptop, CircleDollarSign, Check, Loader2, X, Landmark, Banknote, Pencil, Settings,
  Gift, Plane, Dumbbell, PawPrint, Coffee, Smartphone, Baby, Shirt, Repeat,
} from 'lucide-react';
import { getItem, setItem } from './storage';
import { supabase } from './supabaseClient';

/* ============================== DATOS FIJOS ============================== */

const COLORS = {
  income: '#2F7D5C',
  expense: '#BB4B34',
  savings: '#B98A2E',
  debt: '#6B5199',
  brand: '#BB4B34',
  ink: '#2E2B27',
  inkSoft: '#6E675E',
  line: '#E4DDCE',
};

const EXPENSE_CATEGORIES = [
  { id: 'alimentacion', label: 'Alimentación', icon: Utensils, color: '#B0524B' },
  { id: 'transporte', label: 'Transporte', icon: Car, color: '#B9772E' },
  { id: 'vivienda', label: 'Vivienda', icon: Home, color: '#6B5199' },
  { id: 'entretenimiento', label: 'Entretenimiento', icon: Film, color: '#3E7FB0' },
  { id: 'salud', label: 'Salud', icon: HeartPulse, color: '#B03E70' },
  { id: 'educacion', label: 'Educación', icon: GraduationCap, color: '#3E9C7A' },
  { id: 'servicios', label: 'Servicios', icon: Zap, color: '#B99A2E' },
  { id: 'compras', label: 'Compras', icon: ShoppingBag, color: '#7A5C44' },
  { id: 'deudas', label: 'Pago de deudas', icon: CreditCard, color: '#6B5199' },
  { id: 'otros_gasto', label: 'Otros', icon: MoreHorizontal, color: '#7A8088' },
];

const INCOME_CATEGORIES = [
  { id: 'salario', label: 'Salario', icon: Briefcase, color: '#2F7D5C' },
  { id: 'freelance', label: 'Independiente', icon: Laptop, color: '#4F9A6E' },
  { id: 'inversiones', label: 'Inversiones', icon: TrendingUp, color: '#2F8F6F' },
  { id: 'otros_ingreso', label: 'Otros ingresos', icon: CircleDollarSign, color: '#6BAF8A' },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
let categoryLabelOverrides = {};
let customCategoriesOverride = [];

const ICON_CHOICES = [
  { key: 'utensils', label: 'Comida', Icon: Utensils },
  { key: 'car', label: 'Transporte', Icon: Car },
  { key: 'home', label: 'Hogar', Icon: Home },
  { key: 'film', label: 'Entretenimiento', Icon: Film },
  { key: 'heart', label: 'Salud', Icon: HeartPulse },
  { key: 'grad', label: 'Educación', Icon: GraduationCap },
  { key: 'zap', label: 'Servicios', Icon: Zap },
  { key: 'bag', label: 'Compras', Icon: ShoppingBag },
  { key: 'briefcase', label: 'Trabajo', Icon: Briefcase },
  { key: 'laptop', label: 'Tecnología', Icon: Laptop },
  { key: 'piggy', label: 'Ahorro', Icon: PiggyBank },
  { key: 'landmark', label: 'Banco', Icon: Landmark },
  { key: 'wallet', label: 'Billetera', Icon: Wallet },
  { key: 'gift', label: 'Regalos', Icon: Gift },
  { key: 'plane', label: 'Viajes', Icon: Plane },
  { key: 'dumbbell', label: 'Ejercicio', Icon: Dumbbell },
  { key: 'paw', label: 'Mascotas', Icon: PawPrint },
  { key: 'coffee', label: 'Café/salidas', Icon: Coffee },
  { key: 'phone', label: 'Celular', Icon: Smartphone },
  { key: 'baby', label: 'Bebé/niños', Icon: Baby },
  { key: 'shirt', label: 'Ropa', Icon: Shirt },
  { key: 'other', label: 'Otro', Icon: MoreHorizontal },
];
const ICON_MAP = Object.fromEntries(ICON_CHOICES.map((i) => [i.key, i.Icon]));
const COLOR_CHOICES = [
  '#B0524B', '#B9772E', '#6B5199', '#3E7FB0', '#B03E70', '#3E9C7A',
  '#B99A2E', '#7A5C44', '#7A8088', '#2F7D5C', '#4F9A6E', '#2F8F6F', '#6BAF8A',
];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const STORAGE_KEY = 'cuenta-clara-datos';

const PAYMENT_METHODS = [
  { id: 'efectivo', label: 'Efectivo', icon: Banknote },
  { id: 'debito', label: 'Tarjeta débito', icon: Wallet },
  { id: 'credito', label: 'Tarjeta crédito', icon: CreditCard },
];

/* ============================== HELPERS ============================== */

function todayStr() { return new Date().toISOString().slice(0, 10); }
let monthStartDayOverride = 1;
function monthKeyFromDate(d) {
  const dateStr = d || todayStr();
  const S = monthStartDayOverride;
  if (!S || S <= 1) return dateStr.slice(0, 7);
  const [y, m, day] = dateStr.split('-').map(Number);
  const effectiveS = Math.min(S, daysInMonth(y, m - 1));
  if (day >= effectiveS) return `${y}-${String(m).padStart(2, '0')}`;
  let pm = m - 1;
  let py = y;
  if (pm < 1) { pm = 12; py -= 1; }
  return `${py}-${String(pm).padStart(2, '0')}`;
}
function currentMonthKey() { return monthKeyFromDate(todayStr()); }
function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}
function addMonths(key, delta) {
  let [y, m] = key.split('-').map(Number);
  m += delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}
function getLastMonthKeys(n, endKey) {
  const arr = [];
  for (let i = n - 1; i >= 0; i -= 1) arr.push(addMonths(endKey, -i));
  return arr;
}
function monthsBetween(k1, k2) {
  const [y1, m1] = k1.split('-').map(Number);
  const [y2, m2] = k2.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }
function computeChargeDate(purchaseDateStr, cutDay, paymentDay) {
  if (!purchaseDateStr || !cutDay || !paymentDay) return null;
  const [y, m, d] = purchaseDateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  let cutMonth = m - 1;
  let cutYear = y;
  const effectiveCut = Math.min(cutDay, daysInMonth(cutYear, cutMonth));
  if (d > effectiveCut) {
    cutMonth += 1;
    if (cutMonth > 11) { cutMonth = 0; cutYear += 1; }
  }
  let paymentMonth = cutMonth + 1;
  let paymentYear = cutYear;
  if (paymentMonth > 11) { paymentMonth = 0; paymentYear += 1; }
  const effectivePaymentDay = Math.min(paymentDay, daysInMonth(paymentYear, paymentMonth));
  return new Date(paymentYear, paymentMonth, effectivePaymentDay);
}
function formatDateHuman(dateObj) {
  return `${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}
function fmtCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(n || 0));
}
function fmtUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}
function fmtMoney(n, currency) {
  return currency === 'USD' ? fmtUSD(n) : fmtCOP(n);
}
function fmtShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${Math.round(n / 1000)}K`;
  return `${Math.round(n)}`;
}
function getCategory(id) {
  const custom = customCategoriesOverride.find((c) => c.id === id);
  const found = custom || ALL_CATEGORIES.find((c) => c.id === id) || EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
  const icon = found.icon || ICON_MAP[found.iconKey] || MoreHorizontal;
  const customLabel = categoryLabelOverrides[found.id];
  return { ...found, icon, label: customLabel || found.label };
}
function getPaymentMethod(id) {
  return PAYMENT_METHODS.find((p) => p.id === id) || PAYMENT_METHODS[0];
}

function buildRecommendations(transactions, debts, savingsGoals) {
  const recs = [];
  const cmk = currentMonthKey();
  const monthTx = transactions.filter((t) => monthKeyFromDate(t.date) === cmk);
  const income = monthTx.filter((t) => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);

  if (income === 0 && expense === 0) {
    recs.push({ kind: 'tip', text: 'Aún no registras movimientos este mes. Agrega tus ingresos y gastos para empezar a ver tu balance real.' });
  } else if (income === 0) {
    recs.push({ kind: 'tip', text: 'No has registrado ingresos este mes. Añádelos para calcular tu tasa real de ahorro.' });
  } else {
    const rate = (income - expense) / income;
    if (expense > income) {
      recs.push({ kind: 'warning', text: `Este mes tus gastos (${fmtCOP(expense)}) superan tus ingresos (${fmtCOP(income)}). Vale la pena revisar en qué se está yendo el dinero antes de que se convierta en deuda.` });
    } else if (rate < 0.1) {
      recs.push({ kind: 'tip', text: `Este mes te queda disponible cerca del ${(rate * 100).toFixed(0)}% de tus ingresos después de gastos. La regla 50/30/20 sugiere dejar libre al menos un 20% para mover a ahorro o inversión.` });
    } else if (rate >= 0.2) {
      recs.push({ kind: 'success', text: `Vas bien: este mes te queda disponible cerca del ${(rate * 100).toFixed(0)}% de tus ingresos después de gastos. Considera pasar parte de eso a una meta de ahorro para que no se diluya en el día a día.` });
    }
    const fixedExpense = monthTx.filter((t) => t.type === 'gasto' && t.isFixed).reduce((s, t) => s + t.amount, 0);
    if (fixedExpense / income > 0.5) {
      recs.push({ kind: 'warning', text: `Tus gastos fijos (${fmtCOP(fixedExpense)}) representan más del 50% de tus ingresos este mes. Ese margen tan ajustado deja poco espacio para imprevistos.` });
    }
  }

  if (expense > 0) {
    const byCat = {};
    monthTx.filter((t) => t.type === 'gasto').forEach((t) => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const share = top[1] / expense;
      if (share > 0.4) {
        recs.push({ kind: 'tip', text: `${getCategory(top[0]).label} concentra el ${(share * 100).toFixed(0)}% de tus gastos este mes. Revisa si hay margen para recortar ahí.` });
      }
    }
  }

  if (debts.length > 0) {
    const withRate = debts.filter((d) => d.interestRate && parseFloat(d.interestRate) > 0);
    if (withRate.length > 0) {
      const worst = [...withRate].sort((a, b) => parseFloat(b.interestRate) - parseFloat(a.interestRate))[0];
      recs.push({ kind: 'tip', text: `Entre tus deudas, "${worst.name}" tiene la tasa más alta (${worst.interestRate}% mensual). Priorizar sus pagos (método avalancha) suele ahorrarte más intereses en el tiempo.` });
    }
    const totalDebt = debts.reduce((s, d) => s + Math.max(0, parseFloat(d.totalAmount) - d.payments.reduce((a, p) => a + p.amount, 0)), 0);
    if (income > 0 && totalDebt > income * 3) {
      recs.push({ kind: 'warning', text: `Tu deuda pendiente (${fmtCOP(totalDebt)}) equivale a más de 3 meses de tus ingresos actuales. Considera un plan de pago acelerado.` });
    }
  }

  if (savingsGoals.length === 0) {
    recs.push({ kind: 'tip', text: 'No tienes metas de ahorro creadas. Un fondo de emergencia de 3 a 6 meses de gastos es un buen primer objetivo.' });
  } else {
    savingsGoals.forEach((g) => {
      if (!g.targetDate || g.targetAmount == null) return;
      const saved = g.contributions.reduce((s, c) => s + c.amount, 0);
      const remaining = parseFloat(g.targetAmount) - saved;
      if (remaining <= 0) return;
      const monthsLeft = monthsBetween(cmk, monthKeyFromDate(g.targetDate));
      if (monthsLeft > 0) {
        const requiredMonthly = remaining / monthsLeft;
        const firstDate = g.contributions[0] ? g.contributions[0].date : null;
        const monthsActive = firstDate ? Math.max(1, monthsBetween(monthKeyFromDate(firstDate), cmk) + 1) : 1;
        const avgMonthly = saved / monthsActive;
        if (avgMonthly < requiredMonthly * 0.8) {
          recs.push({ kind: 'warning', text: `Para llegar a "${g.name}" en la fecha planeada necesitas aportar cerca de ${fmtCOP(requiredMonthly)} al mes (vas en un promedio de ${fmtCOP(avgMonthly)}).` });
        }
      } else if (monthsLeft <= 0) {
        recs.push({ kind: 'warning', text: `La fecha meta de "${g.name}" ya pasó y aún faltan ${fmtCOP(remaining)} por ahorrar.` });
      }
    });
  }

  const priority = { warning: 0, tip: 1, success: 2 };
  return recs.sort((a, b) => priority[a.kind] - priority[b.kind]).slice(0, 5);
}

function getStatus(income, expense) {
  if (income === 0 && expense === 0) return { label: 'Sin datos este mes', color: COLORS.inkSoft, Icon: Wallet };
  if (expense > income) return { label: 'Revisar gastos', color: COLORS.expense, Icon: AlertTriangle };
  const rate = income > 0 ? (income - expense) / income : 0;
  if (rate >= 0.2) return { label: 'Saldo sólido', color: COLORS.income, Icon: Check };
  return { label: 'En equilibrio', color: COLORS.savings, Icon: TrendingUp };
}

/* ============================== ESTILOS ============================== */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');

:root {
  --paper: #F4F1EA;
  --paper-line: #E4DDCE;
  --ink: #2E2B27;
  --ink-soft: #6E675E;
  --income: #2F7D5C;
  --income-soft: #E3EFE8;
  --expense: #BB4B34;
  --expense-soft: #F5E2DB;
  --savings: #B98A2E;
  --savings-soft: #F6EEDA;
  --debt: #6B5199;
  --debt-soft: #EDE7F5;
  --brand: #BB4B34;
  --card: #FFFFFF;
}
.cc-app {
  font-family: 'Poppins', sans-serif;
  color: var(--ink);
  background:
    repeating-linear-gradient(to bottom, transparent 0 39px, var(--paper-line) 39px 40px),
    var(--paper);
  min-height: 100vh;
  display: flex;
  box-sizing: border-box;
}
.cc-app * { box-sizing: border-box; }
.cc-mono { font-family: 'Poppins', sans-serif; }
.cc-display { font-family: 'Poppins', sans-serif; }

.cc-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.55);
  border-right: 1px solid var(--paper-line);
  padding: 22px 16px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 100vh;
}
.cc-brand { display: flex; align-items: center; gap: 10px; padding: 0 6px; }
.cc-brand-logo { display: inline-flex; align-items: center; line-height: 1; }
.cc-brand-title { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 22px; letter-spacing: -0.01em; }
.cc-brand-sub { font-size: 12px; color: var(--ink-soft); }
.cc-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.cc-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 9px; border: none;
  background: transparent; cursor: pointer; text-align: left;
  font-family: 'Poppins', sans-serif; font-size: 14px; font-weight: 500;
  color: var(--ink-soft); transition: background .15s ease, color .15s ease;
  border-left: 3px solid transparent;
}
.cc-nav-item:hover { background: rgba(32,43,56,0.05); color: var(--ink); }
.cc-nav-item.active { background: var(--card); color: var(--ink); border-left: 3px solid var(--brand); font-weight: 600; box-shadow: 0 1px 2px rgba(46,43,39,.06); }
.cc-sidebar-footer { display: flex; flex-direction: column; gap: 8px; padding: 0 6px; }
.cc-sidebar-note { font-size: 11px; color: var(--ink-soft); line-height: 1.5; }

.cc-main { flex: 1; padding: 28px 34px; max-width: 1180px; }
.cc-page-title { font-family: 'Poppins', sans-serif; font-size: 24px; font-weight: 600; margin: 0 0 4px 0; }
.cc-page-sub { color: var(--ink-soft); font-size: 14px; margin: 0 0 22px 0; }
.cc-subtabs { display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; }
.cc-subtab { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--paper-line); background: var(--card); color: var(--ink-soft); font-size: 13px; font-weight: 600; cursor: pointer; }
.cc-subtab.active { background: var(--brand); color: #fff; border-color: var(--brand); }

.cc-banner {
  display: flex; align-items: center; gap: 8px;
  background: var(--expense-soft); color: var(--expense);
  padding: 10px 14px; border-radius: 8px; font-size: 13px; margin-bottom: 16px;
}

.cc-stamp {
  display: inline-flex; align-items: center; gap: 8px;
  border: 3px double currentColor; padding: 10px 18px; border-radius: 8px;
  transform: rotate(-3deg); font-family: 'Poppins', sans-serif;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; font-size: 12.5px;
}

.cc-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin: 20px 0; }
.cc-card { background: var(--card); border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 2px rgba(32,43,56,.05), 0 6px 18px rgba(32,43,56,.05); border: 1px solid rgba(32,43,56,0.04); }
.cc-stat-label { font-size: 12px; color: var(--ink-soft); display: flex; align-items: center; gap: 6px; margin-bottom: 8px; }
.cc-stat-value { font-family: 'Poppins', sans-serif; font-size: 21px; font-weight: 600; }
.cc-stat-sub { font-size: 11.5px; color: var(--ink-soft); margin-top: 4px; }

.cc-icon-circle { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }

.cc-charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin: 22px 0; }
.cc-charts-grid.cc-full { grid-template-columns: 1fr; }
.cc-chart-title { font-size: 14px; font-weight: 600; margin: 0 0 4px 0; }
.cc-chart-sub { font-size: 12px; color: var(--ink-soft); margin: 0 0 10px 0; }

.cc-rec-list { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.cc-rec-item { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; font-size: 13.5px; line-height: 1.5; }

.cc-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }

.cc-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 15px; border-radius: 8px;
  border: none; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 13.5px;
  cursor: pointer; transition: transform .1s ease, opacity .15s ease; white-space: nowrap;
}
.cc-btn:active { transform: scale(0.97); }
.cc-btn-primary { background: var(--brand); color: #fff; }
.cc-btn-outline { background: transparent; border: 1.5px solid var(--paper-line); color: var(--ink); }
.cc-btn-danger { background: transparent; color: var(--expense); padding: 6px 8px; }
.cc-btn-sm { padding: 6px 10px; font-size: 12.5px; }
.cc-btn:disabled { opacity: .5; cursor: not-allowed; }

.cc-form { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); background: var(--card); padding: 18px; border-radius: 12px; border: 1.5px dashed var(--paper-line); margin-bottom: 18px; }
.cc-form-actions { grid-column: 1 / -1; display: flex; gap: 10px; margin-top: 2px; }
.cc-field { display: flex; flex-direction: column; gap: 5px; }
.cc-field label { font-size: 11.5px; color: var(--ink-soft); font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; }
.cc-input, .cc-select {
  padding: 9px 10px; border: 1px solid var(--paper-line); border-radius: 8px;
  font-family: 'Poppins', sans-serif; font-size: 16px; background: #fff; color: var(--ink); width: 100%;
}
.cc-input:focus, .cc-select:focus { outline: 2px solid var(--brand); outline-offset: 1px; }
.cc-type-toggle { display: flex; gap: 6px; grid-column: 1 / -1; }
.cc-type-btn { flex: 1; padding: 9px; border-radius: 8px; border: 1.5px solid var(--paper-line); background: #fff; cursor: pointer; font-weight: 600; font-size: 13.5px; }
.cc-type-btn.active-gasto { background: var(--expense-soft); border-color: var(--expense); color: var(--expense); }
.cc-type-btn.active-ingreso { background: var(--income-soft); border-color: var(--income); color: var(--income); }

.cc-filters { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.cc-filters select { min-width: 140px; }
.cc-day-filter {
  position: relative; display: flex; align-items: center; min-width: 140px;
  border: 1px solid var(--paper-line); border-radius: 8px; background: #fff; padding: 0 10px;
}
.cc-day-filter input[type="date"] {
  border: none; background: transparent; padding: 9px 0; width: 100%; min-width: 0;
  font-family: 'Poppins', sans-serif; font-size: 16px; color: var(--ink);
}
.cc-day-filter-placeholder {
  position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
  color: var(--ink-soft); font-size: 14px; pointer-events: none; background: #fff;
}
.cc-day-filter-clear {
  border: none; background: transparent; color: var(--ink-soft); cursor: pointer;
  display: flex; align-items: center; padding: 4px;
}

.cc-tx-list { display: flex; flex-direction: column; gap: 8px; }
.cc-tx-row { display: flex; align-items: center; gap: 12px; background: var(--card); padding: 11px 14px; border-radius: 10px; border: 1px solid rgba(32,43,56,0.04); }
.cc-fixed-row { display: flex; flex-direction: column; gap: 10px; background: var(--card); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(46,43,39,0.04); }
.cc-fixed-row-main { display: flex; align-items: flex-start; gap: 12px; }
.cc-fixed-row-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; }
.cc-tx-cat { font-size: 13px; font-weight: 600; }
.cc-tx-note { font-size: 12px; color: var(--ink-soft); }
.cc-tx-date { font-size: 11.5px; color: var(--ink-soft); font-family: 'Poppins', sans-serif; }
.cc-tx-amount { font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 14px; margin-left: auto; }
.cc-tag { display: inline-block; font-size: 11px; padding: 3px 8px; border-radius: 6px; background: var(--paper); color: var(--ink-soft); font-family: 'Poppins', sans-serif; line-height: 1.4; max-width: 100%; }
.cc-tag-fixed { background: var(--debt-soft); color: var(--debt); }
.cc-tag-installment { background: var(--savings-soft); color: var(--savings); }
.cc-tx-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 5px; }
.cc-checkbox-field { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--ink); font-weight: 500; }

.cc-goal-card, .cc-debt-card { background: var(--card); border-radius: 14px; padding: 18px 20px; border: 1px solid rgba(32,43,56,0.04); box-shadow: 0 1px 2px rgba(32,43,56,.05); margin-bottom: 14px; }
.cc-goal-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 10px; }
.cc-goal-name { font-weight: 600; font-size: 15px; }
.cc-goal-meta { font-size: 12px; color: var(--ink-soft); margin-top: 2px; }
.cc-progress-track { width: 100%; height: 9px; border-radius: 99px; background: var(--paper-line); overflow: hidden; margin: 8px 0; }
.cc-progress-fill { height: 100%; border-radius: 99px; }
.cc-goal-nums { display: flex; justify-content: space-between; font-size: 12.5px; font-family: 'Poppins', sans-serif; color: var(--ink-soft); }
.cc-inline-form { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; align-items: center; }
.cc-inline-form input { max-width: 150px; }

.cc-empty { text-align: center; padding: 34px 16px; color: var(--ink-soft); }
.cc-empty svg { margin-bottom: 8px; opacity: 0.5; }
.cc-empty p { margin: 4px 0; font-size: 13.5px; }

.cc-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; width: 100%; gap: 10px; color: var(--ink-soft); }
@keyframes cc-spin { to { transform: rotate(360deg); } }
.cc-spin { animation: cc-spin 1s linear infinite; }

@media (max-width: 860px) {
  .cc-app { flex-direction: column; }
  .cc-sidebar { width: 100%; min-height: auto; flex-direction: column; align-items: stretch; border-right: none; border-bottom: 1px solid var(--paper-line); padding: 12px 14px; gap: 10px; }
  .cc-brand { display: flex; align-items: center; text-align: left; padding: 0 2px; }
  .cc-brand-sub { display: none; }
  .cc-nav { flex-direction: row; flex: none; overflow-x: auto; gap: 2px; }
  .cc-nav-item { border-left: none; border-bottom: 3px solid transparent; white-space: nowrap; }
  .cc-nav-item.active { border-left: none; border-bottom: 3px solid var(--brand); }
  .cc-sidebar-footer { display: none; }
  .cc-main { padding: 20px 16px; }
  .cc-charts-grid { grid-template-columns: 1fr; }
  .cc-form { grid-template-columns: minmax(0, 1fr); }
  .cc-field { min-width: 0; }
  .cc-input, .cc-select { min-width: 0; max-width: 100%; }
}

.cc-fab {
  position: fixed; bottom: calc(20px + env(safe-area-inset-bottom, 0px)); right: 20px;
  width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--brand, #BB4B34); color: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 16px rgba(187,75,52,0.4); z-index: 40; transition: transform 0.15s ease;
}
.cc-fab:hover { transform: scale(1.06); }
.cc-fab:active { transform: scale(0.96); }

@media (prefers-reduced-motion: reduce) {
  .cc-btn, .cc-progress-fill { transition: none !important; }
}

.cc-print-report { display: none; }
.cc-print-sub { color: var(--ink-soft); font-size: 13px; margin: 0 0 20px 0; }
.cc-print-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
.cc-print-table td, .cc-print-table th { padding: 5px 8px; border-bottom: 1px solid #ddd; text-align: left; }
.cc-print-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--ink-soft); }
.cc-print-table td:last-child, .cc-print-table th:last-child { text-align: right; }
.cc-print-list { font-size: 13px; line-height: 1.6; padding-left: 18px; margin-bottom: 20px; }
@media print {
  body * { visibility: hidden; }
  .cc-print-report, .cc-print-report * { visibility: visible; }
  .cc-print-report { display: block; position: absolute; top: 0; left: 0; width: 100%; padding: 10mm; }
  .cc-print-report h1 { font-family: 'Poppins', sans-serif; font-size: 22px; margin: 0 0 4px 0; }
  .cc-print-report h2 { font-family: 'Poppins', sans-serif; font-size: 15px; margin: 22px 0 8px 0; }
}
`;

/* ============================== COMPONENTES PEQUEÑOS ============================== */

function Logo({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="36" fill="none" stroke="#BB4B34" strokeWidth="6" />
      <path d="M 14 50 A 36 36 0 0 0 86 50 Z" fill="#BB4B34" />
      <line x1="9" y1="50" x2="91" y2="50" stroke="#F4F1EA" strokeWidth="5" />
    </svg>
  );
}

function IconCircle({ Icon, color, bg, size = 30, iconSize = 15 }) {
  return (
    <div className="cc-icon-circle" style={{ width: size, height: size, background: bg }}>
      <Icon size={iconSize} color={color} strokeWidth={2.2} />
    </div>
  );
}

function StatCard({ label, value, Icon, color, bg, sub }) {
  return (
    <div className="cc-card">
      <div className="cc-stat-label">
        <IconCircle Icon={Icon} color={color} bg={bg} />
        {label}
      </div>
      <div className="cc-stat-value">{value}</div>
      {sub ? <div className="cc-stat-sub">{sub}</div> : null}
    </div>
  );
}

function RecCard({ kind, text }) {
  const map = {
    warning: { Icon: AlertTriangle, color: COLORS.expense, bg: 'var(--expense-soft)' },
    tip: { Icon: TrendingUp, color: COLORS.savings, bg: 'var(--savings-soft)' },
    success: { Icon: Check, color: COLORS.income, bg: 'var(--income-soft)' },
  };
  const cfg = map[kind] || map.tip;
  return (
    <div className="cc-rec-item" style={{ background: cfg.bg, color: cfg.color }}>
      <cfg.Icon size={16} style={{ marginTop: 2, flexShrink: 0 }} />
      <span style={{ color: 'var(--ink)' }}>{text}</span>
    </div>
  );
}

function EmptyState({ Icon, title, text }) {
  return (
    <div className="cc-empty">
      <Icon size={30} />
      <p style={{ fontWeight: 600, color: 'var(--ink)' }}>{title}</p>
      <p>{text}</p>
    </div>
  );
}

function Sidebar({ activeTab, onChangeTab, onReset, onSignOut, userEmail }) {
  const items = [
    { id: 'resumen', label: 'Resumen', Icon: LayoutDashboard },
    { id: 'movimientos', label: 'Movimientos', Icon: ArrowLeftRight },
    { id: 'gastosfijos', label: 'Gastos fijos', Icon: Repeat },
    { id: 'tarjetas', label: 'Tarjetas', Icon: Landmark },
    { id: 'deudas', label: 'Deudas', Icon: CreditCard },
    { id: 'ahorros', label: 'Ahorros', Icon: PiggyBank },
    { id: 'configuracion', label: 'Configuración', Icon: Settings },
  ];
  return (
    <div className="cc-sidebar">
      <div className="cc-brand">
        <span className="cc-brand-logo" aria-hidden="true"><Logo size={26} /></span>
        <div>
          <div className="cc-brand-title">AlDía</div>
          <div className="cc-brand-sub">tu día a día financiero</div>
        </div>
      </div>
      <div className="cc-nav">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            className={`cc-nav-item ${activeTab === it.id ? 'active' : ''}`}
            onClick={() => onChangeTab(it.id)}
          >
            <it.Icon size={17} />
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ============================== APP PRINCIPAL ============================== */

export default function CuentaClaraApp() {
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data?.user?.email || ''));
  }, []);

  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [creditCards, setCreditCards] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [categoryLabels, setCategoryLabels] = useState({});
  categoryLabelOverrides = categoryLabels;
  const [customCategories, setCustomCategories] = useState([]);
  customCategoriesOverride = customCategories;
  const [monthStartDay, setMonthStartDay] = useState(1);
  monthStartDayOverride = monthStartDay;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());

  const [showTxForm, setShowTxForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState(null);
  const [txForm, setTxForm] = useState({ type: 'gasto', amount: '', category: 'alimentacion', date: todayStr(), note: '', paymentMethod: 'efectivo', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
  const [txFilters, setTxFilters] = useState({ type: 'todos', month: 'todos', category: 'todas', paymentMethod: 'todos', fixed: 'todos', day: '' });

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
  const [paymentInputs, setPaymentInputs] = useState({});

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ name: '', targetAmount: '', targetDate: '', initialAmount: '' });
  const [contributionInputs, setContributionInputs] = useState({});

  const [pinForm, setPinForm] = useState({ newPin: '', confirmPin: '' });
  const [pinMessage, setPinMessage] = useState(null); // { kind: 'success' | 'error', text }
  const [configTab, setConfigTab] = useState('categorias');
  const [newCatGasto, setNewCatGasto] = useState({ label: '', iconKey: ICON_CHOICES[0].key, color: COLOR_CHOICES[0] });
  const [newCatIngreso, setNewCatIngreso] = useState({ label: '', iconKey: ICON_CHOICES[0].key, color: COLOR_CHOICES[0] });

  /* ---------- Carga inicial ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await getItem(STORAGE_KEY);
        if (res && res.value) {
          const data = JSON.parse(res.value);
          setTransactions(data.transactions || []);
          setDebts((data.debts || []).map((d) => ({ ...d, payments: d.payments || [] })));
          setSavingsGoals((data.savingsGoals || []).map((g) => ({ ...g, contributions: g.contributions || [] })));
          setCreditCards(data.creditCards || []);
          setFixedExpenses(data.fixedExpenses || []);
          setCategoryLabels(data.categoryLabels || {});
          setCustomCategories(data.customCategories || []);
          const loadedStartDay = data.monthStartDay || 1;
          monthStartDayOverride = loadedStartDay;
          setMonthStartDay(loadedStartDay);
          setSelectedMonth(monthKeyFromDate(todayStr()));
        } else {
          setTransactions([]);
          setDebts([]);
          setSavingsGoals([]);
          setCreditCards([]);
          setFixedExpenses([]);
        }
      } catch (err) {
        // No hay datos guardados todavía; se empieza con la app vacía.
        setTransactions([]);
        setDebts([]);
        setSavingsGoals([]);
        setCreditCards([]);
        setFixedExpenses([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- Guardado automático ---------- */
  useEffect(() => {
    if (loading) return;
    (async () => {
      try {
        await setItem(STORAGE_KEY, JSON.stringify({ transactions, debts, savingsGoals, creditCards, categoryLabels, customCategories, monthStartDay, fixedExpenses }));
        setSaveError(false);
      } catch (err) {
        setSaveError(true);
      }
    })();
  }, [transactions, debts, savingsGoals, creditCards, categoryLabels, customCategories, monthStartDay, fixedExpenses, loading]);

  /* ---------- Datos derivados ---------- */
  const monthsWindow = useMemo(() => getLastMonthKeys(6, currentMonthKey()), []);

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
  }, [transactions, selectedMonth, categoryLabels, customCategories]);

  const equityEvolution = useMemo(() => monthsWindow.map((key) => {
    const ahorro = savingsGoals.reduce((sum, g) => sum + g.contributions.filter((c) => monthKeyFromDate(c.date) <= key).reduce((s, c) => s + c.amount, 0), 0);
    const deuda = debts.reduce((sum, d) => {
      if (monthKeyFromDate(d.startDate) > key) return sum;
      const paid = d.payments.filter((p) => monthKeyFromDate(p.date) <= key).reduce((s, p) => s + p.amount, 0);
      return sum + Math.max(0, parseFloat(d.totalAmount) - paid);
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
    const enteredAmount = parseFloat(txForm.amount);
    if (!enteredAmount || enteredAmount <= 0) return;
    const isGasto = txForm.type === 'gasto';
    const isCredito = isGasto && txForm.paymentMethod === 'credito';
    const isCreditoConCuotas = isCredito && txForm.isInstallment;
    const isUSD = isCredito && txSelectedCard?.currency === 'USD';
    const rate = isUSD ? (txForm.exchangeRate !== '' ? parseFloat(txForm.exchangeRate) : (usdRate || 0)) : 1;
    if (isUSD && !rate) return; // sin tasa de cambio disponible todavía
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
    setTxForm({ type: 'gasto', amount: '', category: EXPENSE_CATEGORIES[0].id, date: todayStr(), note: '', paymentMethod: 'efectivo', cardId: '', isFixed: false, isInstallment: false, totalInstallments: '', currentInstallment: '1', interestRate: '', exchangeRate: '' });
  }
  function handleDeleteTransaction(id) { setTransactions((prev) => prev.filter((t) => t.id !== id)); }
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
    setShowTxForm(true);
  }

  function handleAddDebt(e) {
    e.preventDefault();
    const total = parseFloat(debtForm.totalAmount);
    if (!debtForm.name.trim() || !total || total <= 0) return;
    const isUSD = debtForm.currency === 'USD';
    const rate = isUSD ? (debtForm.exchangeRate !== '' ? parseFloat(debtForm.exchangeRate) : (usdRate || 0)) : 1;
    if (isUSD && !rate) return;
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
  function handleDeleteDebt(id) { setDebts((prev) => prev.filter((d) => d.id !== id)); }
  function handleAddPayment(debtId) {
    const amt = parseFloat(paymentInputs[debtId]);
    if (!amt || amt <= 0) return;
    const debt = debts.find((d) => d.id === debtId);
    setDebts((prev) => prev.map((d) => (d.id === debtId ? { ...d, payments: [...d.payments, { id: uid(), amount: amt, date: todayStr() }] } : d)));
    setTransactions((prev) => [...prev, { id: uid(), type: 'gasto', category: 'deudas', amount: amt, date: todayStr(), note: debt ? `Abono a ${debt.name}` : 'Abono a deuda', paymentMethod: 'debito', cardId: null, isFixed: false }]);
    setPaymentInputs((prev) => ({ ...prev, [debtId]: '' }));
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
  function handleDeleteGoal(id) { setSavingsGoals((prev) => prev.filter((g) => g.id !== id)); }
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
  function handleDeleteCard(id) { setCreditCards((prev) => prev.filter((c) => c.id !== id)); }

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
    setCategoryLabels((prev) => {
      const next = { ...prev };
      if (!trimmed || trimmed === original.label) {
        delete next[id];
      } else {
        next[id] = trimmed;
      }
      return next;
    });
  }

  function handleAddCustomCategory(type) {
    const form = type === 'gasto' ? newCatGasto : newCatIngreso;
    if (!form.label.trim()) return;
    const newCat = { id: `custom-${uid()}`, type, label: form.label.trim(), iconKey: form.iconKey, color: form.color };
    setCustomCategories((prev) => [...prev, newCat]);
    const reset = { label: '', iconKey: ICON_CHOICES[0].key, color: COLOR_CHOICES[0] };
    if (type === 'gasto') setNewCatGasto(reset); else setNewCatIngreso(reset);
  }
  function handleDeleteCustomCategory(id) {
    if (!window.confirm('¿Eliminar esta categoría? Los movimientos que ya la usan se mostrarán como "Otros".')) return;
    setCustomCategories((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleSetPin(e) {
    e.preventDefault();
    setPinMessage(null);
    if (!/^\d{6}$/.test(pinForm.newPin)) {
      setPinMessage({ kind: 'error', text: 'El PIN debe tener exactamente 6 dígitos.' });
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinMessage({ kind: 'error', text: 'Los dos PIN no coinciden.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pinForm.newPin });
    if (error) {
      setPinMessage({ kind: 'error', text: error.message });
    } else {
      setPinForm({ newPin: '', confirmPin: '' });
      setPinMessage({ kind: 'success', text: 'Listo, tu PIN quedó configurado. La próxima vez entra con él.' });
    }
  }

  function handleResetAll() {
    if (!window.confirm('¿Seguro que quieres borrar todos tus datos financieros? Esta acción no se puede deshacer.')) return;
    setTransactions([]);
    setDebts([]);
    setSavingsGoals([]);
    setCreditCards([]);
  }

  /* ---------- Render: Resumen ---------- */
  function renderResumen() {
    return (
      <>
        <div className="cc-page-title">Resumen</div>
        <p className="cc-page-sub">Tu balance general y cómo ha evolucionado mes a mes.</p>

        <div className="cc-section-head">
          <div className="cc-stamp" style={{ color: status.color }}>
            <status.Icon size={16} /> {status.label}
          </div>
          <select className="cc-select" style={{ maxWidth: 160 }} value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
            {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => window.print()}>
            <Landmark size={13} /> Descargar reporte (PDF)
          </button>
        </div>

        <div className="cc-stats-grid">
          <StatCard label="Ingresos del mes" value={fmtCOP(selMonthIncome)} Icon={TrendingUp} color={COLORS.income} bg="var(--income-soft)" />
          <StatCard label="Gastos del mes" value={fmtCOP(selMonthExpense)} Icon={TrendingDown} color={COLORS.expense} bg="var(--expense-soft)" />
          <StatCard label="Gastos fijos" value={fmtCOP(selMonthFixed)} Icon={Landmark} color={COLORS.debt} bg="var(--debt-soft)" sub={selMonthExpense > 0 ? `${((selMonthFixed / selMonthExpense) * 100).toFixed(0)}% del gasto del mes` : undefined} />
          <StatCard label="Gastos variables" value={fmtCOP(selMonthVariable)} Icon={ShoppingBag} color={COLORS.savings} bg="var(--savings-soft)" />
          <StatCard label="Saldo en caja (total)" value={fmtCOP(cashBalance)} Icon={Wallet} color={COLORS.ink} bg="var(--paper)" sub="Ingresos - gastos, histórico" />
          <StatCard label="Ahorro total" value={fmtCOP(totalSavings)} Icon={PiggyBank} color={COLORS.savings} bg="var(--savings-soft)" />
          <StatCard label="Deuda pendiente" value={fmtCOP(totalDebtRemaining)} Icon={CreditCard} color={COLORS.debt} bg="var(--debt-soft)" />
          <StatCard label="Cargado a tarjetas (histórico)" value={fmtCOP(totalCardSpendCOP)} Icon={Landmark} color={COLORS.debt} bg="var(--debt-soft)" sub="Incluye tarjetas en USD, ya convertidas a COP" />
          <StatCard label="Patrimonio neto" value={fmtCOP(netWorth)} Icon={LayoutDashboard} color={COLORS.ink} bg="var(--paper)" sub="Caja + ahorro - deuda" />
        </div>

        <div className="cc-charts-grid">
          <div className="cc-card">
            <p className="cc-chart-title">Ingresos vs. gastos</p>
            <p className="cc-chart-sub">Últimos 6 meses</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyIncomeExpense} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={46} />
                <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill={COLORS.income} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Gastos" fill={COLORS.expense} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="cc-card">
            <p className="cc-chart-title">Gastos por categoría</p>
            <p className="cc-chart-sub">{monthLabel(selectedMonth)}</p>
            {pieData.length === 0 ? (
              <EmptyState Icon={ShoppingBag} title="Sin gastos este mes" text="Registra un gasto para ver la distribución." />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={88} paddingAngle={2}>
                    {pieData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11.5 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="cc-card" style={{ gridColumn: '1 / -1' }}>
            <p className="cc-chart-title">Ahorro acumulado vs. deuda pendiente</p>
            <p className="cc-chart-sub">Últimos 6 meses</p>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={equityEvolution} margin={{ top: 6, right: 6, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.inkSoft }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.inkSoft }} axisLine={false} tickLine={false} tickFormatter={fmtShort} width={46} />
                <Tooltip formatter={(v) => fmtCOP(v)} contentStyle={{ fontFamily: 'Poppins', fontSize: 13, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Ahorro" stroke={COLORS.income} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Deuda" stroke={COLORS.debt} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="cc-card">
          <p className="cc-chart-title">Recomendaciones para este mes</p>
          <div className="cc-rec-list">
            {recommendations.length === 0
              ? <EmptyState Icon={Check} title="Todo en orden" text="No tenemos ninguna alerta para ti en este momento." />
              : recommendations.map((r, i) => <RecCard key={i} kind={r.kind} text={r.text} />)}
          </div>
        </div>
      </>
    );
  }

  /* ---------- Render: Movimientos ---------- */
  function renderMovimientos() {
    return (
      <>
        <div className="cc-section-head">
          <div>
            <div className="cc-page-title">Movimientos</div>
            <p className="cc-page-sub" style={{ marginBottom: 0 }}>Todos tus ingresos y gastos registrados.</p>
          </div>
          <button type="button" className="cc-btn cc-btn-primary" onClick={() => (showTxForm ? handleCancelTxForm() : setShowTxForm(true))}>
            {showTxForm ? <X size={15} /> : <Plus size={15} />} {showTxForm ? 'Cancelar' : 'Nuevo movimiento'}
          </button>
        </div>

        {showTxForm && (
          <form className="cc-form" onSubmit={handleAddTransaction}>
            <div className="cc-type-toggle">
              <button type="button" className={`cc-type-btn ${txForm.type === 'gasto' ? 'active-gasto' : ''}`} onClick={() => setTxForm((f) => ({ ...f, type: 'gasto', category: EXPENSE_CATEGORIES[0].id }))}>Gasto</button>
              <button type="button" className={`cc-type-btn ${txForm.type === 'ingreso' ? 'active-ingreso' : ''}`} onClick={() => setTxForm((f) => ({ ...f, type: 'ingreso', category: INCOME_CATEGORIES[0].id }))}>Ingreso</button>
            </div>
            <div className="cc-field">
              <label>
                {txForm.isInstallment
                  ? `Monto total de la compra (${txIsUSD ? 'USD' : 'COP'})`
                  : `Monto (${txIsUSD ? 'USD' : 'COP'})`}
              </label>
              <input className="cc-input" type="number" min="0" step="any" placeholder="50000" value={txForm.amount} onChange={(e) => setTxForm((f) => ({ ...f, amount: e.target.value }))} required />
              {txIsUSD && txForm.amount && txEffectiveRate > 0 && (
                <span className="cc-stat-sub" style={{ fontSize: 11 }}>
                  ≈ {fmtCOP(parseFloat(txForm.amount) * txEffectiveRate)}{txForm.isInstallment && txForm.totalInstallments ? ` en total · cuota ≈ ${fmtCOP((parseFloat(txForm.amount) * txEffectiveRate) / parseInt(txForm.totalInstallments, 10))}` : ''}
                </span>
              )}
              {!txIsUSD && txForm.isInstallment && txForm.amount && txForm.totalInstallments && (
                <span className="cc-stat-sub" style={{ fontSize: 11 }}>
                  Cuota mensual ≈ {fmtCOP(parseFloat(txForm.amount) / parseInt(txForm.totalInstallments, 10))}
                </span>
              )}
            </div>
            <div className="cc-field">
              <label>Categoría</label>
              <select className="cc-select" value={txForm.category} onChange={(e) => setTxForm((f) => ({ ...f, category: e.target.value }))}>
                {txFormCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="cc-field">
              <label>Fecha</label>
              <input className="cc-input" type="date" value={txForm.date} onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="cc-field">
              <label>Nota (opcional)</label>
              <input className="cc-input" type="text" placeholder="Detalle breve" value={txForm.note} onChange={(e) => setTxForm((f) => ({ ...f, note: e.target.value }))} />
            </div>
            {txForm.type === 'gasto' && (
              <>
                <div className="cc-field">
                  <label>Medio de pago</label>
                  <select className="cc-select" value={txForm.paymentMethod} onChange={(e) => setTxForm((f) => ({ ...f, paymentMethod: e.target.value, cardId: e.target.value === 'credito' ? f.cardId : '', isInstallment: e.target.value === 'credito' ? f.isInstallment : false }))}>
                    {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                {txForm.paymentMethod === 'credito' && (
                  <>
                    <div className="cc-field">
                      <label>Tarjeta</label>
                      {creditCards.length === 0 ? (
                        <div className="cc-stat-sub">Sin tarjetas registradas. Agrégalas en la pestaña Tarjetas.</div>
                      ) : (
                        <select className="cc-select" value={txForm.cardId} onChange={(e) => setTxForm((f) => ({ ...f, cardId: e.target.value }))}>
                          <option value="">Selecciona una tarjeta</option>
                          {creditCards.map((c) => <option key={c.id} value={c.id}>{c.name} *{c.lastFour}{c.currency === 'USD' ? ' (USD)' : ''}</option>)}
                        </select>
                      )}
                      {txChargeDate && (
                        <span className="cc-stat-sub" style={{ fontSize: 11 }}>Se cobraría el {formatDateHuman(txChargeDate)}</span>
                      )}
                    </div>
                    {txIsUSD && (
                      <div className="cc-field">
                        <label>Tasa de cambio (COP por USD)</label>
                        <input
                          className="cc-input"
                          type="number"
                          min="0"
                          step="any"
                          placeholder={usdRate ? String(Math.round(usdRate)) : 'Ej. 4050'}
                          value={txForm.exchangeRate}
                          onChange={(e) => setTxForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                        />
                        <span className="cc-stat-sub" style={{ fontSize: 11 }}>
                          {usdRate ? `Tasa del día: ≈ ${fmtCOP(usdRate)} por USD. Puedes ajustarla si tu banco usa otra.` : 'No se pudo obtener la tasa automáticamente, ingrésala manualmente.'}
                        </span>
                      </div>
                    )}
                    <div className="cc-field" style={{ justifyContent: 'flex-end' }}>
                      <label className="cc-checkbox-field" style={{ textTransform: 'none' }}>
                        <input type="checkbox" checked={txForm.isInstallment} onChange={(e) => setTxForm((f) => ({ ...f, isInstallment: e.target.checked }))} />
                        Es una compra en cuotas
                      </label>
                    </div>
                    {txForm.isInstallment && (
                      <>
                        <div className="cc-field">
                          <label>Número total de cuotas</label>
                          <input className="cc-input" type="number" min="1" step="1" placeholder="12" value={txForm.totalInstallments} onChange={(e) => setTxForm((f) => ({ ...f, totalInstallments: e.target.value }))} />
                        </div>
                        <div className="cc-field">
                          <label>Cuota actual</label>
                          <input className="cc-input" type="number" min="1" step="1" placeholder="1" value={txForm.currentInstallment} onChange={(e) => setTxForm((f) => ({ ...f, currentInstallment: e.target.value }))} />
                          <span className="cc-stat-sub" style={{ fontSize: 11 }}>Si es una compra vieja y ya vas en la cuota 7 de 10, escribe 7 aquí.</span>
                        </div>
                        <div className="cc-field">
                          <label>Tasa de interés mensual % (opcional)</label>
                          <input className="cc-input" type="number" min="0" step="any" placeholder="2.08" value={txForm.interestRate} onChange={(e) => setTxForm((f) => ({ ...f, interestRate: e.target.value }))} />
                          <span className="cc-stat-sub" style={{ fontSize: 11 }}>Cada compra puede tener su propia tasa, distinta a la de otras compras.</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}
            <div className="cc-form-actions">
              <button type="submit" className="cc-btn cc-btn-primary">{editingTxId ? 'Guardar cambios' : 'Guardar movimiento'}</button>
              {editingTxId && <button type="button" className="cc-btn cc-btn-outline" onClick={handleCancelTxForm}>Cancelar edición</button>}
            </div>
          </form>
        )}

        <div className="cc-filters">
          <select className="cc-select" value={txFilters.type} onChange={(e) => setTxFilters((f) => ({ ...f, type: e.target.value, category: 'todas' }))}>
            <option value="todos">Todos los tipos</option>
            <option value="ingreso">Ingresos</option>
            <option value="gasto">Gastos</option>
          </select>
          <select className="cc-select" value={txFilters.month} onChange={(e) => setTxFilters((f) => ({ ...f, month: e.target.value }))}>
            <option value="todos">Todos los meses</option>
            {availableMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <select className="cc-select" value={txFilters.category} onChange={(e) => setTxFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="todas">Todas las categorías</option>
            {txFilterCategories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className="cc-select" value={txFilters.paymentMethod} onChange={(e) => setTxFilters((f) => ({ ...f, paymentMethod: e.target.value }))}>
            <option value="todos">Todos los medios de pago</option>
            {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <select className="cc-select" value={txFilters.fixed} onChange={(e) => setTxFilters((f) => ({ ...f, fixed: e.target.value }))}>
            <option value="todos">Fijos y variables</option>
            <option value="fijo">Solo fijos</option>
            <option value="variable">Solo variables</option>
          </select>
          <div className="cc-day-filter">
            <input
              type="date"
              value={txFilters.day}
              onChange={(e) => setTxFilters((f) => ({ ...f, day: e.target.value }))}
            />
            {!txFilters.day && <span className="cc-day-filter-placeholder">Filtrar por día</span>}
            {txFilters.day && (
              <button type="button" className="cc-day-filter-clear" onClick={() => setTxFilters((f) => ({ ...f, day: '' }))} aria-label="Quitar filtro de día">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {filteredTx.length === 0 ? (
          <EmptyState Icon={ArrowLeftRight} title="No hay movimientos" text="Agrega tu primer ingreso o gasto para empezar a llevar el registro." />
        ) : (
          <div className="cc-tx-list">
            {filteredTx.map((t) => {
              const cat = getCategory(t.category);
              return (
                <div key={t.id} className="cc-tx-row">
                  <IconCircle Icon={cat.icon} color={cat.color} bg={t.type === 'ingreso' ? 'var(--income-soft)' : 'var(--expense-soft)'} />
                  <div>
                    <div className="cc-tx-cat">{cat.label}</div>
                    <div className="cc-tx-note">
                      {t.note || '—'} · <span className="cc-tx-date">{t.date}</span>
                    </div>
                    {(t.type === 'gasto' && t.paymentMethod) || t.isFixed || t.isInstallment || t.currency === 'USD' ? (
                      <div className="cc-tx-tags">
                        {t.type === 'gasto' && t.paymentMethod && (
                          <span className="cc-tag">{getPaymentMethod(t.paymentMethod).label}{t.cardId ? ` · ${cardLabel(t.cardId)}` : ''}</span>
                        )}
                        {t.isFixed && <span className="cc-tag cc-tag-fixed">Fijo</span>}
                        {t.isInstallment && (
                          <span className="cc-tag cc-tag-installment">
                            Cuota {t.currentInstallment || '?'}/{t.totalInstallments || '?'}
                            {t.interestRate != null ? ` · ${t.interestRate}% mensual` : ''}
                          </span>
                        )}
                        {t.currency === 'USD' && (
                          <span className="cc-tag">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(t.originalAmount || 0)}
                            {t.exchangeRateUsed ? ` · tasa ${fmtCOP(t.exchangeRateUsed)}` : ''}
                          </span>
                        )}
                        {(() => {
                          const c = t.cardId ? creditCards.find((cc) => cc.id === t.cardId) : null;
                          const chargeDate = c && c.cutDay && c.paymentDay ? computeChargeDate(t.date, c.cutDay, c.paymentDay) : null;
                          return chargeDate ? <span className="cc-tag">Se cobra: {formatDateHuman(chargeDate)}</span> : null;
                        })()}
                      </div>
                    ) : null}
                  </div>
                  <div className="cc-tx-amount" style={{ color: t.type === 'ingreso' ? COLORS.income : COLORS.expense }}>
                    {t.type === 'ingreso' ? '+' : '-'}{fmtCOP(t.amount)}
                  </div>
                  <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleEditTransaction(t)} aria-label="Editar movimiento">
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteTransaction(t.id)} aria-label="Eliminar movimiento">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  /* ---------- Render: Gastos fijos ---------- */
  function renderGastosFijos() {
    const totalMensual = fixedExpenses.reduce((s, f) => s + f.amount, 0);
    const pagadosCount = fixedExpenses.filter((f) => findFixedExpensePaidThisMonth(f.id)).length;
    return (
      <>
        <div className="cc-page-title">Gastos fijos</div>
        <p className="cc-page-sub">Tus gastos que se repiten cada mes (gimnasio, mensualidades, suscripciones). Márcalos como pagados en vez de crear un movimiento nuevo cada vez.</p>

        <div className="cc-stats-grid" style={{ marginBottom: 18 }}>
          <StatCard label="Total en gastos fijos" value={fmtCOP(totalMensual)} Icon={Repeat} color={COLORS.debt} bg="var(--debt-soft)" sub={`${fixedExpenses.length} gasto(s) registrados`} />
          <StatCard label="Pagados este mes" value={`${pagadosCount}/${fixedExpenses.length}`} Icon={Check} color={COLORS.income} bg="var(--income-soft)" />
        </div>

        <button type="button" className="cc-btn cc-btn-primary" onClick={() => (showFixedForm ? handleCancelFixedForm() : setShowFixedForm(true))}>
          {showFixedForm ? <X size={15} /> : <Plus size={15} />} {showFixedForm ? 'Cancelar' : 'Nuevo gasto fijo'}
        </button>

        {showFixedForm && (
          <form className="cc-form" onSubmit={handleAddFixedExpense}>
            <div className="cc-field">
              <label>Nombre</label>
              <input className="cc-input" type="text" placeholder="Gimnasio, Netflix, arriendo..." value={fixedForm.name} onChange={(e) => setFixedForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="cc-field">
              <label>Categoría</label>
              <select className="cc-select" value={fixedForm.category} onChange={(e) => setFixedForm((f) => ({ ...f, category: e.target.value }))}>
                {allExpenseCategories.map((c) => <option key={c.id} value={c.id}>{getCategory(c.id).label}</option>)}
              </select>
            </div>
            <div className="cc-field">
              <label>Monto (COP)</label>
              <input className="cc-input" type="number" min="0" step="any" placeholder="50000" value={fixedForm.amount} onChange={(e) => setFixedForm((f) => ({ ...f, amount: e.target.value }))} required />
            </div>
            <div className="cc-field">
              <label>Día de pago (opcional)</label>
              <input className="cc-input" type="number" min="1" max="31" placeholder="5" value={fixedForm.dueDay} onChange={(e) => setFixedForm((f) => ({ ...f, dueDay: e.target.value }))} />
            </div>
            <div className="cc-field">
              <label>Medio de pago</label>
              <select className="cc-select" value={fixedForm.paymentMethod} onChange={(e) => setFixedForm((f) => ({ ...f, paymentMethod: e.target.value, cardId: e.target.value === 'credito' ? f.cardId : '' }))}>
                {PAYMENT_METHODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            {fixedForm.paymentMethod === 'credito' && (
              <div className="cc-field">
                <label>Tarjeta</label>
                {creditCards.length === 0 ? (
                  <div className="cc-stat-sub">Sin tarjetas registradas.</div>
                ) : (
                  <select className="cc-select" value={fixedForm.cardId} onChange={(e) => setFixedForm((f) => ({ ...f, cardId: e.target.value }))}>
                    <option value="">Selecciona una tarjeta</option>
                    {creditCards.map((c) => <option key={c.id} value={c.id}>{c.name} *{c.lastFour}</option>)}
                  </select>
                )}
              </div>
            )}
            <div className="cc-form-actions">
              <button type="submit" className="cc-btn cc-btn-primary">{editingFixedId ? 'Guardar cambios' : 'Guardar gasto fijo'}</button>
              {editingFixedId && <button type="button" className="cc-btn cc-btn-outline" onClick={handleCancelFixedForm}>Cancelar edición</button>}
            </div>
          </form>
        )}

        {fixedExpenses.length === 0 ? (
          <p className="cc-stat-sub">Aún no tienes gastos fijos registrados.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {fixedExpenses.map((fe) => {
              const cat = getCategory(fe.category);
              const paidTx = findFixedExpensePaidThisMonth(fe.id);
              return (
                <div key={fe.id} className="cc-fixed-row">
                  <div className="cc-fixed-row-main">
                    <IconCircle Icon={cat.icon} color={cat.color} bg="var(--expense-soft)" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="cc-tx-cat">{fe.name}</div>
                      <div className="cc-tx-note">
                        {cat.label} · <span className="cc-mono">{fmtCOP(fe.amount)}</span>
                        {fe.dueDay ? ` · paga el día ${fe.dueDay}` : ''}
                      </div>
                      <div className="cc-tx-tags">
                        <span className="cc-tag">{getPaymentMethod(fe.paymentMethod).label}{fe.cardId ? ` · ${cardLabel(fe.cardId)}` : ''}</span>
                        {paidTx && <span className="cc-tag" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}>Pagado este mes ✓</span>}
                      </div>
                    </div>
                  </div>
                  <div className="cc-fixed-row-actions">
                    {paidTx ? (
                      <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleUndoFixedExpensePaid(fe)}>Deshacer</button>
                    ) : (
                      <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleMarkFixedExpensePaid(fe)}>Marcar como pagado</button>
                    )}
                    <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleEditFixedExpense(fe)} aria-label="Editar gasto fijo">
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteFixedExpense(fe.id)} aria-label="Eliminar gasto fijo">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  /* ---------- Render: Tarjetas ---------- */
  function renderTarjetas() {
    return (
      <>
        <div className="cc-section-head">
          <div>
            <div className="cc-page-title">Tarjetas</div>
            <p className="cc-page-sub" style={{ marginBottom: 0 }}>Tus tarjetas de crédito y los movimientos hechos con cada una.</p>
          </div>
          <button type="button" className="cc-btn cc-btn-primary" onClick={() => (showCardForm ? handleCancelCardForm() : setShowCardForm(true))}>
            {showCardForm ? <X size={15} /> : <Plus size={15} />} {showCardForm ? 'Cancelar' : 'Nueva tarjeta'}
          </button>
        </div>

        {showCardForm && (
          <form className="cc-form" onSubmit={handleAddCard}>
            <div className="cc-field">
              <label>Nombre de la tarjeta</label>
              <input className="cc-input" type="text" placeholder="Bancolombia Mastercard" value={cardForm.name} onChange={(e) => setCardForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="cc-field">
              <label>Últimos 4 dígitos</label>
              <input className="cc-input" type="text" inputMode="numeric" maxLength={4} placeholder="1679" value={cardForm.lastFour} onChange={(e) => setCardForm((f) => ({ ...f, lastFour: e.target.value.replace(/\D/g, '').slice(0, 4) }))} required />
            </div>
            <div className="cc-field">
              <label>Moneda</label>
              <select className="cc-select" value={cardForm.currency} onChange={(e) => setCardForm((f) => ({ ...f, currency: e.target.value }))}>
                <option value="COP">Pesos colombianos (COP)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
            <div className="cc-field">
              <label>Día de corte (opcional)</label>
              <input className="cc-input" type="number" min="1" max="31" placeholder="31" value={cardForm.cutDay} onChange={(e) => setCardForm((f) => ({ ...f, cutDay: e.target.value }))} />
            </div>
            <div className="cc-field">
              <label>Día de pago (opcional)</label>
              <input className="cc-input" type="number" min="1" max="31" placeholder="15" value={cardForm.paymentDay} onChange={(e) => setCardForm((f) => ({ ...f, paymentDay: e.target.value }))} />
              <span className="cc-stat-sub" style={{ fontSize: 11 }}>Con estos dos datos calculamos cuándo se cobraría cada compra.</span>
            </div>
            <div className="cc-form-actions">
              <button type="submit" className="cc-btn cc-btn-primary">{editingCardId ? 'Guardar cambios' : 'Guardar tarjeta'}</button>
              {editingCardId && <button type="button" className="cc-btn cc-btn-outline" onClick={handleCancelCardForm}>Cancelar edición</button>}
            </div>
          </form>
        )}

        {creditCards.length === 0 ? (
          <EmptyState Icon={Landmark} title="No tienes tarjetas registradas" text="Agrega tu tarjeta de crédito para ver sus movimientos por separado del resto de tus gastos." />
        ) : (
          creditCards.map((card) => {
            const cardTx = transactions.filter((t) => t.cardId === card.id).sort((a, b) => (a.date < b.date ? 1 : -1));
            const monthTotal = cardTx.filter((t) => monthKeyFromDate(t.date) === selectedMonth).reduce((s, t) => s + t.amount, 0);
            const historicTotal = cardTx.filter((t) => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
            const installmentTx = cardTx.filter((t) => t.isInstallment && t.totalInstallments);
            const groupIds = [...new Set(installmentTx.map((t) => t.installmentGroupId || t.id))];
            const installmentGroups = groupIds.map((gid) => {
              const entries = installmentTx.filter((t) => (t.installmentGroupId || t.id) === gid).sort((a, b) => (a.currentInstallment || 0) - (b.currentInstallment || 0));
              return entries[entries.length - 1];
            });
            return (
              <div key={card.id} className="cc-card" style={{ marginBottom: 16 }}>
                <div className="cc-goal-head">
                  <div>
                    <div className="cc-goal-name">{card.name}</div>
                    <div className="cc-goal-meta">Terminada en {card.lastFour}{card.currency === 'USD' ? ' · USD' : ''} · {cardTx.length} movimientos registrados</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleEditCard(card)} aria-label="Editar tarjeta"><Pencil size={14} /></button>
                    <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteCard(card.id)} aria-label="Eliminar tarjeta"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="cc-stat-sub" style={{ marginBottom: 12 }}>
                  Gastado en {monthLabel(selectedMonth)}: <span className="cc-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtCOP(monthTotal)}</span>
                  {' · '}Histórico: <span className="cc-mono" style={{ fontWeight: 600, color: 'var(--ink)' }}>{fmtCOP(historicTotal)}</span>
                  {card.currency === 'USD' ? ' (convertido a COP)' : ''}
                </div>

                {installmentGroups.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Compras en cuotas activas</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {installmentGroups.map((t) => {
                        const remainingCuotas = Math.max(0, (t.totalInstallments || 0) - (t.currentInstallment || 0));
                        const remainingAmount = remainingCuotas * t.amount;
                        const pct = t.totalInstallments ? Math.min(100, Math.round(((t.currentInstallment || 0) / t.totalInstallments) * 100)) : 0;
                        const groupId = t.installmentGroupId || t.id;
                        const key = monthKeyFromDate(todayStr());
                        const group = t.installmentGroupId ? getInstallmentGroup(t.installmentGroupId) : [t];
                        const paidThisMonth = group.some((g) => monthKeyFromDate(g.date) === key);
                        const completed = t.totalInstallments && t.currentInstallment >= t.totalInstallments;
                        return (
                          <div key={groupId} style={{ background: 'var(--paper)', borderRadius: 10, padding: '10px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                              <span style={{ fontWeight: 600 }}>{t.note || getCategory(t.category).label}</span>
                              <span className="cc-mono">Cuota {t.currentInstallment}/{t.totalInstallments}</span>
                            </div>
                            <div style={{ height: 6, borderRadius: 99, background: 'var(--paper-line)', overflow: 'hidden', marginBottom: 6 }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: COLORS.savings, borderRadius: 99 }} />
                            </div>
                            <div className="cc-stat-sub" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span>{fmtCOP(t.amount)}/mes{t.interestRate != null ? ` · ${t.interestRate}% mensual` : ''}</span>
                              <span>Faltan {remainingCuotas} cuotas (~{fmtCOP(remainingAmount)})</span>
                            </div>
                            {completed ? (
                              <span className="cc-tag" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}>Completada ✓</span>
                            ) : paidThisMonth ? (
                              <span className="cc-tag" style={{ background: 'var(--income-soft)', color: 'var(--income)' }}>Cuota de este mes ya registrada ✓</span>
                            ) : (
                              <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleRegisterNextInstallment(groupId)}>
                                Registrar cuota {t.currentInstallment + 1} de este mes
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {cardTx.length === 0 ? (
                  <EmptyState Icon={CreditCard} title="Sin movimientos" text="Los gastos que registres con esta tarjeta aparecerán aquí." />
                ) : (
                  <div className="cc-tx-list">
                    {cardTx.map((t) => {
                      const cat = getCategory(t.category);
                      return (
                        <div key={t.id} className="cc-tx-row">
                          <IconCircle Icon={cat.icon} color={cat.color} bg="var(--expense-soft)" />
                          <div>
                            <div className="cc-tx-cat">{cat.label}</div>
                            <div className="cc-tx-note">
                              {t.note || '—'} · <span className="cc-tx-date">{t.date}</span>
                            </div>
                            {(t.isFixed || t.isInstallment) && (
                              <div className="cc-tx-tags">
                                {t.isFixed && <span className="cc-tag cc-tag-fixed">Fijo</span>}
                                {t.isInstallment && (
                                  <span className="cc-tag cc-tag-installment">
                                    Cuota {t.currentInstallment || '?'}/{t.totalInstallments || '?'}
                                    {t.interestRate != null ? ` · ${t.interestRate}% mensual` : ''}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="cc-tx-amount" style={{ color: COLORS.expense }}>-{fmtCOP(t.amount)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </>
    );
  }

  /* ---------- Render: Deudas ---------- */
  function renderDeudas() {
    return (
      <>
        <div className="cc-section-head">
          <div>
            <div className="cc-page-title">Deudas</div>
            <p className="cc-page-sub" style={{ marginBottom: 0 }}>Lo que debes y cómo vas pagándolo.</p>
          </div>
          <button type="button" className="cc-btn cc-btn-primary" onClick={() => setShowDebtForm((v) => !v)}>
            {showDebtForm ? <X size={15} /> : <Plus size={15} />} {showDebtForm ? 'Cancelar' : 'Nueva deuda'}
          </button>
        </div>

        {showDebtForm && (
          <form className="cc-form" onSubmit={handleAddDebt}>
            <div className="cc-field" style={{ gridColumn: 'span 2' }}>
              <label>Nombre</label>
              <input className="cc-input" type="text" placeholder="Tarjeta de crédito, préstamo..." value={debtForm.name} onChange={(e) => setDebtForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="cc-field">
              <label>Moneda</label>
              <select className="cc-select" value={debtForm.currency} onChange={(e) => setDebtForm((f) => ({ ...f, currency: e.target.value }))}>
                <option value="COP">Pesos colombianos (COP)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
            <div className="cc-field">
              <label>Monto total ({debtForm.currency})</label>
              <input className="cc-input" type="number" min="0" step="any" value={debtForm.totalAmount} onChange={(e) => setDebtForm((f) => ({ ...f, totalAmount: e.target.value }))} required />
            </div>
            {debtForm.currency === 'USD' && (
              <div className="cc-field">
                <label>Tasa de cambio (COP por USD)</label>
                <input
                  className="cc-input"
                  type="number"
                  min="0"
                  step="any"
                  placeholder={usdRate ? String(Math.round(usdRate)) : 'Ej. 4050'}
                  value={debtForm.exchangeRate}
                  onChange={(e) => setDebtForm((f) => ({ ...f, exchangeRate: e.target.value }))}
                />
                <span className="cc-stat-sub" style={{ fontSize: 11 }}>
                  {usdRate ? `Tasa del día: ≈ ${fmtCOP(usdRate)} por USD. Se usa para mostrar esta deuda junto a las demás en COP.` : 'Ingrésala manualmente.'}
                </span>
              </div>
            )}
            <div className="cc-field">
              <label>Tasa de interés (% mensual)</label>
              <input className="cc-input" type="number" min="0" step="any" placeholder="Opcional" value={debtForm.interestRate} onChange={(e) => setDebtForm((f) => ({ ...f, interestRate: e.target.value }))} />
            </div>
            <div className="cc-field">
              <label>Cuota mensual ({debtForm.currency})</label>
              <input className="cc-input" type="number" min="0" step="any" placeholder="Opcional" value={debtForm.monthlyPayment} onChange={(e) => setDebtForm((f) => ({ ...f, monthlyPayment: e.target.value }))} />
            </div>
            <div className="cc-field">
              <label>Día de pago del mes</label>
              <input className="cc-input" type="number" min="1" max="31" placeholder="Opcional" value={debtForm.dueDay} onChange={(e) => setDebtForm((f) => ({ ...f, dueDay: e.target.value }))} />
            </div>
            <div className="cc-field">
              <label>Fecha en que adquiriste la deuda</label>
              <input className="cc-input" type="date" value={debtForm.startDate} onChange={(e) => setDebtForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div className="cc-form-actions">
              <button type="submit" className="cc-btn cc-btn-primary">Guardar deuda</button>
            </div>
          </form>
        )}

        {debts.length === 0 ? (
          <EmptyState Icon={CreditCard} title="No tienes deudas registradas" text="Agrega una deuda para hacerle seguimiento a tus abonos y al interés que genera." />
        ) : (
          debts.map((d) => {
            const paid = d.payments.reduce((s, p) => s + p.amount, 0);
            const remaining = Math.max(0, parseFloat(d.totalAmount) - paid);
            const pct = Math.min(100, (paid / parseFloat(d.totalAmount)) * 100);
            const isUSD = d.currency === 'USD';
            return (
              <div key={d.id} className="cc-debt-card">
                <div className="cc-goal-head">
                  <div>
                    <div className="cc-goal-name">{d.name}{isUSD ? ' · USD' : ''}</div>
                    <div className="cc-goal-meta">
                      {d.interestRate ? `${d.interestRate}% mensual · ` : ''}
                      {d.monthlyPayment ? `cuota ${fmtMoney(d.monthlyPayment, d.currency)} · ` : ''}
                      {d.dueDay ? `paga el día ${d.dueDay}` : 'sin fecha de pago fija'}
                    </div>
                  </div>
                  <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteDebt(d.id)} aria-label="Eliminar deuda"><Trash2 size={15} /></button>
                </div>
                <div className="cc-progress-track"><div className="cc-progress-fill" style={{ width: `${pct}%`, background: COLORS.debt }} /></div>
                <div className="cc-goal-nums">
                  <span>Pagado: {fmtMoney(paid, d.currency)}</span>
                  <span>Restante: {fmtMoney(remaining, d.currency)}</span>
                  <span>Total: {fmtMoney(d.totalAmount, d.currency)}</span>
                </div>
                {isUSD && (
                  <div className="cc-stat-sub" style={{ marginTop: 4 }}>
                    ≈ {fmtCOP(debtRemainingCOP(d))} restante en pesos (tasa {fmtCOP(d.exchangeRate)}/USD)
                  </div>
                )}
                <div className="cc-inline-form">
                  <input className="cc-input" type="number" min="0" step="any" placeholder={`Monto del abono (${d.currency})`} value={paymentInputs[d.id] || ''} onChange={(e) => setPaymentInputs((p) => ({ ...p, [d.id]: e.target.value }))} />
                  <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleAddPayment(d.id)}>Registrar abono</button>
                </div>
              </div>
            );
          })
        )}
      </>
    );
  }

  /* ---------- Render: Ahorros ---------- */
  function renderAhorros() {
    return (
      <>
        <div className="cc-section-head">
          <div>
            <div className="cc-page-title">Ahorros</div>
            <p className="cc-page-sub" style={{ marginBottom: 0 }}>Tus metas y cuánto llevas acumulado.</p>
          </div>
          <button type="button" className="cc-btn cc-btn-primary" onClick={() => setShowGoalForm((v) => !v)}>
            {showGoalForm ? <X size={15} /> : <Plus size={15} />} {showGoalForm ? 'Cancelar' : 'Nueva meta'}
          </button>
        </div>

        {showGoalForm && (
          <form className="cc-form" onSubmit={handleAddGoal}>
            <div className="cc-field" style={{ gridColumn: 'span 2' }}>
              <label>Nombre de la meta</label>
              <input className="cc-input" type="text" placeholder="Fondo de emergencia, viaje..." value={goalForm.name} onChange={(e) => setGoalForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="cc-field">
              <label>Monto objetivo (opcional)</label>
              <input className="cc-input" type="number" min="0" step="any" placeholder="Déjalo vacío si no tienes un monto fijo" value={goalForm.targetAmount} onChange={(e) => setGoalForm((f) => ({ ...f, targetAmount: e.target.value }))} />
              <span className="cc-stat-sub" style={{ fontSize: 11 }}>Déjalo vacío si solo quieres ir ahorrando sin un monto fijo en mente.</span>
            </div>
            <div className="cc-field">
              <label>Fecha meta (opcional)</label>
              <input className="cc-input" type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm((f) => ({ ...f, targetDate: e.target.value }))} />
            </div>
            <div className="cc-field">
              <label>Ya tenías ahorrado (opcional)</label>
              <input className="cc-input" type="number" min="0" step="any" placeholder="0" value={goalForm.initialAmount} onChange={(e) => setGoalForm((f) => ({ ...f, initialAmount: e.target.value }))} />
              <span className="cc-stat-sub" style={{ fontSize: 11 }}>Si ya venías ahorrando para esto por tu cuenta, pon ese monto aquí para que la meta arranque desde ahí.</span>
            </div>
            <div className="cc-form-actions">
              <button type="submit" className="cc-btn cc-btn-primary">Guardar meta</button>
            </div>
          </form>
        )}

        {savingsGoals.length === 0 ? (
          <EmptyState Icon={PiggyBank} title="Aún no tienes metas de ahorro" text="Crea una meta, así podrás ver tu progreso mes a mes." />
        ) : (
          savingsGoals.map((g) => {
            const saved = Math.max(0, g.contributions.reduce((s, c) => s + c.amount, 0));
            const hasTarget = g.targetAmount != null && g.targetAmount > 0;
            const pct = hasTarget ? Math.min(100, (saved / parseFloat(g.targetAmount)) * 100) : null;
            return (
              <div key={g.id} className="cc-goal-card">
                <div className="cc-goal-head">
                  <div>
                    <div className="cc-goal-name">{g.name}</div>
                    <div className="cc-goal-meta">
                      {hasTarget ? (g.targetDate ? `Meta para ${g.targetDate}` : 'Sin fecha límite') : 'Ahorro abierto, sin monto objetivo'}
                    </div>
                  </div>
                  <button type="button" className="cc-btn cc-btn-danger" onClick={() => handleDeleteGoal(g.id)} aria-label="Eliminar meta"><Trash2 size={15} /></button>
                </div>
                {hasTarget ? (
                  <>
                    <div className="cc-progress-track"><div className="cc-progress-fill" style={{ width: `${pct}%`, background: COLORS.savings }} /></div>
                    <div className="cc-goal-nums">
                      <span>Ahorrado: {fmtCOP(saved)}</span>
                      <span>{pct.toFixed(0)}%</span>
                      <span>Meta: {fmtCOP(g.targetAmount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="cc-goal-nums" style={{ justifyContent: 'flex-start' }}>
                    <span>Ahorrado hasta ahora: <strong className="cc-mono">{fmtCOP(saved)}</strong></span>
                  </div>
                )}
                <div className="cc-inline-form">
                  <input className="cc-input" type="number" min="0" step="any" placeholder="Monto" value={contributionInputs[g.id] || ''} onChange={(e) => setContributionInputs((p) => ({ ...p, [g.id]: e.target.value }))} />
                  <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleContribution(g.id, 1)}>Aportar</button>
                  <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => handleContribution(g.id, -1)}>Retirar</button>
                </div>
              </div>
            );
          })
        )}
      </>
    );
  }

  /* ---------- Render: Configuración ---------- */
  function renderConfiguracion() {
    const subTabs = [
      { id: 'categorias', label: 'Categorías' },
      { id: 'periodo', label: 'Mes financiero' },
      { id: 'pin', label: 'PIN de acceso' },
      { id: 'datos', label: 'Datos y sesión' },
    ];
    return (
      <>
        <div className="cc-page-title">Configuración</div>
        <p className="cc-page-sub">Personaliza tus categorías, tu PIN de acceso y administra tus datos.</p>

        <div className="cc-subtabs">
          {subTabs.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`cc-subtab ${configTab === s.id ? 'active' : ''}`}
              onClick={() => setConfigTab(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {configTab === 'categorias' && (
          <>
            <div className="cc-card" style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Categorías de gasto</div>
              <p className="cc-stat-sub" style={{ marginBottom: 12 }}>Las categorías originales se pueden renombrar pero no borrar. Las que agregues tú se pueden borrar.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {allExpenseCategories.map((c) => {
                  const resolved = getCategory(c.id);
                  const isCustom = c.id.startsWith('custom-');
                  return (
                    <div key={c.id} className="cc-inline-form" style={{ marginTop: 0 }}>
                      <IconCircle Icon={resolved.icon} color={resolved.color} bg="var(--expense-soft)" size={28} iconSize={14} />
                      <input
                        className="cc-input"
                        type="text"
                        defaultValue={resolved.label}
                        onBlur={(e) => handleUpdateCategoryLabel(c.id, e.target.value)}
                        style={{ maxWidth: 220 }}
                      />
                      {isCustom && (
                        <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={() => handleDeleteCustomCategory(c.id)} aria-label="Eliminar categoría">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: '1px dashed var(--paper-line)', paddingTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Agregar categoría de gasto</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input className="cc-input" type="text" placeholder="Nombre" value={newCatGasto.label} onChange={(e) => setNewCatGasto((f) => ({ ...f, label: e.target.value }))} style={{ maxWidth: 160 }} />
                  <select className="cc-select" value={newCatGasto.iconKey} onChange={(e) => setNewCatGasto((f) => ({ ...f, iconKey: e.target.value }))} style={{ maxWidth: 150 }}>
                    {ICON_CHOICES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {COLOR_CHOICES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCatGasto((f) => ({ ...f, color }))}
                        style={{ width: 20, height: 20, borderRadius: 99, background: color, border: newCatGasto.color === color ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer' }}
                        aria-label={`Color ${color}`}
                      />
                    ))}
                  </div>
                  <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleAddCustomCategory('gasto')}>
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              </div>
            </div>

            <div className="cc-card">
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Categorías de ingreso</div>
              <p className="cc-stat-sub" style={{ marginBottom: 12 }}>Las categorías originales se pueden renombrar pero no borrar. Las que agregues tú se pueden borrar.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                {allIncomeCategories.map((c) => {
                  const resolved = getCategory(c.id);
                  const isCustom = c.id.startsWith('custom-');
                  return (
                    <div key={c.id} className="cc-inline-form" style={{ marginTop: 0 }}>
                      <IconCircle Icon={resolved.icon} color={resolved.color} bg="var(--income-soft)" size={28} iconSize={14} />
                      <input
                        className="cc-input"
                        type="text"
                        defaultValue={resolved.label}
                        onBlur={(e) => handleUpdateCategoryLabel(c.id, e.target.value)}
                        style={{ maxWidth: 220 }}
                      />
                      {isCustom && (
                        <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={() => handleDeleteCustomCategory(c.id)} aria-label="Eliminar categoría">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{ borderTop: '1px dashed var(--paper-line)', paddingTop: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Agregar categoría de ingreso</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input className="cc-input" type="text" placeholder="Nombre" value={newCatIngreso.label} onChange={(e) => setNewCatIngreso((f) => ({ ...f, label: e.target.value }))} style={{ maxWidth: 160 }} />
                  <select className="cc-select" value={newCatIngreso.iconKey} onChange={(e) => setNewCatIngreso((f) => ({ ...f, iconKey: e.target.value }))} style={{ maxWidth: 150 }}>
                    {ICON_CHOICES.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {COLOR_CHOICES.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCatIngreso((f) => ({ ...f, color }))}
                        style={{ width: 20, height: 20, borderRadius: 99, background: color, border: newCatIngreso.color === color ? '2px solid var(--ink)' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer' }}
                        aria-label={`Color ${color}`}
                      />
                    ))}
                  </div>
                  <button type="button" className="cc-btn cc-btn-primary cc-btn-sm" onClick={() => handleAddCustomCategory('ingreso')}>
                    <Plus size={13} /> Agregar
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {configTab === 'periodo' && (
          <div className="cc-card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Mes financiero</div>
            <p className="cc-stat-sub" style={{ marginBottom: 12 }}>
              Si te pagan a mitad de mes (como una quincena), el "mes" calendario puede hacer ver que estás en déficit
              justo antes de que te paguen. Aquí puedes decirle a la app en qué día quieres que empiece tu mes, para
              que coincida mejor con tu ciclo de pago.
            </p>
            <div className="cc-field" style={{ maxWidth: 200 }}>
              <label>Tu mes empieza el día</label>
              <input
                className="cc-input"
                type="number"
                min="1"
                max="28"
                value={monthStartDay}
                onChange={(e) => {
                  const v = Math.min(28, Math.max(1, parseInt(e.target.value, 10) || 1));
                  monthStartDayOverride = v;
                  setMonthStartDay(v);
                }}
              />
            </div>
            <p className="cc-stat-sub" style={{ marginTop: 10 }}>
              Con "1" (el valor normal), tu mes va del 1 al último día de cada mes. Si por ejemplo te pagan quincenas
              el 15 y el 30/31, prueba con "16": tu mes iría del 16 de un mes al 15 del siguiente, así el pago de fin
              de mes y lo que gastes justo después caen en el mismo período. Ninguna configuración es perfecta cuando
              te pagan dos veces al mes, pero esta ayuda a que el balance mensual refleje mejor tu realidad. El
              "Saldo en caja" del Resumen siempre muestra tu dinero real acumulado, sin importar esta configuración.
            </p>
          </div>
        )}

        {configTab === 'pin' && (
          <div className="cc-card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>PIN de acceso</div>
            <p className="cc-stat-sub" style={{ marginBottom: 12 }}>
              Configura o cambia el PIN de 6 dígitos con el que entras a la app.
            </p>
            <form onSubmit={handleSetPin} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 260 }}>
              <div className="cc-field">
                <label>Nuevo PIN</label>
                <input
                  className="cc-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinForm.newPin}
                  onChange={(e) => setPinForm((f) => ({ ...f, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                />
              </div>
              <div className="cc-field">
                <label>Confirmar PIN</label>
                <input
                  className="cc-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pinForm.confirmPin}
                  onChange={(e) => setPinForm((f) => ({ ...f, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                />
              </div>
              <button type="submit" className="cc-btn cc-btn-primary" style={{ alignSelf: 'flex-start' }}>Guardar PIN</button>
              {pinMessage && (
                <p style={{ fontSize: 13, color: pinMessage.kind === 'success' ? COLORS.income : COLORS.expense }}>{pinMessage.text}</p>
              )}
            </form>
          </div>
        )}

        {configTab === 'datos' && (
          <div className="cc-card">
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Datos y sesión</div>
            <p className="cc-stat-sub" style={{ marginBottom: 16 }}>
              {userEmail ? `Sesión iniciada: ${userEmail}. ` : ''}Tus datos se guardan de forma privada en tu cuenta.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
              <button type="button" className="cc-btn cc-btn-danger cc-btn-sm" onClick={handleResetAll}>
                <Trash2 size={13} /> Borrar todos los datos
              </button>
              <button type="button" className="cc-btn cc-btn-outline cc-btn-sm" onClick={() => supabase.auth.signOut()}>
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (loading) {
    return (
      <>
        <style>{STYLES}</style>
        <div className="cc-app">
          <div className="cc-loading">
            <Loader2 size={26} className="cc-spin" />
            <span className="cc-mono" style={{ fontSize: 13 }}>Cargando tu día a día financiero...</span>
          </div>
        </div>
      </>
    );
  }

  /* ---------- Reporte mensual imprimible ---------- */
  function renderPrintReport() {
    const monthTx = transactions
      .filter((t) => monthKeyFromDate(t.date) === selectedMonth)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const netMonth = selMonthIncome - selMonthExpense;
    return (
      <div className="cc-print-report">
        <h1>AlDía — Reporte financiero</h1>
        <p className="cc-print-sub">Mes: {monthLabel(selectedMonth)} · Generado el {formatDateHuman(new Date())}</p>

        <h2>Resumen del mes</h2>
        <table className="cc-print-table">
          <tbody>
            <tr><td>Ingresos</td><td>{fmtCOP(selMonthIncome)}</td></tr>
            <tr><td>Gastos totales</td><td>{fmtCOP(selMonthExpense)}</td></tr>
            <tr><td>&nbsp;&nbsp;Gastos fijos</td><td>{fmtCOP(selMonthFixed)}</td></tr>
            <tr><td>&nbsp;&nbsp;Gastos variables</td><td>{fmtCOP(selMonthVariable)}</td></tr>
            <tr><td><strong>Balance del mes</strong></td><td><strong>{fmtCOP(netMonth)}</strong></td></tr>
          </tbody>
        </table>

        <h2>Posición general</h2>
        <table className="cc-print-table">
          <tbody>
            <tr><td>Saldo en caja (histórico)</td><td>{fmtCOP(cashBalance)}</td></tr>
            <tr><td>Ahorro total</td><td>{fmtCOP(totalSavings)}</td></tr>
            <tr><td>Deuda pendiente</td><td>{fmtCOP(totalDebtRemaining)}</td></tr>
            <tr><td><strong>Patrimonio neto</strong></td><td><strong>{fmtCOP(netWorth)}</strong></td></tr>
          </tbody>
        </table>

        {pieData.length > 0 && (
          <>
            <h2>Gastos por categoría</h2>
            <table className="cc-print-table">
              <tbody>
                {pieData.map((p) => (
                  <tr key={p.name}><td>{p.name}</td><td>{fmtCOP(p.value)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {debts.length > 0 && (
          <>
            <h2>Deudas</h2>
            <table className="cc-print-table">
              <thead><tr><th>Deuda</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Pendiente (COP)</th></tr></thead>
              <tbody>
                {debts.map((d) => {
                  const paid = (d.payments || []).reduce((s, p) => s + p.amount, 0);
                  const remaining = Math.max(0, d.totalAmount - paid);
                  return (
                    <tr key={d.id}>
                      <td>{d.name}{d.currency === 'USD' ? ' (USD)' : ''}</td>
                      <td>{fmtMoney(d.totalAmount, d.currency)}</td>
                      <td>{fmtMoney(paid, d.currency)}</td>
                      <td>{fmtMoney(remaining, d.currency)}</td>
                      <td>{d.currency === 'USD' ? fmtCOP(debtRemainingCOP(d)) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {savingsGoals.length > 0 && (
          <>
            <h2>Metas de ahorro</h2>
            <table className="cc-print-table">
              <thead><tr><th>Meta</th><th>Objetivo</th><th>Ahorrado</th></tr></thead>
              <tbody>
                {savingsGoals.map((g) => {
                  const saved = (g.contributions || []).reduce((s, c) => s + c.amount, 0);
                  return (
                    <tr key={g.id}>
                      <td>{g.name}</td>
                      <td>{g.targetAmount != null ? fmtCOP(g.targetAmount) : '—'}</td>
                      <td>{fmtCOP(saved)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {recommendations.length > 0 && (
          <>
            <h2>Recomendaciones</h2>
            <ul className="cc-print-list">
              {recommendations.map((r, i) => <li key={i}>{r.text}</li>)}
            </ul>
          </>
        )}

        <h2>Movimientos del mes ({monthTx.length})</h2>
        <table className="cc-print-table cc-print-table-tx">
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Nota</th><th>Monto</th></tr></thead>
          <tbody>
            {monthTx.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{getCategory(t.category).label}</td>
                <td>{t.note || '—'}</td>
                <td>{t.type === 'ingreso' ? '+' : '-'}{fmtCOP(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }


  return (
    <>
      <style>{STYLES}</style>
      <div className="cc-app">
        <Sidebar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onReset={handleResetAll}
          onSignOut={() => supabase.auth.signOut()}
          userEmail={userEmail}
        />
        <div className="cc-main">
          {saveError && (
            <div className="cc-banner"><AlertTriangle size={15} /> No se pudieron guardar los últimos cambios. Revisa tu conexión.</div>
          )}
          {activeTab === 'resumen' && renderResumen()}
          {activeTab === 'movimientos' && renderMovimientos()}
          {activeTab === 'gastosfijos' && renderGastosFijos()}
          {activeTab === 'tarjetas' && renderTarjetas()}
          {activeTab === 'deudas' && renderDeudas()}
          {activeTab === 'ahorros' && renderAhorros()}
          {activeTab === 'configuracion' && renderConfiguracion()}
        </div>
      </div>
      <button type="button" className="cc-fab" onClick={handleOpenNewMovement} aria-label="Nuevo movimiento">
        <Plus size={26} strokeWidth={2.5} />
      </button>
      {renderPrintReport()}
    </>
  );
}
