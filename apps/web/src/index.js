import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pathModule from 'path';


const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);
const ROOT_DIR = pathModule.resolve(__dirname, '../../../');

const PORT = 3000;

const server = http.createServer((req, res) => {
  const url = req.url;

  // SPA Entry
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(getIndexHtml());
    return;
  }

  let filePath = null;
  let contentType = 'text/plain';

  // PWA Routes
  if (url === '/manifest.webmanifest') {
    filePath = pathModule.join(ROOT_DIR, 'apps/web/public/manifest.webmanifest');
    contentType = 'application/manifest+json';
  } else if (url === '/service-worker.js') {
    filePath = pathModule.join(ROOT_DIR, 'apps/web/public/service-worker.js');
    contentType = 'application/javascript';
  } else if (
    url === '/icons/icon.svg' ||
    url === '/icons/icon-180.png' ||
    url === '/icons/icon-192.png' ||
    url === '/icons/icon-512.png'
  ) {
    filePath = pathModule.join(ROOT_DIR, 'apps/web/public/icons/icon.svg');
    contentType = 'image/svg+xml';
  }
  // Static File Routing for Packages and Web Client Code
  else if (url.startsWith('/apps/web/src/')) {
    filePath = pathModule.join(ROOT_DIR, url);
    contentType = 'application/javascript';
  } else if (url.startsWith('/packages/ui/src/')) {
    filePath = pathModule.join(ROOT_DIR, url);
    if (url.endsWith('.css')) {
      contentType = 'text/css';
    } else {
      contentType = 'application/javascript';
    }
  } else if (url.startsWith('/packages/shared/src/')) {
    filePath = pathModule.join(ROOT_DIR, url);
    contentType = 'application/javascript';
  }

  if (filePath && fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${url}`);
  }
});

server.listen(PORT, () => {
  console.log(`[Web Server] Running at http://localhost:${PORT}`);
});

function getIndexHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Miraichi Dashboard</title>
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#0b0f19">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Miraichi">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <link rel="stylesheet" href="/packages/ui/src/index.css">
  <script type="module" src="/apps/web/src/pwa/register-service-worker.js"></script>
  <style>
    .nav-bar {
      display: flex;
      gap: 1.5rem;
      background-color: var(--miraichi-secondary);
      border-bottom: 1px solid var(--miraichi-border);
      padding: calc(1rem + env(safe-area-inset-top)) 2rem 1rem 2rem;
      align-items: center;
      overflow-x: auto;
      white-space: nowrap;
      -webkit-overflow-scrolling: touch;
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
    .nav-bar::-webkit-scrollbar {
      display: none;
    }
    .logo {
      font-weight: bold;
      color: var(--miraichi-primary);
      font-size: 1.25rem;
      margin-right: 2rem;
      text-decoration: none;
      flex-shrink: 0;
    }
    .nav-link {
      color: var(--miraichi-text-muted);
      text-decoration: none;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.2s ease;
      flex-shrink: 0;
    }
    .nav-link:hover, .nav-link.active {
      color: var(--miraichi-text);
    }
    .main-container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
      padding-bottom: calc(2rem + env(safe-area-inset-bottom));
      padding-left: calc(2rem + env(safe-area-inset-left));
      padding-right: calc(2rem + env(safe-area-inset-right));
    }
    @media (max-width: 768px) {
      .nav-bar {
        padding: calc(0.75rem + env(safe-area-inset-top)) 1rem 0.75rem 1rem;
        gap: 1rem;
      }
      .logo {
        margin-right: 1rem;
      }
      .main-container {
        padding: 1rem;
        padding-bottom: calc(1rem + env(safe-area-inset-bottom));
        padding-left: calc(1rem + env(safe-area-inset-left));
        padding-right: calc(1rem + env(safe-area-inset-right));
      }
    }
  </style>
</head>
<body>
  <nav class="nav-bar">
    <a href="#" class="logo">MIRAICHI</a>
    <a id="link-predictions" class="nav-link active">Dashboard</a>
    <a id="link-explanation" class="nav-link">AI Explanations</a>
    <a id="link-history" class="nav-link">Betting History</a>
    <a id="link-mock-predict" class="nav-link">Mock Predictions</a>
    <a id="link-mock-explain" class="nav-link">Mock Explanations</a>
  </nav>

  <main class="main-container" id="view-root"></main>

  <script type="module">
    import { renderPredictionsView } from '/apps/web/src/views/predictions-view.js';
    import { renderExplanationView } from '/apps/web/src/views/explanation-view.js';
    import { renderBetHistoryPlaceholderView } from '/apps/web/src/views/bet-history-placeholder-view.js';
    import { renderPredictionEnvelopeView } from '/apps/web/src/views/prediction-envelope-view.js';
    import { renderMockExplanationRefusalView } from '/apps/web/src/views/mock-explanation-refusal-view.js';

    const root = document.getElementById('view-root');
    const links = {
      predictions: document.getElementById('link-predictions'),
      explanation: document.getElementById('link-explanation'),
      history: document.getElementById('link-history'),
      mockPredict: document.getElementById('link-mock-predict'),
      mockExplain: document.getElementById('link-mock-explain')
    };

    function setTabActive(activeKey) {
      Object.keys(links).forEach(key => {
        if (key === activeKey) {
          links[key].classList.add('active');
        } else {
          links[key].classList.remove('active');
        }
      });
    }

    async function navigate(tab) {
      root.innerHTML = '<div style="color: var(--miraichi-primary); padding: 1rem;">Loading...</div>';
      setTabActive(tab);
      if (tab === 'predictions') {
        await renderPredictionsView(root);
      } else if (tab === 'explanation') {
        renderExplanationView(root);
      } else if (tab === 'history') {
        await renderBetHistoryPlaceholderView(root);
      } else if (tab === 'mock-predict') {
        await renderPredictionEnvelopeView(root);
      } else if (tab === 'mock-explain') {
        await renderMockExplanationRefusalView(root);
      }
    }

    links.predictions.addEventListener('click', (e) => { e.preventDefault(); navigate('predictions'); });
    links.explanation.addEventListener('click', (e) => { e.preventDefault(); navigate('explanation'); });
    links.history.addEventListener('click', (e) => { e.preventDefault(); navigate('history'); });
    links.mockPredict.addEventListener('click', (e) => { e.preventDefault(); navigate('mock-predict'); });
    links.mockExplain.addEventListener('click', (e) => { e.preventDefault(); navigate('mock-explain'); });

    // Initial Load
    navigate('predictions');
  </script>
</body>
</html>
`;
}
