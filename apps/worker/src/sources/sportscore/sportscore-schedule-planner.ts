import type { SportScoreCompetitionEntry } from '@miraichi/config';
import type { LocalMatch } from '@miraichi/shared';
import {
  sportScoreDailyCheckpointKey,
  type SportScoreSourceLedgerState
} from './sportscore-source-ledger.js';

export const SPORTSCORE_SCHEDULE_CONFIG = Object.freeze({
  expectedMatchDurationMinutes: 120,
  firstTerminalCheckDelayMinutes: 15,
  secondTerminalCheckDelayMinutes: 30,
  recoveryBaseDelayMinutes: 30,
  maxRecoveryChecks: 2,
  failureBaseDelayMinutes: 15,
  maxFailureDelayMinutes: 120,
  maxTerminalFailureDeferrals: 4,
  defaultMaxRequestsPerRun: 4,
  defaultMaxConcurrency: 2
});

export type SportScoreTerminalStage = 'plus_15' | 'plus_30' | 'recovery';

export interface SportScoreTerminalWindowPlan {
  windowKey: string;
  stage: SportScoreTerminalStage;
  expectedEndAt: string;
  matchIds: string[];
  sourceMatchSlugs: string[];
  recoveryAttempt?: number;
  priorFailureCount?: number;
}

export interface SportScoreScheduleAction {
  competitionEntry: SportScoreCompetitionEntry;
  date: string;
  daily: boolean;
  terminalWindows: SportScoreTerminalWindowPlan[];
}

export interface SportScoreSchedulePlan {
  actions: SportScoreScheduleAction[];
  nextRotationCursor: number;
}

export interface PlanSportScoreScheduleOptions {
  registry: readonly SportScoreCompetitionEntry[];
  targetDate: string;
  now: Date;
  ledger: SportScoreSourceLedgerState;
  matches: readonly LocalMatch[];
  maxRequestsPerRun?: number;
}

interface MutableAction {
  competitionEntry: SportScoreCompetitionEntry;
  date: string;
  daily: boolean;
  terminalWindows: SportScoreTerminalWindowPlan[];
}

export function sportScoreTerminalWindowKey(
  competitionId: string,
  date: string,
  expectedEndAt: string
): string {
  return `${competitionId}|${date}|${expectedEndAt}`;
}

export function planSportScoreSchedule(
  options: PlanSportScoreScheduleOptions
): SportScoreSchedulePlan {
  assertCalendarDate(options.targetDate);
  if (Number.isNaN(options.now.valueOf())) {
    throw new Error('SportScore schedule now must be a valid date.');
  }
  const maxRequestsPerRun = options.maxRequestsPerRun
    ?? SPORTSCORE_SCHEDULE_CONFIG.defaultMaxRequestsPerRun;
  if (!Number.isInteger(maxRequestsPerRun) || maxRequestsPerRun < 1) {
    throw new Error('SportScore maxRequestsPerRun must be a positive integer.');
  }

  const enabled = options.registry.filter((entry) => entry.enabled);
  if (enabled.length === 0) {
    return { actions: [], nextRotationCursor: 0 };
  }
  const normalizedCursor = options.ledger.rotationCursor % enabled.length;
  const candidates = buildCandidates(options, enabled);
  const actions: SportScoreScheduleAction[] = [];
  let lastSelectedIndex: number | undefined;

  for (let offset = 0; offset < enabled.length && actions.length < maxRequestsPerRun; offset += 1) {
    const index = (normalizedCursor + offset) % enabled.length;
    const entry = enabled[index]!;
    const entryCandidates = [...(candidates.get(entry.competitionId)?.values() ?? [])]
      .sort(compareActionCandidates);
    const selected = entryCandidates[0];
    if (!selected) continue;
    actions.push({
      competitionEntry: selected.competitionEntry,
      date: selected.date,
      daily: selected.daily,
      terminalWindows: selected.terminalWindows.sort((left, right) =>
        left.expectedEndAt.localeCompare(right.expectedEndAt)
      )
    });
    lastSelectedIndex = index;
  }

  return {
    actions,
    nextRotationCursor: lastSelectedIndex === undefined
      ? normalizedCursor
      : (lastSelectedIndex + 1) % enabled.length
  };
}

