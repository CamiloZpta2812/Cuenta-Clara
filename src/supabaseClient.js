import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu archivo .env (mira .env.example).'
  );
}

/*
 * createClient() lanza una excepción si la URL o la key vienen vacías, y como
 * esto pasa al importar el módulo, la app entera se quedaba en blanco sin
 * ningún mensaje. Cuando falta la configuración exportamos null y Root muestra
 * una pantalla que explica qué hacer.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
