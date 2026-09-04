import React from 'react';

/*
 * Sin esto, cualquier error de render deja la pantalla completamente en blanco
 * y sin pistas de qué pasó.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('AlDía se rompió al renderizar:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Poppins', sans-serif", background: '#F4F1EA', padding: 20, color: '#2E2B27',
      }}>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '32px 28px', maxWidth: 460, width: '100%',
          boxShadow: '0 6px 18px rgba(46,43,39,.08)', lineHeight: 1.55,
        }}>
          <h1 style={{ fontSize: 20, margin: '0 0 10px 0' }}>Algo se rompió</h1>
          <p style={{ fontSize: 14, color: '#6E675E', margin: '0 0 16px 0' }}>
            Tus datos están guardados, no se perdió nada. Recarga la página para volver a intentarlo.
          </p>
          <pre style={{
            background: '#F4F1EA', border: '1px solid #E4DDCE', borderRadius: 8, padding: '10px 12px',
            fontSize: 12, overflowX: 'auto', margin: '0 0 16px 0', color: '#BB4B34',
          }}>{String(this.state.error && this.state.error.message)}</pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none', background: '#BB4B34',
              color: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: "'Poppins', sans-serif",
            }}
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
