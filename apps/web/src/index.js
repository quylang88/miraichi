import http from 'http';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pathModule from 'path';
import * as ts from 'typescript';


const __filename = fileURLToPath(import.meta.url);
const __dirname = pathModule.dirname(__filename);
const ROOT_DIR = pathModule.resolve(__dirname, '../../../');

const PORT = process.env.PORT || 3010;

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const url = requestUrl.pathname;

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
  } else if (url === '/preview' || url === '/preview.html') {
    filePath = pathModule.join(ROOT_DIR, 'apps/web/public/preview.html');
    contentType = 'text/html';
  } else if (
    url === '/favicon.ico' ||
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
    filePath = resolveWebSourcePath(url);
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
    serveStaticFile(res, filePath, contentType);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${url}`);
  }
});

function resolveWebSourcePath(url) {
  const requestedPath = pathModule.join(ROOT_DIR, url);
  if (fs.existsSync(requestedPath)) {
    return requestedPath;
  }

  if (url.endsWith('.js')) {
    const typescriptPath = pathModule.join(ROOT_DIR, url.replace(/\.js$/, '.ts'));
    if (fs.existsSync(typescriptPath)) {
      return typescriptPath;
    }
  }

  return requestedPath;
}

function serveStaticFile(res, filePath, contentType) {
  if (filePath.endsWith('.ts')) {
    const source = fs.readFileSync(filePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
      compilerOptions: {
        isolatedModules: true,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022
      }
    });
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(transpiled.outputText);
    return;
  }

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

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
  <meta name="theme-color" content="#000000">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Miraichi">
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icons/icon-180.png">
  <link rel="stylesheet" href="/packages/ui/src/index.css">
  <script type="module" src="/apps/web/src/pwa/register-service-worker.js"></script>
  <script type="module" src="/apps/web/src/shell-entry.js"></script>
</head>
<body>
  <div id="app-root" aria-live="polite">
    <div class="shell-loading">Loading Miraichi...</div>
  </div>
</body>
</html>
`;
}
