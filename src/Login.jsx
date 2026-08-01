import React, { useState } from 'react';
import { supabase } from './supabaseClient';

const APP_EMAIL = import.meta.env.VITE_APP_EMAIL;

export default function Login() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (pin.length !== 6) {
      setError('El PIN debe tener 6 dígitos.');
      return;
    }
    if (!APP_EMAIL) {
      setError('Falta configurar VITE_APP_EMAIL en las variables de entorno.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: APP_EMAIL, password: pin });
    setLoading(false);
    if (error) {
      setError('PIN incorrecto. Intenta de nuevo.');
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
          maxWidth: 320,
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
          Ingresa tu PIN de 6 dígitos para entrar.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            required
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #E4DDCE',
              fontSize: 22,
              letterSpacing: 6,
              textAlign: 'center',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#BB4B34',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {error ? <p style={{ color: '#BB4B34', fontSize: 13 }}>{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
