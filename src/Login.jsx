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
          maxWidth: 320,
          width: '100%',
          boxShadow: '0 6px 18px rgba(32,43,56,.08)',
        }}
      >
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, margin: '0 0 4px 0' }}>Cuenta Clara</h1>
        <p style={{ color: '#5B6570', fontSize: 13.5, margin: '0 0 20px 0' }}>
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
              border: '1px solid #DCD8C4',
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
              background: '#202B38',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          {error ? <p style={{ color: '#B0524B', fontSize: 13 }}>{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
