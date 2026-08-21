import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../../apps/api/src/persistence/memory-cloud-persistence-adapter.js';
import { handleBackups } from '../../apps/api/src/routes/backups.js';
import { handleBankroll } from '../../apps/api/src/routes/bankroll.js';
import { handleBetReports } from '../../apps/api/src/routes/bet-reports.js';
import { handleBetSettlements } from '../../apps/api/src/routes/bet-settlements.js';
import { handleBets } from '../../apps/api/src/routes/bets.js';
import { handleDiscipline } from '../../apps/api/src/routes/discipline.js';

function request(method: string, url: string, body?: unknown) {
  const value = Readable.from(body === undefined ? [] : [JSON.stringify(body)]) as Readable & { method: string; url: string };
  value.method = method; value.url = url; return value;
}
function response() { return { statusCode: 0, body: '', writeHead(code: number) { this.statusCode = code; }, end(body?: unknown) { this.body = String(body ?? ''); } }; }

describe('core betting journal integration', () => {
  it('runs challenge → ongoing → settlement → correction → report → V2 backup atomically', async () => {
    let now = '2026-08-21T01:00:00.000Z';
    const adapter = createMemoryCloudPersistenceAdapter({ now: () => now });
    const deps = { adapter, ownerProfileId: 'owner-primary', now: () => new Date(now) };
    let out = response();
    await handleBankroll(request('POST', '/api/v1/bankroll/accounts', { accountId: 'a', label: 'Main', unit: 'points', openingBalancePoints: 100 }) as never, out as never, deps);
    expect(out.statusCode).toBe(201);

    out = response();
    await handleDiscipline(request('PUT', '/api/v1/discipline-config', { dailyStopLossPoints: null, weeklyStopLossPoints: null, bigBetThresholdPoints: 10, timeZone: 'Asia/Tokyo' }) as never, out as never, deps);
    expect(out.statusCode).toBe(200);

    const bet = { betId: 'b', matchGroupId: 'manual:a-b', bankrollAccountId: 'a', homeTeamName: 'A', awayTeamName: 'B', marketType: '1X2', selectionLabel: 'A', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, preBetEmotion: 'calm', preBetMotivation: 'planned_analysis', createdAt: now };
    out = response();
    await handleDiscipline(request('POST', '/api/v1/discipline-challenges', bet) as never, out as never, deps);
    const challenge = JSON.parse(out.body).challenge as { challengeId: string };
    expect(out.statusCode).toBe(201);

    out = response();
    await handleBets(request('POST', '/api/v1/bets', { ...bet, disciplineChallengeId: challenge.challengeId }) as never, out as never, deps);
    expect(out.statusCode).toBe(409);
    now = '2026-08-21T01:00:15.000Z';
    out = response();
    await handleBets(request('POST', '/api/v1/bets', { ...bet, disciplineChallengeId: challenge.challengeId }) as never, out as never, deps);
    expect(out.statusCode).toBe(201);

    now = '2026-08-21T02:00:00.000Z';
    out = response();
    await handleBetSettlements(request('POST', '/api/v1/bets/b/settlements', { settlementEventId: 's1', settlementType: 'full_win', planAdherence: 'yes', effectiveAt: now }) as never, out as never, deps);
    expect(JSON.parse(out.body)).toMatchObject({ record: { profitLossPoints: 9 }, account: { currentBalancePoints: 109 } });

    now = '2026-08-22T02:00:00.000Z';
    out = response();
    await handleBetSettlements(request('POST', '/api/v1/bets/b/settlements', { settlementEventId: 's2', settlementType: 'manual_adjustment', planAdherence: 'no', profitLossPoints: 2, adjustmentReason: 'Bookmaker correction', effectiveAt: now, correctsSettlementEventId: 's1' }) as never, out as never, deps);
    expect(JSON.parse(out.body)).toMatchObject({ event: { ledgerDeltaPoints: -7, effectiveAt: '2026-08-21T02:00:00.000Z' }, account: { currentBalancePoints: 102 } });

    out = response();
    await handleBetReports(request('GET', '/api/v1/bet-reports?period=week&anchor=2026-08-21&accountId=a') as never, out as never, deps);
    const report = JSON.parse(out.body);
    expect(report).toMatchObject({ netProfitLossPoints: 2, disciplineOverrideCount: 1 });
    expect(report).not.toHaveProperty('yieldPercent');

    out = response();
    await handleBackups(request('POST', '/api/v1/backups/export') as never, out as never, deps);
    const exported = JSON.parse(out.body);
    expect(exported).toMatchObject({ schemaVersion: 'miraichi.cloud-backup.v2', settlementEvents: [{ settlementEventId: 's1' }, { settlementEventId: 's2' }] });
    const importedAdapter = createMemoryCloudPersistenceAdapter();
    const importOut = response();
    const { sha256: _sha256, ...envelope } = exported;
    await handleBackups(request('POST', '/api/v1/backups/import', envelope) as never, importOut as never, { adapter: importedAdapter, ownerProfileId: 'owner-primary' });
    expect(importOut.statusCode).toBe(200);
    expect(await importedAdapter.exportOwnerData('owner-primary', now)).toMatchObject({ schemaVersion: 'miraichi.cloud-backup.v2', bets: [{ profitLossPoints: 2 }], settlementEvents: [{ settlementEventId: 's1' }, { settlementEventId: 's2' }] });
  });
});
