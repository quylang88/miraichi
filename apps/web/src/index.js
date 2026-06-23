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

  // Static File Routing for Packages and Web Client Code
  if (url.startsWith('/apps/web/src/')) {
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
  <meta name="viewport" content="width=device-width, initial-scale=initial-scale=1.0">
  <title>Miraichi Dashboard</title>
  <link rel="stylesheet" href="/packages/ui/src/index.css">
  <style>
    .nav-bar {
      display: flex;
      gap: 1.5rem;
      background-color: var(--miraichi-secondary);
      border-bottom: 1px solid var(--miraichi-border);
      padding: 1rem 2rem;
      align-items: center;
    }
    .logo {
      font-weight: bold;
      color: var(--miraichi-primary);
      font-size: 1.25rem;
      margin-right: 2rem;
      text-decoration: none;
    }
    .nav-link {
      color: var(--miraichi-text-muted);
      text-decoration: none;
      font-weight: 500;
      cursor: pointer;
      transition: color 0.2s ease;
    }
    .nav-link:hover, .nav-link.active {
      color: var(--miraichi-text);
    }
    .main-container {
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
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
