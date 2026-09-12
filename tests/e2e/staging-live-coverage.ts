import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { localStagingEnvironment, requireStagingConfig, gate } from '../../scripts/staging-hosted-config.js';
import { FotMobDailyClient } from '../../apps/worker/src/sources/fotmob/fotmob-daily-client.js';
import { COMPETITION_SOURCE_REGISTRY } from '../../packages/config/src/index.js';
import type { LocalMatch, PublicLiveMatchSnapshot } from '../../packages/shared/src/index.js';
import { resolveLeagueRoot } from '../../apps/worker/src/sources/fotmob/fotmob-daily-adapter.js';

// This gate requires current real matches; no fixture or route interception can satisfy it.
async function main() {
  const { origin, password } = requireStagingConfig(localStagingEnvironment());
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' });
  mkdirSync('output/playwright/live-empty', { recursive: true });
  try {
    gate((await context.request.post('/api/v1/auth/login', { headers: { origin }, data: { password } })).status() === 204, 'daily live login');
    const page = await context.newPage(); let detailRequests = 0;
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/v1/matches/detail')) detailRequests++; });
    await page.goto(origin); await page.locator('[data-primary-tab="matches"]').click();
    const pending = page.waitForResponse(response => response.url().includes('/api/v1/live/refresh?reason=manual'));
    await page.locator('[data-live-toggle]').click();
    const response = await pending; gate(response.status() === 200, 'actual LIVE refresh');
    const body = await response.text(); const result = JSON.parse(body) as { snapshot: PublicLiveMatchSnapshot };
    const snapshot = result.snapshot;
    const active = snapshot.matches.filter(match => ['live', 'halftime', 'suspended'].includes(match.status));
    await page.screenshot({ path: 'output/playwright/live-empty/actual-live.png' });
    gate(active.length > 0, 'nonempty real LIVE before opening detail');
    gate(snapshot.coverage.kind === 'registered-daily-window', 'registered daily source enabled');
    gate(Date.now() - Date.parse(snapshot.generatedAt) < 6 * 60_000, 'real LIVE freshness');
    gate(!body.includes('sourceMatchId') && !body.includes('sourceUrl') && !body.includes(password), 'public LIVE redaction');
    await page.locator(`[data-live-match-id="${active[0]!.matchId}"]`).waitFor();
    gate(await page.locator('[data-live-match-id]').count() === active.length, 'all active API rows render');
    const now = new Date(); const date = now.toISOString().slice(0, 10);
    const source = await new FotMobDailyClient({ timeoutMs: 8000 }).getDailyMatches({ date, timeZone: 'UTC', ownerCountryCode: 'JPN' });
    gate(source.status === 'modified', 'independent daily source response');
    const feedResponse = await context.request.get(`/api/v1/matches?date=${date}&timezone=UTC`);
    const feed = await feedResponse.json() as { matches: LocalMatch[] };
    const roots = new Map(COMPETITION_SOURCE_REGISTRY.flatMap(entry => entry.sourceBindings.result?.externalNumericId
      ? [[entry.sourceBindings.result.externalNumericId, entry] as const] : []));
    const checked: { matchId: string; league: string; home: string; away: string; score: { home: number; away: number }; status: string }[] = [];
    for (const league of source.payload.leagues) {
      const root = resolveLeagueRoot(league, roots); if (!root.valid || !root.entry) continue;
      for (const raw of league.matches) {
        if (!raw.status?.started || raw.status.finished) continue;
        const canonical = feed.matches.filter(match => match.competition.id === root.entry!.competitionId
          && match.homeTeam.name === raw.home?.name && match.awayTeam.name === raw.away?.name
          && Date.parse(match.kickoffUtc) === Date.parse(raw.status!.utcTime ?? ''));
        if (canonical.length !== 1) continue;
        const match = active.find(row => row.matchId === canonical[0]!.id);
        if (!match || match.score.home !== raw.home?.score || match.score.away !== raw.away?.score) continue;
        const row = page.locator(`[data-live-match-id="${match.matchId}"]`);
        gate(await row.locator('[data-live-score]').textContent() === `${match.score.home} – ${match.score.away}`, 'real displayed score equals source');
        checked.push({ matchId: match.matchId, league: match.competition.name, home: match.homeTeam.name, away: match.awayTeam.name, score: match.score, status: match.status });
      }
    }
    gate(checked.length >= 3 && new Set(checked.map(m => m.league)).size >= 2, 'three real source-confirmed matches across two leagues');
    gate(detailRequests === 0, 'real LIVE requires no detail requests');
    const evidence = { gate: 'staging-real-live-coverage', status: 'passed', at: new Date().toISOString(), generatedAt: snapshot.generatedAt,
      active: active.length, checked, warnings: snapshot.warnings, detailRequests, mocked: false };
    writeFileSync('output/playwright/live-empty/real-live-evidence.json', JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence));
  } finally {
    await context.request.post('/api/v1/auth/logout', { headers: { origin } });
    await context.close(); await browser.close();
  }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Real LIVE staging gate failed'); process.exitCode = 1; });
