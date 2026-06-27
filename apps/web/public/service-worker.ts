const CACHE_NAME = 'miraichi-shell-v5-phase-5-12-quality-up';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/packages/ui/src/index.css',
  '/apps/web/src/shell-entry.js',
  '/apps/web/src/config/navigation-tabs.js',
  '/apps/web/src/components/app-shell.js',
  '/apps/web/src/components/bottom-navigation.js',
  '/apps/web/src/components/html.js',
  '/apps/web/src/services/settings-service.js',
  '/apps/web/src/services/i18n-service.js'
];

const serviceWorkerScope = self as any;

serviceWorkerScope.addEventListener('install', (event: any) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  serviceWorkerScope.skipWaiting();
});

serviceWorkerScope.addEventListener('activate', (event: any) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  serviceWorkerScope.clients.claim();
});

serviceWorkerScope.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);

  // Network-first or pass-through for API and AI routes
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ai/')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for static shell assets
  const isShellAsset = ASSETS_TO_CACHE.some(asset => {
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
          if (networkResponse && networkResponse.status === 200) {
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
