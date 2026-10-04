import { evaluateStructuredBetOutcome, type LocalMatch, type LocalMatchDetail } from '@miraichi/shared';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
import { settleBetAutomatically } from './bet-settlement-service.js';

export interface TerminalBetReconciliationResult {
  readonly examined: number;
  readonly settled: number;
  readonly manualRequired: number;
  readonly failed: number;
}

export interface CachedMatchDetailReader {
  readCached(matchId: string): Promise<LocalMatchDetail | null>;
}

interface Options {
  readonly ownerProfileId: string;
  readonly persistence: CloudPersistenceAdapter;
  readonly detailReader: CachedMatchDetailReader;
  readonly now?: () => string;
  readonly maxBets?: number;
}

const DEFAULT_MAX_BETS = 50;

export class TerminalBetReconciliationCoordinator {
  private readonly maxBets: number;
  private readonly now: () => string;

  constructor(private readonly options: Options) {
    this.maxBets = options.maxBets ?? DEFAULT_MAX_BETS;
    this.now = options.now ?? (() => new Date().toISOString());
    if (!Number.isSafeInteger(this.maxBets) || this.maxBets < 1 || this.maxBets > 100) {
      throw new Error('Terminal settlement batch must be between 1 and 100 bets');
    }
  }

  async reconcile(matches: readonly LocalMatch[]): Promise<TerminalBetReconciliationResult> {
    const terminalById = new Map(matches
      .filter((match) => match.status === 'completed')
      .map((match) => [match.id, match] as const));
    if (!terminalById.size) return { examined: 0, settled: 0, manualRequired: 0, failed: 0 };

    const bets = await this.options.persistence.listPendingBetRecordsByMatchIds(
      this.options.ownerProfileId,
      [...terminalById.keys()],
      this.maxBets
    );
    let settled = 0;
    let manualRequired = 0;
    let failed = 0;
    const details = new Map<string, LocalMatchDetail | null>();

    for (const bet of bets) {
      const match = bet.matchId ? terminalById.get(bet.matchId) : undefined;
      if (!match) continue;
      if (!details.has(match.id)) {
        try {
          details.set(match.id, await this.options.detailReader.readCached(match.id));
        } catch {
          details.set(match.id, null);
        }
      }
      const detail = details.get(match.id) ?? null;
      const outcome = detail
        ? evaluateStructuredBetOutcome({ bet, match, detail })
        : { status: 'manual_required' as const, reason: 'missing_detail' as const };
      try {
        if (outcome.status === 'settled') {
          await settleBetAutomatically({
            adapter: this.options.persistence,
            ownerProfileId: this.options.ownerProfileId,
            betId: bet.betId,
            outcome,
            now: this.now()
          });
          settled++;
        } else {
          const reviewed = await this.options.persistence.markBetSettlementManualReview({
            ownerProfileId: this.options.ownerProfileId,
            betId: bet.betId,
            reason: outcome.reason,
            evidenceAt: detail?.updatedAt ?? match.updatedAt,
            updatedAt: this.now()
          });
          if (reviewed) manualRequired++;
        }
      } catch {
        // One malformed/racing bet must not block publication or other settlements.
        failed++;
      }
    }

    return { examined: bets.length, settled, manualRequired, failed };
  }
}
