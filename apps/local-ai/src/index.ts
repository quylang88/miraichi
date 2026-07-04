import http from 'http';
import { handleHealth } from './routes/health.js';
import { handlePredict, handleExplain } from './routes/prediction-candidates.mock.js';
import { handleMockPredict } from './routes/mock-prediction.js';
import { handleMockExplain } from './routes/mock-explanation.js';

const configuredPort = process.env.PORT
  ?? (process.env.LOCAL_AI_URL ? new URL(process.env.LOCAL_AI_URL).port : undefined)
  ?? '3002';
const PORT = Number(configuredPort);

if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error('Local AI PORT must be a positive integer.');
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = parsedUrl.pathname;

  console.log(`[local-ai] Received ${req.method} ${req.url}`);

  if (pathname === '/ai/v1/health') {
    handleHealth(req, res);
  } else if (pathname === '/ai/v1/predict') {
    handlePredict(req, res);
  } else if (pathname === '/ai/v1/explain') {
    handleExplain(req, res);
  } else if (pathname === '/ai/v1/mock/predict') {
    handleMockPredict(req, res);
  } else if (pathname === '/ai/v1/mock/explain') {
    handleMockExplain(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
  }
});

server.listen(PORT, () => {
  console.log(`[Local AI Server] Running at http://localhost:${PORT}`);
});
