import { supabase } from './supabaseClient';

/*
 * Esta capa imita la interfaz window.storage.get/set que tenía la app
 * cuando vivía como artefacto de Claude, pero guarda los datos en la
 * tabla `kv_store` de Supabase, uno por usuario autenticado.
 * Así el resto de App.jsx no tuvo que cambiar casi nada.
 */

export async function getItem(key) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('kv_store')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return { value: data.value };
}

export async function setItem(key, value) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) throw new Error('No hay sesión activa');

  const { error } = await supabase
    .from('kv_store')
    .upsert(
      { user_id: user.id, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );

  if (error) throw error;
  return { value };
}
