import type { CanonicalWarehouseSnapshot } from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  fotMobDateKey,
  fotMobMatchKey,
  type FotMobResultLedgerState
} from './fotmob-result-ledger-contract.js';

const FIRST_CHECK_AFTER_MINUTES = 105;
const MAX_CHECKS = 45;
const HARD_CUTOFF_MINUTES = 240;

export interface FotMobTerminalPlanMatch {
  matchId: string;
  providerMatchId: string;
  kickoffUtc: string;
}

export interface FotMobTerminalPlanGroup {
  date: string;
  etag?: string;
  matches: FotMobTerminalPlanMatch[];
}

export interface FotMobTerminalPlan {
  groups: FotMobTerminalPlanGroup[];
  exhaustedMatchIds: string[];
}

export function buildFotMobTerminalPlan(options: {
  base: CanonicalWarehouseSnapshot;
  ledger: FotMobResultLedgerState;
  now: Date;
  timeZone: string;
  maxDates: number;
}): FotMobTerminalPlan {
  if (Number.isNaN(options.now.valueOf())) throw new Error('FotMob terminal planner time is invalid.');
  assertTimeZone(options.timeZone);
  if (!Number.isInteger(options.maxDates) || options.maxDates < 1 || options.maxDates > 31) {
    throw new Error('FotMob terminal planner maxDates must be between 1 and 31.');
  }

  const providerIdsByMatchId = new Map<string, Set<string>>();
  for (const link of options.base.links) {
    if (link.entityType !== 'match'
      || link.provider !== 'fotmob-unofficial'
      || link.providerEntityType !== 'match'
      || !/^[1-9]\d*$/u.test(link.providerEntityId)) continue;
    const ids = providerIdsByMatchId.get(link.entityId) ?? new Set<string>();
    ids.add(link.providerEntityId);
    providerIdsByMatchId.set(link.entityId, ids);
  }

  const grouped = new Map<string, FotMobTerminalPlanMatch[]>();
  const exhaustedMatchIds: string[] = [];
  const orderedMatches = [...options.base.matches].sort((left, right) => (
    left.kickoffUtc.localeCompare(right.kickoffUtc) || left.matchId.localeCompare(right.matchId)
  ));
  for (const match of orderedMatches) {
    if (match.status !== 'scheduled') continue;
    const providerIds = [...(providerIdsByMatchId.get(match.matchId) ?? [])];
    if (providerIds.length !== 1) continue;
    const kickoff = Date.parse(match.kickoffUtc);
    if (Number.isNaN(kickoff)) continue;
    const checkpoint = options.ledger.matches[fotMobMatchKey(match.matchId)];
    if (checkpoint?.terminalAt || checkpoint?.exhaustedAt) continue;
    if ((checkpoint?.attemptCount ?? 0) >= MAX_CHECKS
      || options.now.getTime() >= kickoff + HARD_CUTOFF_MINUTES * 60_000) {
      exhaustedMatchIds.push(match.matchId);
      continue;
    }
    const dueAt = checkpoint?.nextCheckAt
      ? Date.parse(checkpoint.nextCheckAt)
      : kickoff + FIRST_CHECK_AFTER_MINUTES * 60_000;
    if (Number.isNaN(dueAt) || dueAt > options.now.getTime()) continue;
    const date = dateInTimeZone(new Date(kickoff), options.timeZone);
    const dateCheckpoint = options.ledger.dates[fotMobDateKey(date)];
    if (dateCheckpoint?.nextAttemptAt
      && Date.parse(dateCheckpoint.nextAttemptAt) > options.now.getTime()) continue;
    const current = grouped.get(date) ?? [];
    current.push({
      matchId: match.matchId,
      providerMatchId: providerIds[0]!,
      kickoffUtc: match.kickoffUtc
    });
    grouped.set(date, current);
  }

  const groups = [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, options.maxDates)
    .map(([date, matches]) => {
      const checkpoint = options.ledger.dates[fotMobDateKey(date)];
      return {
        date,
        ...(checkpoint?.etag ? { etag: checkpoint.etag } : {}),
        matches
      };
    });
  return { groups, exhaustedMatchIds };
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function assertTimeZone(value: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error('FotMob terminal planner timeZone must be a valid IANA time zone.');
  }
}
