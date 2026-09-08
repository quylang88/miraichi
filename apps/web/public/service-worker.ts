/// <reference lib="webworker" />

export {};

const CACHE_NAME = 'miraichi-shell-v9-live-toggle';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/packages/ui/src/index.css',
  '/apps/web/src/auth-bootstrap.js',
  '/apps/web/src/config/navigation-tabs.js',
  '/apps/web/src/components/app-shell.js',
  '/packages/config/src/competition-registry.mock.js',
  '/apps/web/src/components/bottom-navigation.js',
  '/apps/web/src/components/html.js',
  '/apps/web/src/services/settings-service.js',
  '/apps/web/src/services/i18n-service.js'
] as const;

const serviceWorkerScope = self as unknown as ServiceWorkerGlobalScope;

serviceWorkerScope.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...ASSETS_TO_CACHE]))
  );
  serviceWorkerScope.skipWaiting();
});

serviceWorkerScope.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName === CACHE_NAME) {
          return Promise.resolve(false);
        }
        return caches.delete(cacheName);
      })
    ))
  );
  serviceWorkerScope.clients.claim();
});

serviceWorkerScope.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

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
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
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
