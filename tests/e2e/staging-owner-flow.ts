import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { gate, localStagingEnvironment, requireStagingConfig, readLocalEnv } from '../../scripts/staging-hosted-config.js';
import { liveSnapshotFixture } from '../fixtures/live-match-snapshot.js';
import { toProviderNeutralLiveMatchSnapshot, validateLiveMatchSnapshot } from '../../packages/shared/src/contracts/live-match-contracts.js';

const privateKeys = new Set(['sourceMatchId','sourceUrl','leaseId','externalCompetitionId','providerEntityId','providerFixtureId']);
function hasLocator(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasLocator);
  return typeof value === 'object' && value !== null
    && Object.entries(value).some(([key, child]) => privateKeys.has(key) || hasLocator(child));
}

export async function runStagingOwnerFlow(): Promise<void> {
  const { origin, password } = requireStagingConfig(localStagingEnvironment());
  const secretValues = [password, ...Object.entries(readLocalEnv('.secrets/edge.staging.env'))
    .filter(([key]) => /TOKEN|SECRET|PASSWORD|DATABASE/u.test(key)).map(([, value]) => value)].filter((value) => value.length >= 12);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(25_000);
  let phase = 'root';
  let authenticated = false;
  let fixtureCalls = 0;
  const networkChecks: Promise<void>[] = [];
  const pendingChecks = new Map<number, { path: string; step: string }>();
  let networkFailure = false;
  page.on('response', (response) => {
    if (!response.url().startsWith(`${origin}/api/`)) return;
    const checkId = networkChecks.length;
    pendingChecks.set(checkId, { path: new URL(response.url()).pathname, step: 'headers' });
    networkChecks.push((async () => {
      const headers = await response.allHeaders();
      pendingChecks.get(checkId)!.step = 'body';
      if (Object.keys(headers).some((key) => /^(sb-|x-supabase|x-sb-|x-region|x-deno|x-miraichi-gateway)/u.test(key))) networkFailure = true;
      // Chromium may omit loadingFinished for a 401 login response. Its body is checked below
      // with a direct request to the same hosted endpoint, while these headers remain audited.
      if (response.status() !== 204 && response.status() !== 401) {
        const text = await response.text();
        if (secretValues.some((value) => text.includes(value))) networkFailure = true;
        try { if (hasLocator(JSON.parse(text))) networkFailure = true; } catch { /* non-JSON responses checked by their route */ }
      }
    })().catch(() => { networkFailure = true; }).finally(() => pendingChecks.delete(checkId)));
  });
  try {
    const root = await page.goto(origin, { waitUntil: 'networkidle' });
    gate(root?.status() === 200, 'root');
    const html = await root.text();
    gate(html.includes('Powered by SportScore') && html.includes('rel="dofollow"'), 'crawlable attribution');
    gate(!secretValues.some((value) => html.includes(value)), 'root secret redaction');
    const health = await context.request.get('/api/v1/health');
    gate(health.status() === 200 && health.headers()['cache-control']?.includes('no-store'), 'API health');
    for (const url of await page.locator('script[src],link[rel="stylesheet"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('src') ?? node.getAttribute('href')!))) {
      const asset = await context.request.get(url);
      gate(asset.status() === 200, 'static asset');
      const content = await asset.text();
      gate(!secretValues.some((value) => content.includes(value)), 'static secret redaction');
    }
    phase = 'wrong login';
    await page.locator('input[type="password"]').fill('miraichi-deliberately-wrong-e2e-password');
    const [invalid] = await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')),
      page.locator('form button[type="submit"]').click()]);
    gate(invalid.status() === 401, 'wrong login denied');
    const denied = await context.request.post('/api/v1/auth/login', {
      headers: { origin }, data: { password: 'miraichi-deliberately-wrong-e2e-password' }
    });
    gate(denied.status() === 401, 'wrong login body probe denied');
    const deniedBody = await denied.text();
    gate(!secretValues.some((value) => deniedBody.includes(value)) && !hasLocator(JSON.parse(deniedBody)), 'wrong login body redaction');
    gate(!(await context.cookies()).some((cookie) => cookie.name === '__Host-miraichi_owner'), 'wrong login cookie absent');
    phase = 'correct login';
    await page.locator('input[type="password"]').fill(password);
    const [login] = await Promise.all([page.waitForResponse((response) => response.url().endsWith('/api/v1/auth/login')),
      page.locator('form button[type="submit"]').click()]);
    gate(login.status() === 204, 'correct owner login');
    authenticated = true;
    const cookie = (await context.cookies()).find((entry) => entry.name === '__Host-miraichi_owner');
    gate(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Strict' && cookie.path === '/', 'hardened cookie');
    gate(!(login.headers()['set-cookie'] ?? '').toLowerCase().includes('domain='), 'host-only cookie');
    gate((await (await context.request.get('/api/v1/auth/session')).json()).authenticated === true, 'session bootstrap');
    const savedCookie = `${cookie.name}=${cookie.value}`;
    for (const tab of ['today','matches','bets','bankroll']) {
      phase = `tab ${tab}`;
      await page.locator(`[data-primary-tab="${tab}"]`).click();
      await page.locator(`#screen-${tab}.active`).waitFor({ state: 'visible' });
    }
    phase = 'real LIVE';
    await page.locator('[data-primary-tab="matches"]').click();
    await page.locator('#filter-panel-toggle-btn').click();
    await page.locator('input[name="filter-type"][value="club"]').check();
    await page.locator('#match-search').fill('saved-e2e-search');
    const date = await page.locator('.date-chip.active').getAttribute('data-date');
    const [refreshed] = await Promise.all([page.waitForResponse((response) => response.url().includes('/api/v1/live/refresh?reason=manual')),
      page.getByRole('button', { name: 'LIVE', exact: true }).click()]);
    gate(refreshed.status() === 200, 'real manual live refresh');
    gate(await page.getByRole('button', { name: 'LIVE', exact: true }).getAttribute('aria-pressed') === 'true', 'LIVE active');
    gate(await page.locator('#screen-matches .date-navigator').count() === 0, 'LIVE not date restricted');
    for (const status of await page.locator('#screen-matches [data-match-row]').evaluateAll((rows) => rows.map((row) => row.getAttribute('data-status')))) {
      gate(['live','halftime','suspended'].includes(status ?? ''), 'real LIVE allowed status');
    }
    await page.locator('#screen-matches [data-live-state="ready"]').waitFor();
    await page.getByRole('button', { name: 'LIVE', exact: true }).click();
    gate(await page.locator('#match-search').inputValue() === 'saved-e2e-search', 'search restored');
    gate(await page.locator('.date-chip.active').getAttribute('data-date') === date, 'date restored');
    gate(await page.locator('input[name="filter-type"][value="club"]').isChecked(), 'filters restored');

    // Browser fixtures exercise otherwise time-dependent states. They are not provider evidence.
    phase = 'deterministic live row states';
    const snapshot = toProviderNeutralLiveMatchSnapshot(liveSnapshotFixture);
    snapshot.generatedAt = new Date().toISOString();
    snapshot.matches = ['live','halftime','suspended','completed'].map((status, index) => ({ ...snapshot.matches[0],
      matchId: `match-e2e-browser-${index}`, status: status as 'live' | 'halftime' | 'suspended' | 'completed',
      ...(status === 'completed' ? { period: null, elapsedMinute: null } : {}) }));
    snapshot.coverage.publishedCount = snapshot.matches.length;
    snapshot.coverage.mappedCount = snapshot.matches.length;
    gate(validateLiveMatchSnapshot(snapshot).ok, 'valid deterministic live fixture');
    await page.route('**/api/v1/live/refresh?reason=manual', (route) => {
      fixtureCalls++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ snapshot, refresh: { outcome: 'fresh' } }) });
    });
    phase = 'deterministic live rows';
    console.log(JSON.stringify({ gate: 'hosted-browser', stage: phase }));
    await page.getByRole('button', { name: 'LIVE', exact: true }).click();
    await page.locator('[data-live-match-id="match-e2e-browser-2"]').waitFor();
    gate(await page.locator('#screen-matches [data-match-row]').count() === 3, 'only live/halftime/suspended rows');
    gate(await page.locator('[data-live-score]').first().textContent() === '2 – 1', 'live score');
    gate((await page.locator('[data-live-minute]').first().textContent())?.includes('67'), 'elapsed minute');
    await page.getByRole('button', { name: 'LIVE', exact: true }).click();
    snapshot.matches = [];
    snapshot.coverage.publishedCount = 0;
    snapshot.coverage.mappedCount = 0;
    phase = 'deterministic empty state';
    console.log(JSON.stringify({ gate: 'hosted-browser', stage: phase }));
    await page.getByRole('button', { name: 'LIVE', exact: true }).click();
    await page.locator('[data-live-empty]').waitFor();
    gate(await page.locator('#screen-matches [data-match-row]').count() === 0, 'empty live list');
    await page.unroute('**/api/v1/live/refresh?reason=manual');
    phase = 'logout';
    console.log(JSON.stringify({ gate: 'hosted-browser', stage: phase }));
    gate((await context.request.post('/api/v1/auth/logout', { headers: { origin } })).status() === 204, 'logout');
    authenticated = false;
    gate((await context.request.get('/api/v1/matches')).status() === 401, 'session cleared');
    gate((await context.request.get('/api/v1/matches', { headers: { cookie: savedCookie } })).status() === 401, 'logged out cookie replay denied');
    phase = 'network audit';
    console.log(JSON.stringify({ gate: 'hosted-browser', stage: phase }));
    let auditTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([Promise.all(networkChecks), new Promise<never>((_, reject) => {
        auditTimer = setTimeout(() => reject(new Error('Hosted gate failed: response audit timeout')), 15_000);
      })]);
    } finally { clearTimeout(auditTimer); }
    gate(!networkFailure, 'network locators/headers/secrets redacted');
    console.log(JSON.stringify({ gate: 'hosted-browser', status: 'passed', origin, realOwnerFlow: true, deterministicLiveStates: true, ownerDataCreated: false }));
  } catch (error) {
    console.log(JSON.stringify({ gate: 'hosted-browser-diagnostic', phase, fixtureCalls,
      pendingChecks: [...pendingChecks.values()],
      liveRows: await page.locator('[data-live-match-id]').count(),
      empty: await page.locator('[data-live-empty]').evaluateAll((nodes) => nodes.map((node) => ({
        display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility,
        height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width,
        parent: node.parentElement?.getAttribute('data-live-state')
      }))),
      liveState: await page.locator('[data-live-state]').getAttribute('data-live-state').catch(() => null),
      active: await page.locator('[data-live-toggle]').getAttribute('aria-pressed').catch(() => null) }));
    const detail = error instanceof Error && error.message.startsWith('Hosted gate failed:') ? ` (${error.message})` : '';
    throw new Error(`Hosted browser gate failed during ${phase}${detail}`);
  } finally {
    try {
      if (authenticated) gate((await context.request.post('/api/v1/auth/logout', { headers: { origin } })).status() === 204, 'finally logout cleanup');
    } finally {
      try { await context.close(); } finally { await browser.close(); }
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void runStagingOwnerFlow().catch((error) => { console.error(error instanceof Error ? error.message : 'Hosted browser gate failed'); process.exitCode = 1; });
}
