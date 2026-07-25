import React, { useState } from 'react';
import { supabase } from './supabaseClient';

const LAST_EMAIL_KEY = 'cuenta-clara-ultimo-correo';

export default function Login() {
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem(LAST_EMAIL_KEY) || '';
    } catch {
      return '';
    }
  });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email);
      } catch {
        // Si el navegador bloquea localStorage, simplemente no recordamos el correo.
      }
      setSent(true);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: '#EEEFE4',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 14,
          padding: '32px 28px',
          maxWidth: 360,
          width: '100%',
          boxShadow: '0 6px 18px rgba(32,43,56,.08)',
        }}
      >
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: '0 0 4px 0' }}>Cuenta Clara</h1>
        <p style={{ color: '#5B6570', fontSize: 13.5, margin: '0 0 20px 0' }}>
          Ingresa tu correo y te enviamos un enlace para entrar sin contraseña.
        </p>
        {sent ? (
          <p style={{ fontSize: 14 }}>
            Revisa tu correo <strong>{email}</strong> y toca el enlace para entrar. Puedes cerrar esta pestaña.
          </p>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              required
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #DCD8C4',
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#202B38',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {loading ? 'Enviando...' : 'Enviar enlace de acceso'}
            </button>
            {error ? <p style={{ color: '#B0524B', fontSize: 13 }}>{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
