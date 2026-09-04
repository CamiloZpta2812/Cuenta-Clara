/*
 * Se registra solo en producción: en desarrollo el service worker se pelea con
 * el recargado en caliente de Vite y sirve versiones viejas del código.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Sin service worker la app funciona igual, solo que no abre sin señal.
    });
  });
}