function buildCandidates(
  options: PlanSportScoreScheduleOptions,
  enabled: readonly SportScoreCompetitionEntry[]
): Map<string, Map<string, MutableAction>> {
  const nowMs = options.now.getTime();
  const byCompetition = new Map(enabled.map((entry) => [entry.competitionId, entry]));
  const candidates = new Map<string, Map<string, MutableAction>>();

  for (const entry of enabled) {
    const checkpoint = options.ledger.daily[
      sportScoreDailyCheckpointKey(entry.competitionId, options.targetDate)
    ];
    const deferred = checkpoint?.nextAttemptAt !== undefined
      && Date.parse(checkpoint.nextAttemptAt) > nowMs;
    if (checkpoint?.completedAt === undefined && !deferred) {
      getOrCreateAction(candidates, entry, options.targetDate).daily = true;
    }
  }

  const windows = new Map<string, {
    entry: SportScoreCompetitionEntry;
    date: string;
    expectedEndAt: string;
    matches: Array<{ id: string; slug: string }>;
  }>();
  const trackedWindowKeyBySlug = new Map<string, string>();
  for (const [windowKey, tracked] of Object.entries(options.ledger.terminalSchedules)) {
    const entry = byCompetition.get(tracked.competitionId);
    if (!entry) continue;
    const window = {
      entry,
      date: tracked.date,
      expectedEndAt: tracked.expectedEndAt,
      matches: tracked.sourceMatchSlugs.map((slug, index) => ({
        id: tracked.matchIds[index] ?? '',
        slug
      }))
    };
    windows.set(windowKey, window);
    for (const slug of tracked.sourceMatchSlugs) {
      trackedWindowKeyBySlug.set(`${tracked.competitionId}|${slug}`, windowKey);
    }
  }

  for (const match of options.matches) {
    if (match.status !== 'scheduled') continue;
    const entry = byCompetition.get(match.competition.id);
    if (!entry) continue;
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (Number.isNaN(kickoffMs)) continue;
    const sourceMatchSlug = match.sourceRefs.find((reference) =>
      reference.sourceId === 'sportscore' && typeof reference.sourceMatchId === 'string'
    )?.sourceMatchId;
    if (!sourceMatchSlug) continue;
    const trackedWindowKey = trackedWindowKeyBySlug.get(
      `${entry.competitionId}|${sourceMatchSlug}`
    );
    if (trackedWindowKey) {
      const trackedWindow = windows.get(trackedWindowKey)!;
      const trackedMatch = trackedWindow.matches.find((candidate) =>
        candidate.slug === sourceMatchSlug
      );
      if (trackedMatch && trackedMatch.id === '') trackedMatch.id = match.id;
      continue;
    }
    const date = match.kickoffUtc.slice(0, 10);
    const expectedEndAt = new Date(
      kickoffMs + SPORTSCORE_SCHEDULE_CONFIG.expectedMatchDurationMinutes * 60_000
    ).toISOString();
    const windowKey = sportScoreTerminalWindowKey(entry.competitionId, date, expectedEndAt);
    const window = windows.get(windowKey) ?? {
      entry,
      date,
      expectedEndAt,
      matches: []
    };
    window.matches.push({ id: match.id, slug: sourceMatchSlug });
    windows.set(windowKey, window);
  }

  for (const [windowKey, window] of windows) {
    const checkpoint = options.ledger.terminalWindows[windowKey];
    if (checkpoint?.terminalAt !== undefined || checkpoint?.exhaustedAt !== undefined) continue;
    if (checkpoint?.nextAttemptAt !== undefined && Date.parse(checkpoint.nextAttemptAt) > nowMs) {
      continue;
    }
    const expectedEndMs = Date.parse(window.expectedEndAt);
    let stage: SportScoreTerminalStage | undefined;
    if (
      checkpoint?.plus15CompletedAt === undefined
      && nowMs >= expectedEndMs
        + SPORTSCORE_SCHEDULE_CONFIG.firstTerminalCheckDelayMinutes * 60_000
    ) {
      stage = 'plus_15';
    } else if (
      checkpoint?.plus15CompletedAt !== undefined
      && checkpoint.plus30CompletedAt === undefined
      && nowMs >= expectedEndMs
        + SPORTSCORE_SCHEDULE_CONFIG.secondTerminalCheckDelayMinutes * 60_000
    ) {
      stage = 'plus_30';
    } else if (
      checkpoint?.plus30CompletedAt !== undefined
      && (checkpoint.recoveryAttempts ?? 0) < SPORTSCORE_SCHEDULE_CONFIG.maxRecoveryChecks
      && checkpoint.nextAttemptAt !== undefined
      && Date.parse(checkpoint.nextAttemptAt) <= nowMs
    ) {
      stage = 'recovery';
    }
    if (!stage) continue;

    const action = getOrCreateAction(candidates, window.entry, window.date);
    action.terminalWindows.push({
      windowKey,
      stage,
      expectedEndAt: window.expectedEndAt,
      matchIds: window.matches.map((match) => match.id).filter((id) => id !== ''),
      sourceMatchSlugs: window.matches.map((match) => match.slug),
      ...(stage === 'recovery'
        ? { recoveryAttempt: (checkpoint?.recoveryAttempts ?? 0) + 1 }
        : {}),
      ...((checkpoint?.failureCount ?? 0) > 0
        ? { priorFailureCount: checkpoint!.failureCount }
        : {})
    });
  }
  return candidates;
}

function getOrCreateAction(
  candidates: Map<string, Map<string, MutableAction>>,
  entry: SportScoreCompetitionEntry,
  date: string
): MutableAction {
  const byDate = candidates.get(entry.competitionId) ?? new Map<string, MutableAction>();
  candidates.set(entry.competitionId, byDate);
  const action = byDate.get(date) ?? {
    competitionEntry: entry,
    date,
    daily: false,
    terminalWindows: []
  };
  byDate.set(date, action);
  return action;
}

function compareActionCandidates(left: MutableAction, right: MutableAction): number {
  const leftTerminal = left.terminalWindows.length > 0;
  const rightTerminal = right.terminalWindows.length > 0;
  if (leftTerminal !== rightTerminal) return leftTerminal ? -1 : 1;
  return left.date.localeCompare(right.date);
}

function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error('SportScore targetDate must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('SportScore targetDate must be a real calendar date.');
  }
}
