import { AlertTriangle, TrendingUp, Check } from 'lucide-react';
import { COLORS } from '../lib/constants.js';

export default function RecCard({ kind, text }) {
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
