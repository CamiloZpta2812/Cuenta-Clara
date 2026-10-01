/*
 * Cuentas divididas: pagas tú la cuenta completa y los demás te devuelven su
 * parte. Aquí vive el paso del formulario al reparto guardado y de vuelta.
 * Ver split.test.js.
 */

/*
 * Del formulario al reparto guardado. Devuelve null si los montos a mano
 * suman más que la cuenta: guardar eso dejaría a tus amigos debiéndote plata
 * que no pusiste.
 */
export function buildSplitShares(total, split, previas = []) {
  const ids = (split && split.personIds) || [];
  if (ids.length === 0) return [];
  const porPersona = Object.fromEntries((previas || []).map((r) => [r.personId, r]));
  let montos;
  if (split.mode === 'montos') {
    montos = ids.map((id) => Number((split.amounts || {})[id]) || 0);
    if (montos.reduce((a, b) => a + b, 0) > total + 0.5) return null;
  } else {
    const partes = ids.length + (split.includeMe === false ? 0 : 1);
    const cada = Math.round(total / partes);
    montos = ids.map(() => cada);
  }
  return ids.map((personId, i) => {
    const antes = porPersona[personId];
    return {
      id: antes ? antes.id : `${personId}-${Math.random().toString(36).slice(2, 8)}`,
      personId,
      amount: montos[i],
      collectedAt: antes ? antes.collectedAt || null : null,
    };
  }).filter((r) => r.amount > 0);
}

/* Del reparto guardado de vuelta al formulario, para editar. */
export function splitFromShares(t) {
  const shares = t.shares || [];
  if (shares.length === 0) return { personIds: [], mode: 'iguales', includeMe: true, amounts: {} };
  const iguales = shares.every((r) => r.amount === shares[0].amount);
  return {
    personIds: shares.map((r) => r.personId),
    mode: iguales ? 'iguales' : 'montos',
    includeMe: iguales ? Math.round(t.amount / shares[0].amount) > shares.length : true,
    amounts: Object.fromEntries(shares.map((r) => [r.personId, String(r.amount)])),
  };
}

