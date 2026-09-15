import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Page, type Route } from 'playwright';
import { liveSnapshotFixture } from '../fixtures/live-match-snapshot.js';
import { toProviderNeutralLiveMatchSnapshot } from '../../packages/shared/src/contracts/live-match-contracts.js';
import { localStagingEnvironment, requireStagingConfig } from '../../scripts/staging-hosted-config.js';

const dist = path.resolve('apps/web/dist');
const now = new Date().toISOString();
const today = now.slice(0, 10);
const scheduledMatch = {
  id: 'match-structured-scheduled',
  competition: { id: 'structured-league', name: 'Structured League', type: 'club', season: '2026' },
  kickoffUtc: `${today}T18:00:00.000Z`, status: 'scheduled',
  homeTeam: { id: 'scheduled-home', name: 'Scheduled Home' },
  awayTeam: { id: 'scheduled-away', name: 'Scheduled Away' },
  score: { home: null, away: null },
  sourceRefs: [{ sourceId: 'manual-snapshot', importedAt: now }], updatedAt: now
};
const snapshotStatus = {
  snapshotId: 'structured-add-bet-browser', generatedAt: now, importedAt: now,
  matchCount: 1, competitions: [{ id: 'structured-league', name: 'Structured League', seasons: ['2026'], matchCount: 1 }],
  sources: [{ sourceId: 'manual-snapshot', importedAt: now }], freshness: 'fresh', warnings: []
};
const liveSnapshot = toProviderNeutralLiveMatchSnapshot(liveSnapshotFixture);
liveSnapshot.generatedAt = now;
liveSnapshot.snapshotId = `structured-live-${now}`;
liveSnapshot.matches = liveSnapshot.matches.map((match) => ({ ...match, updatedAt: now }));
const seededDraft = {
  draftId: 'structured-edit-draft', matchGroupId: 'manual:edit-home-edit-away',
  homeTeamName: 'Edit Home', awayTeamName: 'Edit Away', marketType: 'handicap', marketPeriod: 'full_time',
  selectionCode: 'away', lineValue: 0.25, selectionLabel: 'Edit Away +0.25 · FT',
  oddsFormat: 'HK', oddsValue: 0.91, stakePoints: 7, preBetEmotion: 'excited',
  preBetMotivation: 'familiar_market', preBetPlanAdherence: 'yes', createdAt: now, updatedAt: now
};
const drafts: Record<string, unknown>[] = [seededDraft];

const report = {
  period: { kind: 'week', startDate: today, endDate: today, timeZone: 'UTC' },
  netProfitLossPoints: 0, totalSettledBets: 0, totalStakePoints: 0, averageStakePoints: 0,
  winRatePercent: 0, outcomes: {}, daily: [], market: {},
  psychology: { emotion: {}, motivation: {}, planAdherence: {} }, disciplineOverrideCount: 0
};

