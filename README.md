# Cuenta Clara — versión app independiente

Esta es tu app "Cuenta Clara" convertida en una aplicación web independiente,
con tus datos guardados en una base de datos real (Supabase), lista para
instalarse en tu celular sin depender de Claude.

## Paso 1 — Crear el proyecto en Supabase (gratis)

1. Ve a https://supabase.com y crea una cuenta / inicia sesión.
2. Crea un **nuevo proyecto** (elige una contraseña de base de datos y guárdala).
3. Espera 1-2 minutos a que termine de aprovisionarse.
4. En el menú lateral ve a **SQL Editor** → **New query**, pega todo el
   contenido del archivo `supabase/schema.sql` de esta carpeta y dale **Run**.
   Esto crea la tabla donde vivirán tus datos y las reglas de seguridad
   (cada usuario solo puede ver los suyos).
5. Ve a **Authentication → Providers** y confirma que **Email** esté
   habilitado (viene activado por defecto). Con esto entrarás con un enlace
   mágico que llega a tu correo, sin contraseñas que recordar.
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
**Site URL** y en **Redirect URLs**, para que el enlace mágico funcione
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
