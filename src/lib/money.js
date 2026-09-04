/* Formateo de montos. Todo lo interno vive en COP; USD solo se muestra. */

export function fmtCOP(n) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Math.round(n || 0));
}

export function fmtUSD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

export function fmtMoney(n, currency) {
  return currency === 'USD' ? fmtUSD(n) : fmtCOP(n);
}

export function fmtShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${Math.round(n / 1000)}K`;
  return `${Math.round(n)}`;
}

