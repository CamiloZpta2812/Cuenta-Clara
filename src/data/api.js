import { supabase } from '../supabaseClient.js';
import { STORAGE_KEY } from '../lib/constants.js';
import { TABLES, stateToRows, rowsToState } from './mapping.js';
import { planWrites } from './sync.js';

/*
 * Todo lo que habla con Postgres. La lógica de qué escribir vive en sync.js y
 * cómo se ve cada fila en mapping.js; aquí solo se ejecuta.
 */

/*
 * getSession() lee la sesión de localStorage; getUser() haría una petición a
 * Supabase. Antes se llamaba a getUser() en cada lectura y cada escritura: dos
 * viajes a la red por guardado, y nada de esto funcionaría sin señal.
 */
async function currentUserId() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const id = data && data.session && data.session.user && data.session.user.id;
  if (!id) throw new Error('No hay sesión activa');
  return id;
}

/*
 * Igual que currentUserId pero sin lanzar: la carga inicial necesita saber de
 * quién es la caché local incluso si no hay red para preguntarle al servidor.
 */
export async function currentUserIdSafe() {
  try {
    return await currentUserId();
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------- lectura */

export async function fetchAllRows() {
  const userId = await currentUserId();
  const results = await Promise.all(TABLES.map(async (table) => {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
    if (error) throw new Error(`Al leer ${table}: ${error.message}`);
    return [table, data || []];
  }));
  return Object.fromEntries(results);
}

export async function fetchState() {
  return rowsToState(await fetchAllRows());
}

export function hasAnyRows(rows) {
  return TABLES.some((t) => t !== 'user_settings' && (rows[t] || []).length > 0);
}

/* ---------------------------------------------------------------- escritura */

export async function applyDiff(diff) {
  const userId = await currentUserId();
  for (const step of planWrites(diff, userId)) {
    if (step.op === 'delete') {
      const { error } = await supabase.from(step.table).delete()
        .eq('user_id', step.userId).in('id', step.ids);
      if (error) throw new Error(`Al borrar en ${step.table}: ${error.message}`);
    } else {
      const { error } = await supabase.from(step.table)
        .upsert(step.rows, { onConflict: step.onConflict });
      if (error) throw new Error(`Al guardar en ${step.table}: ${error.message}`);
    }
  }
}

/* ---------------------------------------------------------------- migración */

/*
 * Lee la fila única de kv_store donde vivía todo el estado como un JSON.
 * Devuelve null si ya no existe la tabla o el usuario nunca tuvo datos ahí.
 */
export async function readLegacyBlob() {
  try {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from('kv_store').select('value').eq('user_id', userId).eq('key', STORAGE_KEY).maybeSingle();
    if (error) return null;   // tabla ya borrada, o sin permiso: no hay nada que migrar
    if (!data || !data.value) return null;
    return JSON.parse(data.value);
  } catch {
    return null;
  }
}

async function markMigrated(userId) {
  await supabase.from('user_settings')
    .upsert({ user_id: userId, migrated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

/*
 * Se llama una sola vez, la primera vez que el usuario entra con el esquema
 * nuevo. Nunca borra kv_store: esa fila se queda como respaldo.
 *
 * Devuelve el estado ya migrado, o null si no había nada que migrar.
 */
export async function migrateLegacyBlobIfNeeded(existingRows) {
  const userId = await currentUserId();

  const { data: settings } = await supabase
    .from('user_settings').select('migrated_at').eq('user_id', userId).maybeSingle();
  if (settings && settings.migrated_at) return null;

  // Si ya hay datos en las tablas nuevas, no importamos nada encima: solo
  // dejamos constancia de que esta cuenta ya no necesita la migración.
  if (hasAnyRows(existingRows)) {
    await markMigrated(userId);
    return null;
  }

  const blob = await readLegacyBlob();
  if (!blob) {
    await markMigrated(userId);
    return null;
  }

  const rows = stateToRows(blob);
  await applyDiff({ upserts: rows, deletes: {} });
  await markMigrated(userId);
  return rowsToState(rows);
}
