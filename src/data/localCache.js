/*
 * Copia local de los datos, para que la app abra y funcione sin señal.
 *
 * Se guardan dos cosas:
 *  - state:     lo que el usuario ve ahora, incluyendo lo que cambió sin conexión
 *  - persisted: la última foto que sabemos que llegó al servidor
 *
 * La diferencia entre las dos ES la cola de cambios pendientes. No hace falta
 * una cola aparte: el mismo diff que usa el guardado normal la calcula.
 */

const PREFIX = 'aldia-cache:';

function key(userId) { return `${PREFIX}${userId}`; }

export function readCache(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.state || !parsed.persisted) return null;
    return parsed;
  } catch {
    return null;   // modo incógnito, almacenamiento lleno o datos corruptos
  }
}

export function writeCache(userId, state, persisted) {
  if (!userId) return;
  try {
    localStorage.setItem(key(userId), JSON.stringify({ state, persisted, at: Date.now() }));
  } catch {
    // Quedarse sin espacio no puede tumbar la app: el servidor sigue siendo la
    // fuente de verdad, la copia local es una comodidad.
  }
}

export function clearCache(userId) {
  if (!userId) return;
  try { localStorage.removeItem(key(userId)); } catch { /* da igual */ }
}
