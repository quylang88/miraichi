import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, webkit, type BrowserType } from 'playwright';
import type { CloudBetRecord, SettlementCommand } from '@miraichi/shared';

const dist = path.resolve('apps/web/dist');
const now = '2026-09-16T02:00:00.000Z';
const completedMatch = {
  id: 'match-1', competition: { id: 'league', name: 'League', type: 'club' as const, season: '2026-27' },
  kickoffUtc: '2026-09-15T18:00:00.000Z', status: 'completed' as const,
  homeTeam: { id: 'home', name: 'Home' }, awayTeam: { id: 'away', name: 'Away' },
  score: { home: 2, away: 1 }, sourceRefs: [{ sourceId: 'manual-snapshot' as const, importedAt: now }], updatedAt: now
};
const base = {
  ownerProfileId: 'owner-primary', bankrollAccountId: 'account', homeTeamName: 'Home', awayTeamName: 'Away',
  marketType: '1X2' as const, selectionCode: 'home' as const, selectionLabel: 'Home · FT', marketPeriod: 'full_time' as const,
  oddsFormat: 'HK' as const, oddsValue: 0.9, stakePoints: 10, preBetEmotion: 'calm' as const, createdAt: now, updatedAt: now
};
const initialRecords: CloudBetRecord[] = [
  { ...base, betId: 'bet-pending', matchGroupId: 'match-2', matchId: 'match-2', status: 'pending' },
  { ...base, betId: 'bet-manual', matchGroupId: 'match-1', matchId: 'match-1', status: 'pending', settlementReviewStatus: 'manual_required', settlementReviewReason: 'missing_half_time_score', settlementEvidenceAt: now },
  { ...base, betId: 'bet-auto', matchGroupId: 'match-3', matchId: 'match-3', status: 'settled', settlementType: 'full_win', profitLossPoints: 9, settledAt: now, settlementReviewStatus: 'auto_settled', settlementEvidenceAt: now }
];
const records = structuredClone(initialRecords);
const commands: SettlementCommand[] = [];
const report = { period: { kind: 'week', startDate: '2026-09-16', endDate: '2026-09-16', timeZone: 'UTC' }, netProfitLossPoints: 0,
  totalSettledBets: 0, totalStakePoints: 0, averageStakePoints: 0, winRatePercent: 0, outcomes: {}, daily: [], market: {},
  psychology: { emotion: {}, motivation: {}, planAdherence: {} }, disciplineOverrideCount: 0 };
const snapshot = { snapshotId: 'settlement-review', generatedAt: now, importedAt: now, matchCount: 0, competitions: [], sources: [], freshness: 'fresh', warnings: [] };

