import http from 'http';
import url from 'url';
import { handleHealth } from './routes/health.js';
import { handlePredict, handleExplain } from './routes/prediction-candidates.mock.js';

const PORT = 3002;

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[local-ai] Received ${req.method} ${req.url}`);

  if (pathname === '/ai/v1/health') {
    handleHealth(req, res);
  } else if (pathname === '/ai/v1/predict') {
    handlePredict(req, res);
  } else if (pathname === '/ai/v1/explain') {
    handleExplain(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
  }
});

server.listen(PORT, () => {
  console.log(`[Local AI Server] Running at http://localhost:${PORT}`);
});
