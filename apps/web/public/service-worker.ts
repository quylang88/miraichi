/// <reference lib="webworker" />

export {};

const CACHE_NAME = 'miraichi-shell-v15-structured-add-bet';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/packages/ui/src/index.css',
  '/apps/web/src/auth-bootstrap.js',
  '/apps/web/src/pwa/register-service-worker.js',
  '/manifest.webmanifest',
  '/icons/icon.svg'
] as const;

const serviceWorkerScope = self as unknown as ServiceWorkerGlobalScope;

serviceWorkerScope.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...ASSETS_TO_CACHE]))
      .then(() => serviceWorkerScope.skipWaiting())
  );
});

serviceWorkerScope.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName === CACHE_NAME || !cacheName.startsWith('miraichi-shell-')) {
          return Promise.resolve(false);
        }
        return caches.delete(cacheName);
      })
    )).then(() => serviceWorkerScope.clients.claim())
  );
});

serviceWorkerScope.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== serviceWorkerScope.location.origin) return;

  // Network-first or pass-through for API and AI routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ai/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Cache-first for static shell assets
  const isShellAsset = ASSETS_TO_CACHE.some((asset) => {
    if (asset === '/') {
      return url.pathname === '/' || url.pathname === '/index.html';
    }
    return url.pathname === asset;
  });

  if (isShellAsset) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cacheKey = url.pathname === '/index.html' ? '/' : url.pathname;
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(async (networkResponse) => {
          if (networkResponse.status === 200) {
            await cache.put(cacheKey, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Pass-through for other assets
  event.respondWith(fetch(event.request));
});
