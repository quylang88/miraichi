export const FOTMOB_RESULT_LEDGER_SCHEMA_VERSION =
  'miraichi.fotmob-terminal-results-ledger.v1' as const;

export interface FotMobResultDateCheckpoint {
  etag?: string;
  lastCheckedAt?: string;
  nextAttemptAt?: string;
  failureCount: number;
  lastError?: string;
}

export interface FotMobResultMatchCheckpoint {
  attemptCount: number;
  nextCheckAt?: string;
  terminalAt?: string;
  exhaustedAt?: string;
}

export interface FotMobResultLedgerState {
  schemaVersion: typeof FOTMOB_RESULT_LEDGER_SCHEMA_VERSION;
  revision: number;
  dates: Record<string, FotMobResultDateCheckpoint>;
  matches: Record<string, FotMobResultMatchCheckpoint>;
  updatedAt: string;
}

export type FotMobDateOutcome =
  | { kind: 'success'; date: string; etag?: string }
  | { kind: 'failure'; date: string; error: string; delayMinutes: number };

export type FotMobMatchOutcome =
  | { kind: 'retry'; matchId: string; delayMinutes: number }
  | { kind: 'terminal'; matchId: string }
  | { kind: 'exhausted'; matchId: string };

export function fotMobDateKey(date: string): string {
  assertCalendarDate(date);
  return `fotmob-unofficial|${date}`;
}

export function fotMobMatchKey(matchId: string): string {
  assertMatchId(matchId);
  return `fotmob-unofficial|${matchId}`;
}

function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error('FotMob result date is invalid.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('FotMob result date is invalid.');
  }
}

function assertMatchId(value: string): void {
  if (!/^match-[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(value)) {
    throw new Error('FotMob result canonical match ID is invalid.');
  }
}

