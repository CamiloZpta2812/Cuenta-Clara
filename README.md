# AlDía (repo: cuenta-clara)

App web de finanzas personales, con tus datos en una base de datos real
(Supabase), lista para instalarse en tu celular.

## ⚠️ Si ya venías usando la app: hay que correr el SQL nuevo

Los datos ya no viven como un JSON gigante en una sola fila (`kv_store`), sino
en tablas de verdad. Para pasarte:

1. Entra a Supabase → **SQL Editor** → **New query**.
2. Pega todo el contenido de `supabase/schema.sql` y dale **Run**.
   Se puede correr varias veces sin romper nada.
3. Abre la app y entra normal. La primera vez detecta tu JSON viejo y lo
   convierte solo a las tablas nuevas.

**No se borra nada.** La tabla `kv_store` se queda intacta como respaldo. Cuando
lleves un tiempo tranquilo y hayas verificado que todo está bien, puedes
borrarla a mano con `drop table public.kv_store;`. El esquema viejo quedó
guardado en `supabase/schema-kv-store-legacy.sql` por si acaso.

## Funciona sin conexión

La app se puede instalar en el celular y **abre sin señal**. Lo que registres sin
internet se guarda en el dispositivo y se sube solo cuando vuelve la conexión
(arriba aparece un aviso mientras tanto). Si mientras estabas sin señal cambiaste
algo desde otro dispositivo, al reconectar se conservan los dos: solo se pisa el
registro puntual que hayas tocado en ambos lados.

## Comandos

```
npm install     # instalar dependencias
npm run dev     # levantar en local
npm run build   # compilar para producción
npm run lint    # revisar el código (atrapa errores que el build no ve)
npm test        # pruebas de la capa de datos
```

## Paso 1 — Crear el proyecto en Supabase (gratis)

1. Ve a https://supabase.com y crea una cuenta / inicia sesión.
2. Crea un **nuevo proyecto** (elige una contraseña de base de datos y guárdala).
3. Espera 1-2 minutos a que termine de aprovisionarse.
4. En el menú lateral ve a **SQL Editor** → **New query**, pega todo el
   contenido del archivo `supabase/schema.sql` de esta carpeta y dale **Run**.
   Esto crea las tablas donde vivirán tus datos y las reglas de seguridad
   (Row Level Security: cada usuario solo puede ver y tocar lo suyo).
5. Ve a **Authentication → Providers → Email** y **desactiva "Confirm email"**
   (a veces aparece como "Enable email confirmations"). Así, cuando alguien
   se registre con correo y contraseña, puede entrar de inmediato sin tener
   que hacer clic en un enlace de confirmación.
6. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL**
   - **anon public key**

## Paso 2 — Configurar el proyecto localmente

1. Instala [Node.js](https://nodejs.org) si no lo tienes (versión 18 o más).
2. Abre una terminal en esta carpeta y ejecuta:
   ```
   npm install
   ```
3. Copia `.env.example` a un archivo nuevo llamado `.env` y pega ahí tus
   valores de Supabase:
   ```
   VITE_SUPABASE_URL=https://tuproyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```
4. Prueba localmente:
   ```
   npm run dev
   ```
   Abre el link que aparece (normalmente http://localhost:5173). Deberías
   ver la pantalla de inicio de sesión: escribe tu correo, revisa tu bandeja
   de entrada y toca el enlace para entrar.

## Paso 3 — Publicarla en internet con Vercel (gratis)

La forma más simple sin usar la terminal para el despliegue:

1. Crea una cuenta gratis en https://github.com y en https://vercel.com
   (puedes entrar a Vercel directamente con tu cuenta de GitHub).
2. Sube esta carpeta a un repositorio nuevo en GitHub (puedes arrastrar los
   archivos desde la web de GitHub: "Add file" → "Upload files").
3. En Vercel, dale **Add New → Project**, elige ese repositorio.
4. En **Environment Variables**, agrega las mismas dos variables de tu
   archivo `.env` (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
5. Dale **Deploy**. En un par de minutos Vercel te da una URL propia, por
   ejemplo `https://cuenta-clara-tuusuario.vercel.app`.

Importante: una vez tengas esa URL, entra a Supabase →
**Authentication → URL Configuration** y agrega esa URL como
**Site URL** y en **Redirect URLs**, para que el login funcione
correctamente en producción.

## Paso 4 — Instalarla en tu celular

1. Abre la URL de Vercel desde el navegador de tu celular (Chrome en
   Android, Safari en iPhone).
2. Inicia sesión con tu correo.
3. Abre el menú del navegador y busca la opción **"Agregar a pantalla de
   inicio"** (Android) o **"Compartir" → "Agregar a inicio"** (iPhone).
4. Ahora tienes un ícono propio de Cuenta Clara en tu celular, que abre
   directo a la app y guarda todo en tu base de datos de Supabase.

## Notas

- Tus datos ya no dependen de Claude ni del navegador: viven en tu proyecto
  de Supabase (plan gratuito, suficiente para uso personal).
- Si algún día quieres ver o exportar tus datos crudos, puedes entrar al
  panel de Supabase → **Table Editor → kv_store**.
- El código de la app (`src/App.jsx`) es el mismo que ya tenías; solo se
  cambió la forma en que se guarda y se agregó la pantalla de inicio de
  sesión.
