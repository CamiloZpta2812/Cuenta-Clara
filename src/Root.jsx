import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import CuentaClaraApp from './App';

export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = cargando

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        Cargando...
      </div>
    );
  }

  if (!session) return <Login />;

  return <CuentaClaraApp />;
}
