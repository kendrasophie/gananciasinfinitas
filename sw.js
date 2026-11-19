/* Agenda de Viajes · funcionamiento sin conexión */
const CACHE = 'agenda-v1.0.0';
const ARCHIVOS = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // los envíos a Google nunca se guardan
  const url = new URL(req.url);
  if (url.hostname.endsWith('google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  const esFuente = url.hostname.includes('fonts.g');
  if (url.origin !== location.origin && !esFuente) return;
  // Primero lo guardado (rápido y sin señal); se actualiza en segundo plano.
  e.respondWith(caches.open(CACHE).then(async cache => {
    const guardado = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) cache.put(req, r.clone()); return r; }).catch(() => guardado);
    return guardado || red;
  }));
});