function json(res: import('node:http').ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function fulfillFixtureApi(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  const method = request.method();
  let body: unknown = { error: { code: 'fixture_route_missing' } };
  let status = 200;
  if (url.pathname === '/api/v1/auth/session') body = { authenticated: true };
  else if (url.pathname === '/api/v1/matches') body = { matches: [scheduledMatch], snapshot: snapshotStatus };
  else if (url.pathname === '/api/v1/live/refresh') body = { snapshot: liveSnapshot, refresh: { outcome: 'fresh' } };
  else if (url.pathname === '/api/v1/bets') body = [];
  else if (url.pathname === '/api/v1/bet-drafts' && method === 'GET') body = drafts;
  else if (url.pathname === '/api/v1/bet-drafts' && method === 'DELETE') { status = 204; body = ''; }
  else if (url.pathname === '/api/v1/bet-drafts' && ['POST', 'PUT'].includes(method)) {
    const draft = request.postDataJSON() as Record<string, unknown>;
    const index = drafts.findIndex((item) => item.draftId === draft.draftId);
    if (index >= 0) drafts[index] = draft; else drafts.push(draft);
    body = draft; status = method === 'POST' ? 201 : 200;
  } else if (url.pathname === '/api/v1/bankroll/accounts') body = [];
  else if (url.pathname === '/api/v1/discipline-config') body = null;
  else if (url.pathname === '/api/v1/bet-reports') body = report;
  else status = 404;
  await route.fulfill({ status, contentType: 'application/json', body: status === 204 ? '' : JSON.stringify(body) });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/api/v1/auth/session') return json(res, { authenticated: true });
  if (url.pathname === '/api/v1/matches') return json(res, { matches: [scheduledMatch], snapshot: snapshotStatus });
  if (url.pathname === '/api/v1/live/refresh') return json(res, { snapshot: liveSnapshot, refresh: { outcome: 'fresh' } });
  if (url.pathname === '/api/v1/bets') return json(res, []);
  if (url.pathname === '/api/v1/bet-drafts') {
    if (req.method === 'GET') return json(res, drafts);
    if (req.method === 'DELETE') {
      const index = drafts.findIndex((draft) => draft.draftId === url.searchParams.get('id'));
      if (index >= 0) drafts.splice(index, 1);
      res.writeHead(204); res.end(); return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const draft = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
    const index = drafts.findIndex((item) => item.draftId === draft.draftId);
    if (index >= 0) drafts[index] = draft; else drafts.push(draft);
    return json(res, draft, req.method === 'POST' ? 201 : 200);
  }
  if (url.pathname === '/api/v1/bankroll/accounts') return json(res, []);
  if (url.pathname === '/api/v1/discipline-config') return json(res, null);
  if (url.pathname === '/api/v1/bet-reports') return json(res, report);
  if (url.pathname.startsWith('/api/')) return json(res, { error: { code: 'fixture_route_missing' } }, 404);
  if (url.pathname === '/dev/live-reload') { res.writeHead(204); res.end(); return; }

  const file = path.resolve(dist, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  if (!file.startsWith(`${dist}${path.sep}`) || !existsSync(file)) return json(res, {}, 404);
  const mime = ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml' } as Record<string, string>)[path.extname(file)] ?? 'application/octet-stream';
  let body = readFileSync(file);
  if (url.pathname === '/' || url.pathname === '/index.html') {
    body = Buffer.from(body.toString('utf8').replace(/API_URL:\s*"[^"]*"/, 'API_URL: ""'));
  }
  res.writeHead(200, { 'content-type': mime }); res.end(body);
});

function visible(page: Page, selector: string) { return page.locator(`${selector}:visible`); }

async function closeAdd(page: Page) {
  await page.locator('#add-sheet [data-close-sheet]').click();
  await assertHidden(page, '#add-sheet');
}

async function assertHidden(page: Page, selector: string) {
  assert.equal(await page.locator(selector).getAttribute('aria-hidden'), 'true', `${selector} must be closed`);
}

async function assertFreshSession(page: Page, homeTeamName: string, awayTeamName: string) {
  assert.equal(await page.locator('#home-team').inputValue(), homeTeamName, 'new session binds selected home team');
  assert.equal(await page.locator('#away-team').inputValue(), awayTeamName, 'new session binds selected away team');
  assert.equal(await page.locator('#home-team').isEditable(), false);
  assert.equal(await page.locator('#away-team').isEditable(), false);
  assert.equal(await page.locator('#emotion-field').inputValue(), 'calm', 'new session emotion defaults to calm');
  assert.equal(await page.locator('[data-bet-market][aria-pressed="true"]').count(), 0, 'new session clears market');
  assert.equal(await page.locator('#selection-code-field').inputValue(), '', 'new session clears selection');
  assert.equal(await page.locator('#line-value-field').inputValue(), '', 'new session clears line');
}

async function assertMarketControls(page: Page) {
  await page.locator('[data-bet-market="1X2"]').click();
  await page.locator('[data-bet-period="full_time"]').click();
  assert.deepEqual(await visible(page, '[data-bet-selection]').allTextContents(), ['Home', 'Draw', 'Away']);
  await page.locator('[data-bet-selection="home"]').click();

  await page.locator('[data-bet-market="over_under"]').click();
  assert.equal(await page.locator('#selection-code-field').inputValue(), '');
  await page.locator('[data-bet-period="full_time"]').click();
  assert.deepEqual(await visible(page, '[data-bet-selection]').allTextContents(), ['Over', 'Under']);
  await page.locator('[data-bet-selection="over"]').click();
  assert.ok((await visible(page, '[data-bet-line]').allTextContents()).includes('2.5'));
  await page.locator('[data-bet-line="2.5"]').click();

  await page.locator('[data-bet-market="handicap"]').click();
  assert.equal(await page.locator('#selection-code-field').inputValue(), '');
  await page.locator('[data-bet-period="full_time"]').click();
  assert.deepEqual(await visible(page, '[data-bet-selection]').allTextContents(), ['Home', 'Away']);
  await page.locator('[data-bet-selection="away"]').click();
  assert.ok((await visible(page, '[data-bet-line]').allTextContents()).some((line) => line.includes('+0.25')));

  await page.locator('[data-bet-market="corners"]').click();
  await page.locator('[data-bet-period="first_half"]').click();
  assert.deepEqual(await visible(page, '[data-bet-selection]').allTextContents(), ['Over', 'Under']);
}

async function verifyZoomRuntime(page: Page) {
  const result = await page.evaluate(() => {
    const gesture = new Event('gesturestart', { cancelable: true });
    const first = new Event('touchend', { cancelable: true });
    const second = new Event('touchend', { cancelable: true });
    return {
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
      gestureAllowed: document.dispatchEvent(gesture),
      firstAllowed: document.dispatchEvent(first),
      secondAllowed: document.dispatchEvent(second),
      touchAction: getComputedStyle(document.documentElement).touchAction,
      formFont: getComputedStyle(document.querySelector('.field-input')!).fontSize
    };
  });
  assert.match(result.viewport, /maximum-scale=1.*user-scalable=no/);
  assert.equal(result.gestureAllowed, false);
  assert.equal(result.firstAllowed, true);
  assert.equal(result.secondAllowed, false);
  assert.equal(result.touchAction, 'pan-x pan-y');
  assert.equal(result.formFont, '16px');
}

async function runBrowserFlow(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-owner-session="authenticated"]').waitFor();
  assert.equal(await page.locator('[data-open-manual-add]').count(), 0, 'unscoped Add and Today Quick Add are removed');
  await page.locator('[data-primary-tab="matches"]').click();
  await page.locator('[data-match-id="match-structured-scheduled"][data-open-match]').click();
  await page.locator('[data-open-scoped-add]').click();
  await assertFreshSession(page, 'Scheduled Home', 'Scheduled Away');
  await page.locator('[data-bet-market="over_under"]').click();
  await page.locator('[data-bet-period="full_time"]').click();
  await page.locator('[data-bet-selection="over"]').click();
  await page.locator('[data-bet-line="2.5"]').click();
  await closeAdd(page);
  await page.locator('[data-open-scoped-add]').click();
  await assertFreshSession(page, 'Scheduled Home', 'Scheduled Away');
  await page.setViewportSize({ width: 320, height: 568 });
  const teamRow = await page.locator('.add-bet-team-row').evaluate((row) => ({
    columns: getComputedStyle(row).gridTemplateColumns,
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  assert.equal(teamRow.overflow, false);
  assert.equal(teamRow.columns.split(' ').length, 3);
  await assertMarketControls(page);
  await closeAdd(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-open-scoped-add]').click();
  assert.equal(await page.locator('#home-team').inputValue(), 'Scheduled Home');
  assert.equal(await page.locator('#away-team').inputValue(), 'Scheduled Away');
  assert.notEqual(await page.locator('#home-team').getAttribute('readonly'), null);
  await closeAdd(page);
  await page.locator('[data-open-scoped-add]').click();
  await assertFreshSession(page, 'Scheduled Home', 'Scheduled Away');
  await page.locator('[data-bet-market="running"]').click();
  assert.equal(await page.locator('[data-running-context-source="manual"]').getAttribute('aria-pressed'), 'true');
  await page.locator('#live-score-home-field').fill('1');
  await page.locator('#live-score-away-field').fill('0');
  await page.locator('#live-minute-field').fill('22');
  await page.locator('[data-running-window="fixed_15"][data-window-start="15"]').click();
  assert.equal(await page.locator('#live-minute-field').inputValue(), '22');
  await closeAdd(page);

  await page.locator('#match-detail-back').click();
  await page.locator('[data-live-toggle]').click();
  await page.locator(`[data-live-match-id="${liveSnapshot.matches[0]!.matchId}"]`).waitFor();
  await page.locator(`[data-live-match-id="${liveSnapshot.matches[0]!.matchId}"][data-open-match]`).click();
  await page.locator('[data-open-scoped-add]').click();
  await page.locator('[data-bet-market="running"]').click();
  assert.equal(await page.locator('[data-running-context-source="snapshot"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#live-score-home-field').inputValue(), '2');
  assert.equal(await page.locator('#live-score-away-field').inputValue(), '1');
  assert.equal(await page.locator('#live-minute-field').inputValue(), '67');
  assert.notEqual(await page.locator('#live-minute-field').getAttribute('readonly'), null);
  assert.equal(await page.locator('[data-running-window="fixed_15"][data-window-start="45"]').isDisabled(), true);
  assert.equal(await page.locator('[data-running-window="fixed_15"][data-window-start="60"]').isDisabled(), false);
  await closeAdd(page);

  await page.locator('[data-primary-tab="bets"]').click();
  await page.locator('[data-bet-filter="drafts"]').click();
  await page.locator('[data-edit-draft="structured-edit-draft"]').click();
  assert.equal(await page.locator('#home-team').inputValue(), 'Edit Home');
  assert.equal(await page.locator('#away-team').inputValue(), 'Edit Away');
  assert.equal(await page.locator('#home-team').isEditable(), false);
  assert.equal(await page.locator('#away-team').isEditable(), false);
  assert.equal(await page.locator('#record-ongoing-bet').isDisabled(), true, 'unlinked legacy draft may be edited but cannot create an unlinked new bet');
  assert.equal(await page.locator('#emotion-field').inputValue(), 'excited');
  assert.equal(await page.locator('#motivation-field').count(), 0);
  assert.equal(await page.locator('#pre-bet-plan-adherence').count(), 0);
  assert.equal(await page.locator('[data-bet-market="handicap"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-bet-selection="away"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#line-value-field').inputValue(), '0.25');
  await verifyZoomRuntime(page);
  await page.locator('#save-draft-shell').click();
  await assertHidden(page, '#add-sheet');
  assert.equal(drafts.find((draft) => draft.draftId === seededDraft.draftId)?.preBetMotivation, 'familiar_market', 'editing a legacy draft preserves its motivation');
  assert.equal(drafts.find((draft) => draft.draftId === seededDraft.draftId)?.preBetPlanAdherence, 'yes', 'editing a legacy draft preserves its plan adherence');
}

async function run() {
  const hosted = process.argv.includes('--staging');
  let baseURL: string;
  if (hosted) {
    baseURL = requireStagingConfig(localStagingEnvironment()).origin;
  } else {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Structured Add Bet fixture server address missing');
    baseURL = `http://127.0.0.1:${address.port}`;
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ baseURL, timezoneId: 'UTC', viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(10_000);
    if (hosted) await page.route('**/api/v1/**', fulfillFixtureApi);
    await runBrowserFlow(page);
    console.log(JSON.stringify({ gate: `structured-add-bet-${hosted ? 'staging' : 'local'}-browser`, status: 'passed', providerEvidence: false, ownerDataCreated: false }));
  } finally {
    await browser.close();
    if (!hosted) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

void run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Structured Add Bet browser gate failed');
  process.exitCode = 1;
});
