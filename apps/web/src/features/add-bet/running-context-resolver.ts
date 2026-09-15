import {
  structuredBetMarketCatalog,
  type PublicLiveMatchOverlay,
  type PublicLiveMatchSnapshot
} from '@miraichi/shared';

export type RunningContextResolution =
  | {
      readonly status: 'resolved';
      readonly matchId: string;
      readonly source: 'snapshot';
      readonly readonly: true;
      readonly liveScoreHome: number;
      readonly liveScoreAway: number;
      readonly liveMinute: number;
      readonly observedAt: string;
    }
  | {
      readonly status: 'manual_required';
      readonly reason: 'stale_snapshot' | 'match_not_found' | 'ambiguous_match' | 'match_not_live' | 'missing_live_context';
    };

export interface ResolveRunningContextInput {
  readonly snapshot: PublicLiveMatchSnapshot;
  readonly stale: boolean;
  readonly matchId?: string;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
}

function normalizeTeamName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

function isEligible(match: PublicLiveMatchOverlay): boolean {
  return match.status === 'live' || match.status === 'halftime';
}

function resolved(match: PublicLiveMatchOverlay): RunningContextResolution {
  if (match.elapsedMinute === null) return { status: 'manual_required', reason: 'missing_live_context' };
  return {
    status: 'resolved', matchId: match.matchId, source: 'snapshot', readonly: true,
    liveScoreHome: match.score.home, liveScoreAway: match.score.away,
    liveMinute: match.elapsedMinute, observedAt: match.updatedAt
  };
}

export function resolveRunningContext(input: ResolveRunningContextInput): RunningContextResolution {
  if (input.stale) return { status: 'manual_required', reason: 'stale_snapshot' };
  if (input.matchId) {
    const match = input.snapshot.matches.find((item) => item.matchId === input.matchId);
    if (!match) return { status: 'manual_required', reason: 'match_not_found' };
    if (!isEligible(match)) return { status: 'manual_required', reason: 'match_not_live' };
    return resolved(match);
  }

  const home = normalizeTeamName(input.homeTeamName);
  const away = normalizeTeamName(input.awayTeamName);
  const matches = input.snapshot.matches.filter((match) => isEligible(match)
    && normalizeTeamName(match.homeTeam.name) === home
    && normalizeTeamName(match.awayTeam.name) === away);
  if (matches.length === 0) return { status: 'manual_required', reason: 'match_not_found' };
  if (matches.length > 1) return { status: 'manual_required', reason: 'ambiguous_match' };
  return resolved(matches[0]!);
}

export function getAvailableRunningWindows(liveMinute: number): {
  readonly toHalfTime: boolean;
  readonly toFullTime: boolean;
  readonly fixed15: readonly { readonly startMinute: number; readonly endMinute: number; readonly available: boolean }[];
} {
  const validMinute = Number.isInteger(liveMinute) && liveMinute >= 0 && liveMinute < 90;
  return {
    toHalfTime: validMinute && liveMinute < 45,
    toFullTime: validMinute,
    fixed15: structuredBetMarketCatalog.runningWindows.map((window) => ({
      ...window,
      available: validMinute && liveMinute < window.endMinute
    }))
  };
}
