/*
 * Service worker de AlDía.
 *
 * Sin esto, la app instalada en el celular no abría sin señal: justo el momento
 * en que quieres registrar un gasto (en la fila de la caja del supermercado).
 *
 * Solo se mete con peticiones del mismo origen. Las llamadas a Supabase van a
 * otro dominio y pasan de largo: nunca se cachean respuestas de la base, que
 * llevan datos personales y quedarían viejas.
 */

const VERSION = 'aldia-v1';
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;

self.addEventListener('install', (event) => {
  // Entra a funcionar de una, sin esperar a que se cierren las pestañas viejas.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit = await cache.match(request) || (fallbackUrl && await cache.match(fallbackUrl));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;  // Supabase y fuentes: de largo

  // Navegar a la app: se intenta la red y si no hay, se sirve la última copia.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGES, '/index.html'));
    return;
  }

  // Los bundles de Vite llevan hash en el nombre: si el nombre coincide, el
  // contenido coincide, así que cachearlos de primero es seguro.
  if (url.pathname.startsWith('/assets/') || /\.(js|css|png|svg|webmanifest|json)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, ASSETS));
  }
});
