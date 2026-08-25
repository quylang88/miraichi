import { API_FOOTBALL_QUOTA_CONFIG } from '@miraichi/config';
import type { LocalMatch } from '@miraichi/shared';

export const SCHEDULE_PLANNER_CONFIG = Object.freeze({
  defaultTimezone: API_FOOTBALL_QUOTA_CONFIG.ownerTimezone,
  defaultChunkSize: 20,
  concludingWindowStartMinutes: 100,
  concludingWindowNormalEndMinutes: 120,
  concludingWindowExtendedEndMinutes: 180,
  pollingIntervalSeconds: 150
});

export const TERMINAL_STATUS_CODES = Object.freeze(
  new Set([
    'FT',
    'AET',
    'PEN',
    'PST',
    'SUSP',
    'INT',
    'CANC',
    'ABD',
    'AWD',
    'WO',
    'COMPLETED',
    'POSTPONED',
    'CANCELLED'
  ])
);

export const EXTENDED_WINDOW_ELIGIBLE_STATUS_CODES = Object.freeze(
  new Set([
    'ET',
    'BT',
    'P',
    'EXTRA_TIME',
    'PENALTIES'
  ])
);

export interface ComputeDueWindowPollOptions {
  matches: readonly LocalMatch[];
  now?: Date | undefined;
  lastPolledAtByMatchId?:
    | ReadonlyMap<string, string | Date | number>
    | Record<string, string | Date | number>
    | undefined;
  nextDueAtByMatchId?:
    | ReadonlyMap<string, string | Date | number>
    | Record<string, string | Date | number>
    | undefined;
  lastReportedStatusByMatchId?:
    | ReadonlyMap<string, string>
    | Record<string, string>
    | undefined;
  concludingWindowStartMinutes?: number | undefined;
  concludingWindowNormalEndMinutes?: number | undefined;
  concludingWindowExtendedEndMinutes?: number | undefined;
  pollingIntervalSeconds?: number | undefined;
}

export interface DueWindowPollMatch {
  match: LocalMatch;
  fixtureId: number;
  kickoffUtc: string;
  elapsedMinutes: number;
  isExtendedWindow: boolean;
  windowStage: 'normal' | 'extended';
}

export type ApiFootballScheduleMode = 'auto' | 'daily_sync' | 'window_poll';

export interface PlanApiFootballIngestionInput {
  mode?: ApiFootballScheduleMode | undefined;
  now?: Date | undefined;
  timeZone?: string | undefined;
  lastSuccessfulDailySyncDate?: string | null | undefined;
  targetDate?: string | undefined;
  canRequest?: boolean | undefined;
  matches?: readonly LocalMatch[] | undefined;
  lastPolledAtByMatchId?:
    | ReadonlyMap<string, string | Date | number>
    | Record<string, string | Date | number>
    | undefined;
  nextDueAtByMatchId?:
    | ReadonlyMap<string, string | Date | number>
    | Record<string, string | Date | number>
    | undefined;
  lastReportedStatusByMatchId?:
    | ReadonlyMap<string, string>
    | Record<string, string>
    | undefined;
  chunkSize?: number | undefined;
  concludingWindowStartMinutes?: number | undefined;
  concludingWindowNormalEndMinutes?: number | undefined;
  concludingWindowExtendedEndMinutes?: number | undefined;
  pollingIntervalSeconds?: number | undefined;
}

export type IngestionPlanAction =
  | {
      type: 'daily_sync';
      date: string;
    }
  | {
      type: 'window_poll';
      fixtureIds: number[];
      matches: LocalMatch[];
    };

export interface IngestionPlan {
  actions: IngestionPlanAction[];
  reason: 'planned' | 'idle' | 'quota_deferred';
  dailySyncDue: boolean;
  targetDate: string;
  dueMatchesCount: number;
  dueMatches: DueWindowPollMatch[];
}

/**
 * Computes YYYY-MM-DD in the given timezone (default 'Asia/Tokyo' or config).
 */
