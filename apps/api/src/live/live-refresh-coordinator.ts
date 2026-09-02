import type {
  LiveMatchOverlay,
  LiveMatchSnapshot,
  LiveRefreshErrorCode,
  LiveRefreshReason,
  LiveRefreshState
} from '@miraichi/shared';
import { randomUUID } from 'node:crypto';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { SportScoreWidgetClientError, type SportScoreLiveSource } from './sportscore-widget-client.js';
import { adaptSportScoreLiveRecords, adaptTrackedSportScoreRecord } from './sportscore-live-adapter.js';

const FRESHNESS_MS: Readonly<Record<LiveRefreshReason, number>> = Object.freeze({
  visible: 5 * 60 * 1_000,
  manual: 60 * 1_000,
  hourly: 60 * 60 * 1_000
});
const LEASE_MS = 60 * 1_000;
const MAX_TERMINAL_CHECKS = 5;
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export type LiveRefreshOutcome = 'refreshed' | 'fresh' | 'leased' | 'failed';
export interface LiveRefreshResult {
  readonly outcome: LiveRefreshOutcome;
  readonly snapshot: LiveMatchSnapshot | null;
  readonly state: LiveRefreshState | null;
}

export interface LiveRefreshCoordinatorOptions {
  readonly ownerProfileId: string;
  readonly persistence: CloudPersistenceAdapter;
  readonly source: SportScoreLiveSource;
  readonly repository: MatchSnapshotRepository;
  readonly now?: () => string;
  readonly createLeaseId?: () => string;
}

function sourceErrorCode(error: unknown): LiveRefreshErrorCode {
  if (!(error instanceof SportScoreWidgetClientError)) return 'internal_error';
  if (error.code === 'timeout') return 'upstream_timeout';
  if (error.code === 'network' || error.code === 'http_status') return 'upstream_unavailable';
  return 'upstream_contract_invalid';
}

function isFresh(state: LiveRefreshState | null, reason: LiveRefreshReason, nowMs: number): boolean {
  if (!state?.lastSuccessAt) return false;
  const age = nowMs - Date.parse(state.lastSuccessAt);
  return Number.isFinite(age) && age >= 0 && age < FRESHNESS_MS[reason];
}

function trackedSportScoreSlug(match: LiveMatchOverlay): string | null {
  return match.sourceRefs.find((source) => source.sourceId === 'sportscore')?.sourceMatchId ?? null;
}

function candidateUtcDates(records: readonly Record<string, unknown>[]): string[] {
  const dates = new Set<string>();
  for (const record of records) {
    if (typeof record.time !== 'string' || !ISO_DATETIME_PATTERN.test(record.time)) continue;
    const kickoffMs = Date.parse(record.time);
    if (!Number.isFinite(kickoffMs)) continue;
    for (const offset of [-30 * 60_000, 0, 30 * 60_000]) {
      dates.add(new Date(kickoffMs + offset).toISOString().slice(0, 10));
    }
  }
  return [...dates].sort();
}

export class LiveRefreshCoordinator {
  private readonly ownerProfileId: string;
  private readonly persistence: CloudPersistenceAdapter;
  private readonly source: SportScoreLiveSource;
  private readonly repository: MatchSnapshotRepository;
  private readonly now: () => string;
  private readonly createLeaseId: () => string;

  constructor(options: LiveRefreshCoordinatorOptions) {
    this.ownerProfileId = options.ownerProfileId;
    this.persistence = options.persistence;
    this.source = options.source;
    this.repository = options.repository;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createLeaseId = options.createLeaseId ?? randomUUID;
  }

  async read(): Promise<LiveRefreshResult> {
    const [snapshot, state] = await Promise.all([
      this.persistence.getLiveMatchSnapshot(this.ownerProfileId),
      this.persistence.getLiveRefreshState(this.ownerProfileId)
    ]);
    return { outcome: state?.status === 'running' ? 'leased' : 'fresh', snapshot, state };
  }

