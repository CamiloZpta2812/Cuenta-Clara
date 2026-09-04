import { MONTH_NAMES } from './constants.js';
import { userConfig } from './userConfig.js';

export function todayStr() { return new Date().toISOString().slice(0, 10); }

export function daysInMonth(year, monthIndex) { return new Date(year, monthIndex + 1, 0).getDate(); }

export function monthKeyFromDate(d) {
  const dateStr = d || todayStr();
  const S = userConfig.monthStartDay;
  if (!S || S <= 1) return dateStr.slice(0, 7);
  const [y, m, day] = dateStr.split('-').map(Number);
  const effectiveS = Math.min(S, daysInMonth(y, m - 1));
  if (day >= effectiveS) return `${y}-${String(m).padStart(2, '0')}`;
  let pm = m - 1;
  let py = y;
  if (pm < 1) { pm = 12; py -= 1; }
  return `${py}-${String(pm).padStart(2, '0')}`;
}

export function currentMonthKey() { return monthKeyFromDate(todayStr()); }

export function monthLabel(key) {
  const [y, m] = key.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

export function addMonths(key, delta) {
  let [y, m] = key.split('-').map(Number);
  m += delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function getLastMonthKeys(n, endKey) {
  const arr = [];
  for (let i = n - 1; i >= 0; i -= 1) arr.push(addMonths(endKey, -i));
  return arr;
}

export function monthsBetween(k1, k2) {
  const [y1, m1] = k1.split('-').map(Number);
  const [y2, m2] = k2.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

export function computeChargeDate(purchaseDateStr, cutDay, paymentDay) {
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

export function formatDateHuman(dateObj) {
  return `${dateObj.getDate()} ${MONTH_NAMES[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

