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
  it('runs single-bankroll setup → warning → ongoing → settlement → report → V2 backup atomically', async () => {
    let now = '2026-08-21T01:00:00.000Z';
    const adapter = createMemoryCloudPersistenceAdapter({ now: () => now });
    const deps = { adapter, ownerProfileId: 'owner-primary', now: () => new Date(now) };
    let out = response();
    await handleBankroll(request('POST', '/api/v1/bankroll/setup', { openingBalancePoints: 100, timeZone: 'Asia/Tokyo', weekStartDay: 'monday' }) as never, out as never, deps);
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({ account: { accountId: 'bankroll-primary', openingBalancePoints: 100 }, disciplineConfig: { dailyStopLossPoints: null, weeklyStopLossPoints: null, bigBetThresholdPoints: null } });

    const bet = { betId: 'b', matchGroupId: 'manual:a-b', homeTeamName: 'A', awayTeamName: 'B', marketType: '1X2', selectionLabel: 'A', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 110, preBetEmotion: 'anxious', preBetMotivation: 'fomo', preBetPlanAdherence: 'partly', createdAt: now };
    out = response();
    await handleDiscipline(request('POST', '/api/v1/discipline-challenges', bet) as never, out as never, deps);
    const challenge = JSON.parse(out.body).challenge as { challengeId: string };
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({ challenge: { ruleVersion: 1, triggeredRules: ['overexposure', 'risky_motivation'], availableAt: '2026-08-21T01:00:15.000Z' } });

    out = response();
    await handleBets(request('POST', '/api/v1/bets', { ...bet, disciplineChallengeId: challenge.challengeId }) as never, out as never, deps);
    expect(out.statusCode).toBe(409);
    now = '2026-08-21T01:00:15.000Z';
    out = response();
    await handleBets(request('POST', '/api/v1/bets', { ...bet, disciplineChallengeId: challenge.challengeId }) as never, out as never, deps);
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({ bankrollAccountId: 'bankroll-primary', preBetPlanAdherence: 'partly', disciplineSnapshot: { triggeredRules: ['overexposure', 'risky_motivation'] } });

    now = '2026-08-21T02:00:00.000Z';
    out = response();
    await handleBetSettlements(request('POST', '/api/v1/bets/b/settlements', { settlementEventId: 's1', settlementType: 'full_win', effectiveAt: now }) as never, out as never, deps);
    expect(JSON.parse(out.body)).toMatchObject({ event: { planAdherence: 'partly' }, record: { profitLossPoints: 99 }, account: { currentBalancePoints: 199 } });

    now = '2026-08-22T02:00:00.000Z';
    out = response();
    await handleBetSettlements(request('POST', '/api/v1/bets/b/settlements', { settlementEventId: 's2', settlementType: 'manual_adjustment', profitLossPoints: 2, adjustmentReason: 'Bookmaker correction', effectiveAt: now, correctsSettlementEventId: 's1' }) as never, out as never, deps);
    expect(JSON.parse(out.body)).toMatchObject({ event: { planAdherence: 'partly', ledgerDeltaPoints: -97, effectiveAt: '2026-08-21T02:00:00.000Z' }, account: { currentBalancePoints: 102 } });

    out = response();
    await handleBetReports(request('GET', '/api/v1/bet-reports?period=week&anchor=2026-08-21&accountId=bankroll-primary') as never, out as never, deps);
    const report = JSON.parse(out.body);
    expect(report).toMatchObject({ netProfitLossPoints: 2, disciplineOverrideCount: 1, psychology: { motivation: { fomo: { count: 1, profitLossPoints: 2 } }, planAdherence: { partly: { count: 1, profitLossPoints: 2 } } } });
    expect(report).not.toHaveProperty('yieldPercent');

    out = response();
    await handleBackups(request('POST', '/api/v1/backups/export') as never, out as never, deps);
    const exported = JSON.parse(out.body);
    expect(exported).toMatchObject({ schemaVersion: 'miraichi.cloud-backup.v2', bets: [{ preBetPlanAdherence: 'partly' }], settlementEvents: [{ settlementEventId: 's1', planAdherence: 'partly' }, { settlementEventId: 's2', planAdherence: 'partly' }] });
    const importedAdapter = createMemoryCloudPersistenceAdapter();
    const importOut = response();
    const { sha256: _sha256, ...envelope } = exported;
    await handleBackups(request('POST', '/api/v1/backups/import', envelope) as never, importOut as never, { adapter: importedAdapter, ownerProfileId: 'owner-primary' });
    expect(importOut.statusCode).toBe(200);
    expect(await importedAdapter.exportOwnerData('owner-primary', now)).toMatchObject({ schemaVersion: 'miraichi.cloud-backup.v2', bets: [{ profitLossPoints: 2 }], settlementEvents: [{ settlementEventId: 's1' }, { settlementEventId: 's2' }] });
  });
});