  async refresh(reason: LiveRefreshReason): Promise<LiveRefreshResult> {
    const startedAt = this.now();
    const startedAtMs = Date.parse(startedAt);
    if (!Number.isFinite(startedAtMs)) throw new Error('Live refresh clock returned an invalid timestamp');
    let [previousSnapshot, previousState] = await Promise.all([
      this.persistence.getLiveMatchSnapshot(this.ownerProfileId),
      this.persistence.getLiveRefreshState(this.ownerProfileId)
    ]);
    if (isFresh(previousState, reason, startedAtMs)) {
      return { outcome: 'fresh', snapshot: previousSnapshot, state: previousState };
    }

    const leaseId = this.createLeaseId();
    const acquired = await this.persistence.acquireLiveRefreshLease(this.ownerProfileId, {
      leaseId,
      reason,
      acquiredAt: startedAt,
      expiresAt: new Date(startedAtMs + LEASE_MS).toISOString()
    });
    if (!acquired) {
      [previousSnapshot, previousState] = await Promise.all([
        this.persistence.getLiveMatchSnapshot(this.ownerProfileId),
        this.persistence.getLiveRefreshState(this.ownerProfileId)
      ]);
      return { outcome: 'leased', snapshot: previousSnapshot, state: previousState };
    }

    try {
      const envelope = await this.source.listMatches();
      const canonicalFeeds = await Promise.all(candidateUtcDates(envelope.matches).map((date) => (
        this.repository.listMatches({ date, timezone: 'UTC' })
      )));
      const canonicalMatches = canonicalFeeds
        .flatMap((feed) => feed.matches)
        .filter((match, index, all) => all.findIndex((candidate) => candidate.id === match.id) === index);
      const adapted = adaptSportScoreLiveRecords({ records: envelope.matches, canonicalMatches, observedAt: startedAt });
      const currentMatchIds = new Set(adapted.matches.map((match) => match.matchId));
      const missingTracked = (previousSnapshot?.matches ?? [])
        .filter((match) => match.status !== 'completed' && !currentMatchIds.has(match.matchId));
      const toCheck = missingTracked.filter((match) => trackedSportScoreSlug(match)).slice(0, MAX_TERMINAL_CHECKS);
      const checked = await Promise.all(toCheck.map(async (tracked) => {
        const slug = trackedSportScoreSlug(tracked)!;
        try {
          const raw = await this.source.getMatch(slug);
          return adaptTrackedSportScoreRecord({ raw, tracked, observedAt: startedAt }) ?? tracked;
        } catch {
          return tracked;
        }
      }));
      const checkedIds = new Set(toCheck.map((match) => match.matchId));
      const retainedUnchecked = missingTracked.filter((match) => !checkedIds.has(match.matchId));
      const retainedCheckedCount = checked.filter((match) => match.updatedAt !== startedAt).length;
      const merged = [...adapted.matches, ...checked, ...retainedUnchecked]
        .filter((match, index, all) => all.findIndex((candidate) => candidate.matchId === match.matchId) === index);
      const warnings: string[] = [];
      const unmappedCount = adapted.issues.filter((issue) => issue.code === 'unmapped_match').length;
      const ambiguousCount = adapted.issues.filter((issue) => issue.code === 'ambiguous_match').length;
      const invalidCount = adapted.issues.filter((issue) => issue.code === 'invalid_record').length;
      if (envelope.matches.length === 50) warnings.push('global_widget_limit_50');
      if (unmappedCount) warnings.push(`unmapped_matches:${unmappedCount}`);
      if (ambiguousCount) warnings.push(`ambiguous_matches:${ambiguousCount}`);
      if (invalidCount) warnings.push(`invalid_upstream_matches:${invalidCount}`);
      if (retainedCheckedCount) warnings.push(`terminal_checks_unresolved:${retainedCheckedCount}`);
      if (retainedUnchecked.length) warnings.push(`terminal_check_budget_exhausted:${retainedUnchecked.length}`);
      const snapshot: LiveMatchSnapshot = {
        schemaVersion: 'miraichi.live-match-snapshot.v1',
        snapshotId: `live-${startedAt}`,
        generatedAt: startedAt,
        coverage: {
          kind: 'global-recent-window',
          upstreamLimit: 50,
          upstreamCount: envelope.matches.length,
          mappedCount: adapted.matches.length,
          publishedCount: merged.length,
          terminalCheckCount: toCheck.length,
          retainedTrackedCount: retainedCheckedCount + retainedUnchecked.length
        },
        matches: merged,
        warnings
      };
      const completedAt = this.now();
      await this.persistence.finishLiveRefresh(this.ownerProfileId, { leaseId, outcome: 'succeeded', completedAt, snapshot });
      return { outcome: 'refreshed', snapshot, state: await this.persistence.getLiveRefreshState(this.ownerProfileId) };
    } catch (error) {
      const completedAt = this.now();
      try {
        await this.persistence.finishLiveRefresh(this.ownerProfileId, {
          leaseId,
          outcome: 'failed',
          completedAt,
          errorCode: sourceErrorCode(error)
        });
      } catch {
        // An expired/replaced lease must never be forced to completion.
      }
      const [snapshot, state] = await Promise.all([
        this.persistence.getLiveMatchSnapshot(this.ownerProfileId),
        this.persistence.getLiveRefreshState(this.ownerProfileId)
      ]);
      return { outcome: 'failed', snapshot, state };
    }
  }
}
