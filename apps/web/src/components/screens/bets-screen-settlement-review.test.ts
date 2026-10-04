import { describe, expect, it } from 'vitest';
import { AUTOMATIC_SETTLEMENT_REVIEW_REASONS, type CloudBetRecord } from '@miraichi/shared';
import { createTranslator } from '../../services/i18n-service.js';
import { renderBetsScreen } from './bets-screen.js';

const base: CloudBetRecord = {
  betId: 'bet-1', ownerProfileId: 'owner-primary', matchGroupId: 'match-1', matchId: 'match-1',
  bankrollAccountId: 'account', homeTeamName: 'Home', awayTeamName: 'Away', marketType: '1X2',
  selectionCode: 'home', selectionLabel: 'Home · FT', marketPeriod: 'full_time', oddsFormat: 'HK',
  oddsValue: 0.9, stakePoints: 10, status: 'pending', preBetEmotion: 'calm',
  createdAt: '2026-09-16T00:00:00.000Z', updatedAt: '2026-09-16T00:00:00.000Z'
};

function render(records: readonly CloudBetRecord[], locale: 'en' | 'vi' = 'vi'): string {
  return renderBetsScreen({
    activeTabId: 'bets', translate: createTranslator(locale), filter: records[0]?.status === 'settled' ? 'settled' : 'ongoing',
    state: { status: 'ready', drafts: [], pending: records.filter((record) => record.status === 'pending'), settled: records.filter((record) => record.status === 'settled') },
    bankroll: { status: 'loading' }
  });
}

describe('bets settlement review rendering', () => {
  it('localizes every persisted review reason in both supported locales', () => {
    for (const locale of ['en', 'vi'] as const) {
      const translate = createTranslator(locale);
      for (const reason of AUTOMATIC_SETTLEMENT_REVIEW_REASONS) {
        expect(translate(`settlementReview.reason.${reason}`)).not.toBe(`settlementReview.reason.${reason}`);
      }
    }
  });
  it('distinguishes ordinary pending from manual review and gives both evidence-refresh and manual actions', () => {
    const ordinary = render([base]);
    expect(ordinary).toContain('data-settlement-review="pending"');
    expect(ordinary).toContain('Đang chờ kết quả trận đấu');
    expect(ordinary).not.toContain('data-refresh-settlement-evidence');

    const manual = render([{ ...base, settlementReviewStatus: 'manual_required', settlementReviewReason: 'missing_half_time_score', settlementEvidenceAt: '2026-09-16T01:00:00.000Z' }]);
    expect(manual).toContain('data-settlement-review="manual_required"');
    expect(manual).toContain('Thiếu tỷ số hiệp một đáng tin cậy.');
    expect(manual).toContain('data-refresh-settlement-evidence="match-1"');
    expect(manual).toContain('data-open-settlement="bet-1"');
    expect(manual).toContain('Tự quyết toán');
  });

  it('labels automatic settlement separately while retaining the owner correction action', () => {
    const html = render([{
      ...base, status: 'settled', settlementType: 'half_win', profitLossPoints: 4.5,
      settlementReviewStatus: 'auto_settled', settlementEvidenceAt: '2026-09-16T01:30:00.000Z'
    }], 'en');
    expect(html).toContain('data-settlement-review="auto_settled"');
    expect(html).toContain('Settled automatically from match evidence');
    expect(html).toContain('data-open-settled-detail="bet-1"');
  });

  it('escapes a fallback review reason instead of injecting malformed content', () => {
    const html = render([{ ...base, settlementReviewStatus: 'manual_required', settlementReviewReason: '<img src=x onerror=alert(1)>' as never }], 'en');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});
