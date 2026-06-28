const LOCAL_DEV_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);
const DEV_SW_RESET_KEY = 'miraichi-dev-service-worker-reset';

function isLocalDevHost() {
  return LOCAL_DEV_HOSTS.has(window.location.hostname);
}

async function removeLocalServiceWorkerState() {
  const registrations = typeof navigator.serviceWorker.getRegistrations === 'function'
    ? await navigator.serviceWorker.getRegistrations()
    : [];
  const cacheNames = 'caches' in globalThis ? await globalThis.caches.keys() : [];

  await Promise.all([
    ...registrations.map((registration) => registration.unregister()),
    ...cacheNames.map((cacheName) => globalThis.caches.delete(cacheName))
  ]);

  return registrations.length > 0 || cacheNames.length > 0;
}

function reloadAfterDevCleanup(cleanedState: unknown) {
  if (!cleanedState || typeof window.location.reload !== 'function') {
    return;
  }

  if (window.sessionStorage?.getItem(DEV_SW_RESET_KEY) === 'done') {
    return;
  }

  window.sessionStorage?.setItem(DEV_SW_RESET_KEY, 'done');
  window.location.reload();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (isLocalDevHost()) {
      removeLocalServiceWorkerState()
        .then((cleanedState: unknown) => {
          console.log('[PWA] Local dev mode: service workers and shell caches disabled.');
          reloadAfterDevCleanup(cleanedState);
        })
        .catch((err) => {
          console.log('[PWA] Local dev service worker cleanup failed: ', err);
        });
      return;
    }

    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((err) => {
        console.log('[PWA] ServiceWorker registration failed: ', err);
      });
  });
}
