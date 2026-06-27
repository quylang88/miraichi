import { MOCK_BETS } from '@miraichi/shared';

/**
 * Handles GET /api/v1/bets.
 * Returns read-only mock bet history logs (Option B Product Boundary).
 */
export function handleBetHistory(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Rule Check: Read-only audit records, no stake/payout/bankroll calculations, no persistence
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(MOCK_BETS));
}
