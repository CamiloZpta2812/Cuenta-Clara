import { stateToRows, TABLES, WRITE_ORDER } from './mapping.js';

/*
 * Antes la app serializaba TODO su estado y reescribía una sola fila gigante en
 * cada cambio: cambiar el nombre de una categoría reescribía tres años de
 * movimientos, y dos pestañas abiertas se pisaban entre sí.
 *
 * diffRows compara el estado anterior con el nuevo y dice exactamente qué filas
 * tocar. Es pura para poder probarla sin base de datos (ver sync.test.js).
 */

const key = (r) => r.id;

function indexById(rows) {
  const map = new Map();
  (rows || []).forEach((r) => map.set(key(r), r));
  return map;
}

/* Comparación por valor. Las filas son objetos planos de escalares. */
function same(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => {
    const va = a[k];
    const vb = b[k];
    if (va && typeof va === 'object') return JSON.stringify(va) === JSON.stringify(vb);
    return va === vb;
  });
}

export function diffRows(prevRows, nextRows) {
  const upserts = {};
  const deletes = {};

  TABLES.forEach((table) => {
    if (table === 'user_settings') return; // fila única, se trata aparte
    const before = indexById(prevRows[table]);
    const after = indexById(nextRows[table]);

    const changed = [];
    after.forEach((row, id) => {
      const old = before.get(id);
      if (!old || !same(old, row)) changed.push(row);
    });
    const removed = [];
    before.forEach((_row, id) => {
      if (!after.has(id)) removed.push(id);
    });

    if (changed.length) upserts[table] = changed;
    if (removed.length) deletes[table] = removed;
  });

  const prevSettings = (prevRows.user_settings || [])[0];
  const nextSettings = (nextRows.user_settings || [])[0];
  if (nextSettings && (!prevSettings || !same(prevSettings, nextSettings))) {
    upserts.user_settings = [nextSettings];
  }

  return { upserts, deletes };
}

export function diffState(prevState, nextState) {
  return diffRows(stateToRows(prevState), stateToRows(nextState));
}

export function isEmptyDiff(diff) {
  return Object.keys(diff.upserts).length === 0 && Object.keys(diff.deletes).length === 0;
}

/* Cuántas filas toca un diff. Solo para mensajes y pruebas. */
export function diffSize(diff) {
  const up = Object.values(diff.upserts).reduce((s, rows) => s + rows.length, 0);
  const del = Object.values(diff.deletes).reduce((s, ids) => s + ids.length, 0);
  return up + del;
}

const CHUNK = 500; // Supabase acepta más, pero así ninguna petición se vuelve enorme

function chunks(arr, size = CHUNK) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/*
 * Convierte un diff en la lista ordenada de peticiones que hay que mandar.
 * Se separa de la ejecución porque el orden es lo delicado y así puede probarse
 * sin base de datos (ver api.plan.test.js):
 *
 *  - los borrados van primero y en orden inverso, para que los abonos salgan
 *    antes que su deuda y no choquen con la llave foránea;
 *  - los upserts van de padres a hijos;
 *  - cada fila lleva user_id, sin el cual RLS rechaza la escritura.
 */
export function planWrites(diff, userId, chunkSize = CHUNK) {
  const plan = [];

  for (const table of [...WRITE_ORDER].reverse()) {
    const ids = diff.deletes[table];
    if (!ids || !ids.length) continue;
    for (const part of chunks(ids, chunkSize)) {
      plan.push({ op: 'delete', table, userId, ids: part });
    }
  }

  for (const table of WRITE_ORDER) {
    const rows = diff.upserts[table];
    if (!rows || !rows.length) continue;
    const onConflict = table === 'user_settings' ? 'user_id' : 'user_id,id';
    for (const part of chunks(rows, chunkSize)) {
      plan.push({ op: 'upsert', table, onConflict, rows: part.map((r) => ({ ...r, user_id: userId })) });
    }
  }

  return plan;
}


/*
 * Reconciliación al volver de estar sin conexión.
 *
 * Hay tres versiones en juego: lo que trae el servidor ahora, la foto que
 * teníamos cuando se cayó la conexión, y lo que el usuario alcanzó a cambiar
 * encima. Pisar el servidor con lo local borraría lo hecho desde otro
 * dispositivo; pisar lo local con el servidor botaría los gastos registrados
 * sin señal.
 *
 * Así que se parte del servidor y se vuelven a aplicar encima SOLO los
 * registros que cambiaron localmente. Cada quien conserva lo suyo mientras no
 * toquen el mismo registro; si lo tocan, gana el cambio local, que es el más
 * reciente que conoce esta pantalla.
 */
export function replayLocalChanges(serverRows, pendingDiff) {
  const out = {};
  TABLES.forEach((table) => {
    const base = [...(serverRows[table] || [])];
    const borrados = new Set(pendingDiff.deletes[table] || []);
    const nuevos = pendingDiff.upserts[table] || [];

    const kept = base.filter((r) => !borrados.has(r.id));
    nuevos.forEach((row) => {
      const i = kept.findIndex((r) => r.id === row.id);
      if (i >= 0) kept[i] = row; else kept.push(row);
    });
    out[table] = kept;
  });
  return out;
}