function json(res: import('node:http').ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/v1/auth/session') return json(res, { authenticated: true });
  if (url.pathname === '/api/v1/bets') return json(res, records);
  if (url.pathname === '/api/v1/bet-drafts') return json(res, []);
  if (url.pathname === '/api/v1/bankroll/accounts') return json(res, []);
  if (url.pathname === '/api/v1/discipline-config') return json(res, null);
  if (url.pathname === '/api/v1/bet-reports') return json(res, report);
  if (url.pathname === '/api/v1/matches') return json(res, { matches: [], snapshot });
  if (url.pathname === '/api/v1/live/refresh') return json(res, { snapshot: { schemaVersion: 'miraichi.live-match-snapshot.v1', snapshotId: 'empty', generatedAt: now,
    coverage: { kind: 'registered-daily-window', upstreamLimit: 0, upstreamCount: 0, mappedCount: 0, publishedCount: 0, terminalCheckCount: 0, retainedTrackedCount: 0 }, matches: [], warnings: [] }, refresh: { outcome: 'fresh' } });
  if (url.pathname === '/api/v1/matches/detail/refresh' && req.method === 'POST') {
    const record = records.find((item) => item.betId === 'bet-manual')!;
    Object.assign(record, { status: 'settled', settlementType: 'full_win', profitLossPoints: 9, settledAt: now, settlementReviewStatus: 'auto_settled', settlementEvidenceAt: now, updatedAt: now });
    delete record.settlementReviewReason;
    return json(res, { match: completedMatch, status: 'completed', elapsedMinute: 90, scoreBreakdown: { halftime: { home: 1, away: 0 }, fulltime: { home: 2, away: 1 }, extratime: { home: null, away: null }, penalty: { home: null, away: null } }, events: [], updatedAt: now,
      refresh: { outcome: 'refreshed', lastSuccessAt: now, retryAfterSeconds: 60 } });
  }
  const settlement = url.pathname.match(/^\/api\/v1\/bets\/([^/]+)\/settlements$/u);
  if (settlement && req.method === 'GET') return json(res, []);
  if (settlement && req.method === 'POST') {
    const command = await readJson(req) as unknown as SettlementCommand;
    commands.push(command);
    const record = records.find((item) => item.betId === settlement[1])!;
    const profitLossPoints = command.settlementType === 'half_win' ? 4.5 : command.settlementType === 'full_win' ? 9 : -10;
    Object.assign(record, { status: 'settled', settlementType: command.settlementType, profitLossPoints, settledAt: now, updatedAt: now });
    delete record.settlementReviewStatus; delete record.settlementReviewReason; delete record.settlementEvidenceAt;
    return json(res, { idempotent: false, record, account: { currentBalancePoints: 104.5 },
      event: { ...command, ownerProfileId: 'owner-primary', betId: record.betId, bankrollAccountId: 'account', calculatedProfitLossPoints: profitLossPoints, ledgerDeltaPoints: profitLossPoints, occurredAt: now },
      ledgerEntry: { entryId: `settlement:${command.settlementEventId}`, ownerProfileId: 'owner-primary', accountId: 'account', entryType: 'bet_settlement', amountPoints: profitLossPoints, occurredAt: now } });
  }
  if (url.pathname.startsWith('/api/')) return json(res, { error: { code: 'fixture_route_missing' } }, 404);
  if (url.pathname === '/dev/live-reload') { res.writeHead(204); res.end(); return; }
  const file = path.resolve(dist, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!file.startsWith(`${dist}${path.sep}`) || !existsSync(file)) return json(res, {}, 404);
  const mime = ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' } as Record<string, string>)[path.extname(file)] ?? 'application/octet-stream';
  let body = readFileSync(file);
  if (url.pathname === '/' || url.pathname === '/index.html') body = Buffer.from(body.toString('utf8').replace(/API_URL:\s*"[^"]*"/u, 'API_URL: ""'));
  res.writeHead(200, { 'content-type': mime }); res.end(body);
});

async function runBrowser(browserType: BrowserType) {
  records.splice(0, records.length, ...structuredClone(initialRecords)); commands.length = 0;
  const browser = await browserType.launch({ headless: true });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture server is unavailable');
    const page = await browser.newPage({ baseURL: `http://127.0.0.1:${address.port}`, viewport: { width: 320, height: 568 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(10_000);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-owner-session="authenticated"]').waitFor();
    await page.locator('[data-primary-tab="bets"]').click();
    const manual = page.locator('[data-bet-id="bet-manual"]');
    await manual.locator('[data-settlement-review="manual_required"]').waitFor();
    assert.match(await manual.textContent() ?? '', /trusted half-time score/i);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await manual.locator('[data-refresh-settlement-evidence="match-1"]').click();
    await manual.waitFor({ state: 'detached' });
    await page.locator('[data-bet-filter="settled"]').click();
    await page.locator('[data-bet-id="bet-manual"] [data-settlement-review="auto_settled"]').waitFor();

    await page.locator('[data-bet-filter="ongoing"]').click();
    await page.locator('[data-bet-id="bet-pending"] [data-open-settlement]').click();
    await page.locator('#settlement-type').selectOption('half_win');
    await page.locator('#settlement-form button[type="submit"]').click();
    await page.locator('[data-bet-id="bet-pending"]').waitFor({ state: 'detached' });
    assert.equal(commands.at(-1)?.settlementType, 'half_win');
    await page.locator('[data-bet-filter="settled"]').click();
    const ownerSettled = page.locator('[data-bet-id="bet-pending"]');
    await ownerSettled.waitFor();
    assert.match(await ownerSettled.textContent() ?? '', /\+4\.5 pts/);
    assert.equal(await ownerSettled.locator('[data-settlement-review="settled"]').count(), 1);
  } finally {
    await browser.close();
  }
}

async function run() {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await runBrowser(chromium);
    await runBrowser(webkit);
    console.log(JSON.stringify({ gate: 'settlement-review-local-browser', status: 'passed', browsers: ['chromium', 'webkit'], ownerDataCreated: false }));
  } finally {
    records.length = 0; commands.length = 0;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
