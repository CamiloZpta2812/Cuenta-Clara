import { AlertTriangle, TrendingUp, Wallet, Check } from 'lucide-react';
import { COLORS } from './constants.js';
import { getCategory } from './categories.js';
import { currentMonthKey, monthKeyFromDate, monthsBetween } from './dates.js';
import { fmtCOP } from './money.js';

export function buildRecommendations(transactions, debts, savingsGoals) {
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

export function getStatus(income, expense) {
  if (income === 0 && expense === 0) return { label: 'Sin datos este mes', color: COLORS.inkSoft, Icon: Wallet };
  if (expense > income) return { label: 'Revisar gastos', color: COLORS.expense, Icon: AlertTriangle };
  const rate = income > 0 ? (income - expense) / income : 0;
  if (rate >= 0.2) return { label: 'Saldo sólido', color: COLORS.income, Icon: Check };
  return { label: 'En equilibrio', color: COLORS.savings, Icon: TrendingUp };
}