export function computeOwnerLocalDate(
  now: Date = new Date(),
  timeZone: string = SCHEDULE_PLANNER_CONFIG.defaultTimezone
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

/**
 * Splits an array of fixture IDs into chunks of at most chunkSize (default 20).
 * Example: 21 IDs -> [20, 1]; 41 IDs -> [20, 20, 1].
 */
export function chunkFixtureIds(
  fixtureIds: readonly number[],
  chunkSize: number = SCHEDULE_PLANNER_CONFIG.defaultChunkSize
): number[][] {
  const effectiveChunkSize =
    Number.isInteger(chunkSize) && chunkSize > 0
      ? chunkSize
      : SCHEDULE_PLANNER_CONFIG.defaultChunkSize;

  if (!fixtureIds || fixtureIds.length === 0) {
    return [];
  }

  const chunks: number[][] = [];
  for (let i = 0; i < fixtureIds.length; i += effectiveChunkSize) {
    chunks.push(fixtureIds.slice(i, i + effectiveChunkSize));
  }
  return chunks;
}

/**
 * Extracts provider fixture ID from match.sourceRefs where sourceId === 'api-football',
 * ensuring provider IDs are NEVER parsed from canonical match IDs.
 */
export function resolveProviderFixtureIdFromMatch(match: LocalMatch): number | null {
  if (!match || !Array.isArray(match.sourceRefs)) {
    return null;
  }

  const ref = match.sourceRefs.find((r) => r.sourceId === 'api-football');
  if (!ref || ref.sourceMatchId === undefined || ref.sourceMatchId === null) {
    return null;
  }

  const strVal = String(ref.sourceMatchId).trim();
  if (!/^\d+$/u.test(strVal)) {
    return null;
  }

  const parsed = Number(strVal);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function resolveLastPolledAtMs(
  matchId: string,
  map?:
    | ReadonlyMap<string, string | Date | number>
    | Record<string, string | Date | number>
    | undefined
): number | null {
  if (!map) return null;
  let raw: string | Date | number | undefined;
  if (map instanceof Map || typeof (map as ReadonlyMap<string, unknown>).get === 'function') {
    raw = (map as ReadonlyMap<string, string | Date | number>).get(matchId);
  } else {
    raw = (map as Record<string, string | Date | number>)[matchId];
  }

  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (raw instanceof Date) {
    const ms = raw.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveLastReportedStatus(
  matchId: string,
  map?: ReadonlyMap<string, string> | Record<string, string> | undefined
): string | null {
  if (!map) return null;
  let raw: string | undefined;
  if (map instanceof Map || typeof (map as ReadonlyMap<string, unknown>).get === 'function') {
    raw = (map as ReadonlyMap<string, string>).get(matchId);
  } else {
    raw = (map as Record<string, string>)[matchId];
  }

  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed !== '' ? trimmed : null;
}

/**
 * Finds scheduled matches whose kickoff is at least +100 minutes (concludingWindowStartMinutes).
 * - If match is within normal window (kickoff +100m to +120m): eligible for poll.
 * - If match is within extended window (kickoff +120m to +180m): eligible only if match status was
 *   reported as active extra time / penalties, and stops at +180m or when terminal.
 * - Terminal statuses (FT, AET, PEN, completed, postponed, cancelled) immediately stop polling.
 * - Respects cadence: if last polled within 150 seconds, not due yet.
 */
export function computeDueWindowPollMatches(
  options: ComputeDueWindowPollOptions
): DueWindowPollMatch[] {
  const matches = options.matches || [];
  const now = options.now || new Date();
  const nowMs = now.getTime();

  const startMinutes =
    options.concludingWindowStartMinutes ??
    SCHEDULE_PLANNER_CONFIG.concludingWindowStartMinutes;
  const normalEndMinutes =
    options.concludingWindowNormalEndMinutes ??
    SCHEDULE_PLANNER_CONFIG.concludingWindowNormalEndMinutes;
  const extendedEndMinutes =
    options.concludingWindowExtendedEndMinutes ??
    SCHEDULE_PLANNER_CONFIG.concludingWindowExtendedEndMinutes;
  const pollingIntervalSeconds =
    options.pollingIntervalSeconds ??
    SCHEDULE_PLANNER_CONFIG.pollingIntervalSeconds;
  const pollingIntervalMs = pollingIntervalSeconds * 1000;

  const dueMatches: DueWindowPollMatch[] = [];

  for (const match of matches) {
    // 1. Terminal local status check
    if (
      match.status === 'completed' ||
      match.status === 'postponed' ||
      match.status === 'cancelled'
    ) {
      continue;
    }

    // 2. Resolve provider fixture ID (strictly from sourceRefs)
    const fixtureId = resolveProviderFixtureIdFromMatch(match);
    if (fixtureId === null) {
      continue;
    }

    // 3. Parse kickoff time
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (Number.isNaN(kickoffMs)) {
      continue;
    }

    // 4. Check terminal reported status
    const reportedStatus = resolveLastReportedStatus(
      match.id,
      options.lastReportedStatusByMatchId
    );
    if (
      reportedStatus !== null &&
      TERMINAL_STATUS_CODES.has(reportedStatus.toUpperCase())
    ) {
      continue;
    }

    // 5. Check elapsed window
    const elapsedMinutes = (nowMs - kickoffMs) / 60_000;
    if (elapsedMinutes < startMinutes) {
      // Not yet at kickoff + 100m
      continue;
    }

    let isExtendedWindow = false;
    let windowStage: 'normal' | 'extended' = 'normal';

    if (elapsedMinutes <= normalEndMinutes) {
      // Normal concluding window [+100m, +120m]
      isExtendedWindow = false;
      windowStage = 'normal';
    } else if (elapsedMinutes <= extendedEndMinutes) {
      // Extended concluding window (+120m, +180m]
      // Eligible ONLY if last reported status indicates extra time / penalties / live
      if (
        reportedStatus === null ||
        !EXTENDED_WINDOW_ELIGIBLE_STATUS_CODES.has(reportedStatus.toUpperCase())
      ) {
        continue;
      }
      isExtendedWindow = true;
      windowStage = 'extended';
    } else {
      // Beyond +180 minutes -> polling stops
      continue;
    }

    // 6. Respect an explicitly persisted next-due checkpoint first.
    const nextDueMs = resolveLastPolledAtMs(match.id, options.nextDueAtByMatchId);
    if (nextDueMs !== null && nowMs < nextDueMs) {
      continue;
    }

    // Fall back to last-poll cadence for ledgers created before nextDueAt existed.
    const lastPolledMs = resolveLastPolledAtMs(
      match.id,
      options.lastPolledAtByMatchId
    );
    if (lastPolledMs !== null && nowMs - lastPolledMs < pollingIntervalMs) {
      // Polled too recently
      continue;
    }

    dueMatches.push({
      match,
      fixtureId,
      kickoffUtc: match.kickoffUtc,
      elapsedMinutes,
      isExtendedWindow,
      windowStage
    });
  }

  return dueMatches;
}

/**
 * Plans API-Football daily sync and smart-window polling actions.
 * - Evaluates whether daily sync is due (lastSuccessfulDailySyncDate !== todayDate).
 * - If mode is 'auto': plans daily sync if due, and plans chunked window polls for due fixtures in concluding windows.
 * - If no daily sync is due and no fixtures are due for window poll, returns { actions: [], reason: 'idle' }.
 * - If due work exists but quota is exhausted, returns { actions: [], reason: 'quota_deferred' }.
 */
export function planApiFootballIngestion(
  input: PlanApiFootballIngestionInput
): IngestionPlan {
  const now = input.now || new Date();
  const timeZone = input.timeZone || SCHEDULE_PLANNER_CONFIG.defaultTimezone;
  const targetDate = input.targetDate || computeOwnerLocalDate(now, timeZone);
  const canRequest = input.canRequest ?? true;
  const mode = input.mode || 'auto';
  const chunkSize = input.chunkSize ?? SCHEDULE_PLANNER_CONFIG.defaultChunkSize;

  const dailySyncDue = input.lastSuccessfulDailySyncDate !== targetDate;

  const dueMatches = computeDueWindowPollMatches({
    matches: input.matches || [],
    now,
    lastPolledAtByMatchId: input.lastPolledAtByMatchId,
    nextDueAtByMatchId: input.nextDueAtByMatchId,
    lastReportedStatusByMatchId: input.lastReportedStatusByMatchId,
    concludingWindowStartMinutes: input.concludingWindowStartMinutes,
    concludingWindowNormalEndMinutes: input.concludingWindowNormalEndMinutes,
    concludingWindowExtendedEndMinutes: input.concludingWindowExtendedEndMinutes,
    pollingIntervalSeconds: input.pollingIntervalSeconds
  });

  const dailyActionDue = (mode === 'auto' || mode === 'daily_sync') && dailySyncDue;
  const pollActionsDue = (mode === 'auto' || mode === 'window_poll') && dueMatches.length > 0;

  if (!dailyActionDue && !pollActionsDue) {
    return {
      actions: [],
      reason: 'idle',
      dailySyncDue,
      targetDate,
      dueMatchesCount: dueMatches.length,
      dueMatches
    };
  }

  if (!canRequest) {
    return {
      actions: [],
      reason: 'quota_deferred',
      dailySyncDue,
      targetDate,
      dueMatchesCount: dueMatches.length,
      dueMatches
    };
  }

  const actions: IngestionPlanAction[] = [];

  if (mode === 'daily_sync' && dailyActionDue) {
    actions.push({
      type: 'daily_sync',
      date: targetDate
    });
  } else if (mode === 'window_poll') {
    if (dueMatches.length > 0) {
      const fixtureIds = dueMatches.map((m) => m.fixtureId);
      const chunks = chunkFixtureIds(fixtureIds, chunkSize);

      for (const chunk of chunks) {
        const chunkIdSet = new Set(chunk);
        const chunkMatches = dueMatches
          .filter((m) => chunkIdSet.has(m.fixtureId))
          .map((m) => m.match);

        actions.push({
          type: 'window_poll',
          fixtureIds: chunk,
          matches: chunkMatches
        });
      }
    }
  } else {
    // mode === 'auto'
    if (dailyActionDue) {
      actions.push({
        type: 'daily_sync',
        date: targetDate
      });
    }

    if (dueMatches.length > 0) {
      const fixtureIds = dueMatches.map((m) => m.fixtureId);
      const chunks = chunkFixtureIds(fixtureIds, chunkSize);

      for (const chunk of chunks) {
        const chunkIdSet = new Set(chunk);
        const chunkMatches = dueMatches
          .filter((m) => chunkIdSet.has(m.fixtureId))
          .map((m) => m.match);

        actions.push({
          type: 'window_poll',
          fixtureIds: chunk,
          matches: chunkMatches
        });
      }
    }
  }

  if (actions.length === 0) {
    return {
      actions: [],
      reason: 'idle',
      dailySyncDue,
      targetDate,
      dueMatchesCount: dueMatches.length,
      dueMatches
    };
  }

  return {
    actions,
    reason: 'planned',
    dailySyncDue,
    targetDate,
    dueMatchesCount: dueMatches.length,
    dueMatches
  };
}
