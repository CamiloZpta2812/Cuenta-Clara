import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else if (!data.session) {
        // Si el proyecto de Supabase todavía tiene la confirmación por correo activada,
        // no habrá sesión inmediata. Avisamos para que revisen esa configuración.
        setInfo('Cuenta creada. Si no entraste automáticamente, revisa que tu proyecto de Supabase tenga desactivada la confirmación por correo.');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError('Correo o contraseña incorrectos.');
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Poppins', sans-serif",
        background: '#F4F1EA',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '32px 28px',
          maxWidth: 340,
          width: '100%',
          boxShadow: '0 6px 18px rgba(46,43,39,.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <svg width={30} height={30} viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="36" fill="none" stroke="#BB4B34" strokeWidth="6" />
            <path d="M 14 50 A 36 36 0 0 0 86 50 Z" fill="#BB4B34" />
            <line x1="9" y1="50" x2="91" y2="50" stroke="#F4F1EA" strokeWidth="5" />
          </svg>
          <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 24, margin: 0, color: '#2E2B27' }}>AlDía</h1>
        </div>
        <p style={{ color: '#6E675E', fontSize: 13.5, margin: '0 0 20px 0' }}>
          {mode === 'signup' ? 'Crea tu cuenta para tener tu propio espacio.' : 'Ingresa con tu correo y contraseña.'}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            required
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4DDCE', fontSize: 16 }}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Contraseña (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #E4DDCE', fontSize: 16 }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: '#BB4B34', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? 'Un momento...' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </button>
          {error ? <p style={{ color: '#BB4B34', fontSize: 13, margin: 0 }}>{error}</p> : null}
          {info ? <p style={{ color: '#2F7D5C', fontSize: 13, margin: 0 }}>{info}</p> : null}
        </form>
        <button
          type="button"
          onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setInfo(''); }}
          style={{ marginTop: 16, background: 'none', border: 'none', color: '#6E675E', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
        >
          {mode === 'signup' ? '¿Ya tienes cuenta? Entra aquí' : '¿No tienes cuenta? Créala aquí'}
        </button>
      </div>
    </div>
  );
}
