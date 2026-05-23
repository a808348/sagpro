// SagPro service worker — offline cache
const CACHE = 'sagpro-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.allSettled(ASSETS.map(url => c.add(url))).then(results => {
        // Surface partial cache failures so a broken deploy is visible in DevTools.
        const failed = results
          .map((r, i) => r.status === 'rejected' ? { url: ASSETS[i], reason: String(r.reason) } : null)
          .filter(Boolean);
        if (failed.length) console.warn('[SW] asset cache failures:', failed);
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(resp => {
        if (resp.ok && new URL(req.url).origin === location.origin) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return resp;
      }).catch(() => {
        // Offline fallback: only return index.html for top-level page navigations.
        // Other failed requests (images/json/XHR/etc) propagate as errors so the
        // caller doesn't get HTML mis-typed as their expected resource.
        const isNav = req.mode === 'navigate' || req.destination === 'document';
        if (isNav) return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
