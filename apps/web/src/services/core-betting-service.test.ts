import { describe, expect, it } from 'vitest';
import {
  ApiRequestError,
  createDisciplineChallenge,
  createOngoingBet,
  loadBetReport,
  loadBetSettlementTimeline,
  loadDisciplineConfig,
  settleCloudBet,
  updateDisciplineConfig
} from './core-betting-service.js';

const ongoingInput = {
  betId: 'bet-1',
  bankrollAccountId: 'account-1',
  matchGroupId: 'manual:Japan-Vietnam',
  homeTeamName: 'Japan',
  awayTeamName: 'Vietnam',
  marketType: '1X2' as const,
  selectionLabel: 'Japan',
  oddsFormat: 'HK' as const,
  oddsValue: 0.9,
  stakePoints: 10,
  preBetEmotion: 'calm' as const,
  preBetMotivation: 'planned_analysis' as const,
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z'
};

describe('core betting web service', () => {
  it('loads and updates nullable discipline config without inventing thresholds', async () => {
    const calls: Array<{ url: string; body: string | undefined }> = [];
    const config = {
      ownerProfileId: 'owner-primary', dailyStopLossPoints: null, weeklyStopLossPoints: null,
      bigBetThresholdPoints: null, timeZone: 'Asia/Tokyo', cooldownSeconds: 15 as const,
      version: 1, updatedAt: ongoingInput.updatedAt
    };
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: init?.body ? String(init.body) : undefined });
      return new Response(JSON.stringify(config), { status: 200 });
    };

    expect(await loadDisciplineConfig(fetcher)).toEqual(config);
    await updateDisciplineConfig({ ...config, ownerProfileId: undefined, version: undefined, updatedAt: undefined } as never, fetcher);
    expect(calls[1]?.body).not.toContain('ownerProfileId');
    expect(calls[1]?.body).toContain('"dailyStopLossPoints":null');
  });

  it('creates a one-time discipline challenge and then records the same ongoing payload', async () => {
    const bodies: string[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      if (String(input).endsWith('/discipline-challenges')) {
        return new Response(JSON.stringify({ required: true, challenge: { challengeId: 'challenge-1' } }), { status: 201 });
      }
      return new Response(JSON.stringify({ ...ongoingInput, ownerProfileId: 'owner-primary', status: 'pending' }), { status: 201 });
    };

    await createDisciplineChallenge(ongoingInput, fetcher);
    await createOngoingBet({ ...ongoingInput, disciplineChallengeId: 'challenge-1' }, fetcher);
    expect(bodies[0]).not.toContain('ownerProfileId');
    expect(bodies[1]).toContain('"disciplineChallengeId":"challenge-1"');
  });

  it('surfaces API error codes so the UI can translate them', async () => {
    await expect(createOngoingBet(ongoingInput, async () => new Response(
      JSON.stringify({ error: { code: 'discipline_ack_required' } }),
      { status: 409 }
    ))).rejects.toEqual(expect.objectContaining({ code: 'discipline_ack_required', status: 409 }));
  });

  it('posts explicit settlement confirmation data and loads allowed report fields', async () => {
    const calls: string[] = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${String(input)} ${String(init?.body ?? '')}`);
      if (String(input).includes('/settlements')) return new Response(JSON.stringify({ idempotent: false }), { status: 201 });
      return new Response(JSON.stringify({ period: 'week', netProfitLossPoints: 4.5, winRate: 0.5, dailyBuckets: [] }), { status: 200 });
    };
    await settleCloudBet('bet-1', {
      settlementEventId: 'settle-1', settlementType: 'full_win', planAdherence: 'yes',
      effectiveAt: '2026-08-21T00:00:00.000Z'
    }, fetcher);
    const report = await loadBetReport({ period: 'week', anchor: '2026-08-21', accountId: 'account-1' }, fetcher);
    expect(calls[0]).toContain('/bets/bet-1/settlements');
    expect(calls[0]).toContain('"planAdherence":"yes"');
    expect(calls[1]).toContain('period=week');
    expect(report).not.toHaveProperty('yieldPercent');
  });

  it('loads the append-only settlement timeline used by correction UI', async () => {
    const fetcher = async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/bets/bet-1/settlements');
      return new Response(JSON.stringify([{ settlementEventId: 'settle-1', betId: 'bet-1' }]), { status: 200 });
    };
    expect(await loadBetSettlementTimeline('bet-1', fetcher)).toMatchObject([{ settlementEventId: 'settle-1' }]);
  });
});
