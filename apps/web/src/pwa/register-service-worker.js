if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[PWA] ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch((err) => {
        console.log('[PWA] ServiceWorker registration failed: ', err);
      });
  });
}
