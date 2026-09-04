
/* Pantalla que se muestra cuando faltan las variables de entorno de Supabase. */
export default function SetupNotice() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Poppins', sans-serif", background: '#F4F1EA', padding: 20, color: '#2E2B27',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, padding: '32px 28px', maxWidth: 460, width: '100%',
        boxShadow: '0 6px 18px rgba(46,43,39,.08)', lineHeight: 1.55,
      }}>
        <h1 style={{ fontSize: 20, margin: '0 0 10px 0' }}>Falta conectar la base de datos</h1>
        <p style={{ fontSize: 14, color: '#6E675E', margin: '0 0 14px 0' }}>
          AlDía no encontró las variables de entorno de Supabase, así que no puede iniciar sesión
          ni guardar tus datos.
        </p>
        <p style={{ fontSize: 14, color: '#6E675E', margin: '0 0 8px 0' }}>
          Crea un archivo <strong>.env</strong> en la raíz del proyecto (puedes copiar
          {' '}<strong>.env.example</strong>) con estas dos líneas, y vuelve a levantar el servidor:
        </p>
        <pre style={{
          background: '#F4F1EA', border: '1px solid #E4DDCE', borderRadius: 8, padding: '12px 14px',
          fontSize: 12.5, overflowX: 'auto', margin: '0 0 14px 0',
        }}>{`VITE_SUPABASE_URL=https://tuproyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key`}</pre>
        <p style={{ fontSize: 13, color: '#6E675E', margin: 0 }}>
          Los dos valores están en Supabase, en <strong>Project Settings → API</strong>.
          Si ya desplegaste en Vercel, agrégalos también en <strong>Environment Variables</strong>.
        </p>
      </div>
    </div>
  );
}
