import { chromium, type Page } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gate, localStagingEnvironment, requireStagingConfig } from '../../scripts/staging-hosted-config.js';
import { getLocalDateFromUtc, toProviderNeutralLiveMatchSnapshot, validateLiveMatchSnapshot, type LocalMatch, type LiveMatchSnapshot } from '../../packages/shared/src/index.js';
import { adaptSportScoreLiveRecords } from '../../apps/api/src/live/sportscore-live-adapter.js';
import { capturedCanonicalMatch, capturedWidgetMatch, capturedMlsMatch, crossLeagueTargets } from '../fixtures/cross-league-score-live.js';

async function selectDate(page: Page, date: string) {
  await page.locator('#date-picker-btn').click();
  for (let attempt = 0; attempt < 24; attempt++) {
    if (await page.locator(`[data-matches-cal-date="${date}"]`).count()) break;
    const first = await page.locator('[data-matches-cal-date]').first().getAttribute('data-matches-cal-date');
    gate(first, 'calendar date available');
    await page.locator(`[data-matches-cal-nav="${first < date ? 'next' : 'prev'}"]`).click();
  }
  await page.locator(`[data-matches-cal-date="${date}"]`).click();
}

export async function runStagingScoreLive() {
  const { origin, password } = requireStagingConfig(localStagingEnvironment());
  mkdirSync('output/playwright/score-live', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const timezoneId of ['UTC', 'Asia/Tokyo']) {
      const context = await browser.newContext({ baseURL: origin, viewport: { width: 390, height: 844 }, timezoneId, serviceWorkers: 'block' });
      try {
        gate((await context.request.post('/api/v1/auth/login', { headers: { origin }, data: { password } })).status() === 204, 'score regression login');
        const targets = [...crossLeagueTargets.map(target => ({ match: capturedCanonicalMatch(target), score: target.score })),
          { match: capturedMlsMatch, score: { home: 1, away: 2 } }];
        // These assertions read real hosted data before any browser fixture is installed or detail opened.
        for (const { match, score } of targets) {
          const date = getLocalDateFromUtc(match.kickoffUtc, timezoneId);
          const response = await context.request.get(`/api/v1/matches?date=${date}&timezone=${timezoneId}`);
          gate(response.status() === 200, 'real score feed');
          const body = await response.text();
          const found = (JSON.parse(body).matches as LocalMatch[]).find(row => row.id === match.id);
          gate(found?.status === 'completed' && found.score.home === score.home && found.score.away === score.away, `real final score ${match.competition.id}`);
          gate(!body.includes('sourceMatchId') && !body.includes(password), 'score feed redaction');
        }
        const page = await context.newPage();
        page.setDefaultTimeout(25_000);
        let detailRequests = 0;
        page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/v1/matches/detail')) detailRequests++; });
        await page.goto(origin);
        await page.locator('[data-primary-tab="matches"]').click();
        for (const { match, score } of targets) {
          await selectDate(page, getLocalDateFromUtc(match.kickoffUtc, timezoneId));
          const card = page.locator(`[data-open-match][data-match-id="${match.id}"]`);
          await card.waitFor();
          gate((await card.textContent())?.includes(`${score.home} – ${score.away}`), `visible card score ${match.competition.id}`);
          await card.scrollIntoViewIfNeeded();
          gate(await card.isVisible(), `visible match card ${match.competition.id}`);
          await page.screenshot({ path: `output/playwright/score-live/final-${match.competition.id}-${timezoneId.replace('/', '-')}.png` });
        }
        gate(detailRequests === 0, 'list scores do not require opening detail');

        // Synthetic transitions exercise all three leagues through the real adapter + hosted UI.
        // MLS uses the documented widget shape and canonical labels; it is not a captured widget match.
        const canonical = [...crossLeagueTargets.map(capturedCanonicalMatch), capturedMlsMatch];
        const raw = [...crossLeagueTargets.map(capturedWidgetMatch), { home: capturedMlsMatch.homeTeam.name,
          away: capturedMlsMatch.awayTeam.name, home_score: '1', away_score: '2', status: 'finished', status_text: 'FT',
          time: capturedMlsMatch.kickoffUtc, competition: 'MLS', url: '/football/match/new-york-city-fc-vs-new-england-revolution/' }];
        let snapshot: LiveMatchSnapshot;
        await page.route('**/api/v1/live/refresh?reason=manual', route => route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ snapshot: toProviderNeutralLiveMatchSnapshot(snapshot), refresh: { outcome: 'fresh' } }) }));
        for (const status of ['second_half', 'halftime', 'finished']) {
          const now = new Date().toISOString();
          const adapted = adaptSportScoreLiveRecords({ records: raw.map(row => ({ ...row, status, status_text: status === 'second_half' ? "67'" : status })), canonicalMatches: canonical, observedAt: now });
          gate(adapted.matches.length === 3 && adapted.issues.length === 0, 'all three fixture leagues map');
          snapshot = { schemaVersion: 'miraichi.live-match-snapshot.v1', snapshotId: `fixture-${status}`, generatedAt: now,
            coverage: { kind: 'global-recent-window', upstreamLimit: 50, upstreamCount: 3, mappedCount: 3, publishedCount: 3, terminalCheckCount: 0, retainedTrackedCount: 0 },
            matches: adapted.matches, warnings: [] };
          gate(validateLiveMatchSnapshot(snapshot).ok, 'cross-league live fixture contract');
          await page.locator('[data-live-toggle]').click();
          if (status === 'finished') {
            await page.locator('[data-live-empty]').waitFor();
            gate(await page.locator('[data-live-match-id]').count() === 0, 'finished fixtures leave LIVE');
          } else {
            await page.locator(`[data-live-match-id="${capturedMlsMatch.id}"]`).waitFor();
            gate(await page.locator('[data-live-match-id]').count() === 3, 'three league rows visible');
            for (const match of adapted.matches) {
              const row = page.locator(`[data-live-match-id="${match.matchId}"]`);
              gate(await row.getAttribute('data-status') === (status === 'halftime' ? 'halftime' : 'live'), 'LIVE lifecycle status');
              gate(await row.locator('[data-live-score]').textContent() === `${match.score.home} – ${match.score.away}`, 'LIVE score');
              if (status === 'second_half') gate((await row.locator('[data-live-minute]').textContent())?.includes('67'), 'LIVE minute');
            }
            await page.screenshot({ path: `output/playwright/score-live/live-${status}-${timezoneId.replace('/', '-')}.png` });
          }
          await page.locator('[data-live-toggle]').click();
        }
        console.log(JSON.stringify({ gate: 'staging-score-live', status: 'passed', timezoneId, realFinalScores: 3,
          detailRequests, syntheticLiveLeagues: 3, states: ['live', 'halftime', 'completed'] }));
      } finally {
        gate((await context.request.post('/api/v1/auth/logout', { headers: { origin } })).status() === 204, 'score regression logout');
        await context.close();
      }
    }
  } finally { await browser.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void runStagingScoreLive().catch(error => { console.error(error instanceof Error ? error.message : 'Staging score/LIVE regression failed'); process.exitCode = 1; });
}
