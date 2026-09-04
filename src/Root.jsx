import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import Login from './Login';
import SetupNotice from './SetupNotice';
import CuentaClaraApp from './App';

export default function Root() {
  const [session, setSession] = useState(undefined); // undefined = cargando

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <SetupNotice />;

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
