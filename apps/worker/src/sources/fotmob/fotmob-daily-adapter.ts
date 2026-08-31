import { createHash } from 'node:crypto';
import type { CompetitionSourceEntry } from '@miraichi/config';
import type {
  CanonicalMatch,
  CanonicalMatchStatus,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import type { CanonicalWarehouseSnapshot } from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import type { FotMobDailyPayload } from './fotmob-daily-client.js';
import type { FotMobRawMatch } from './fotmob-season-client.js';

const PROVIDER = 'fotmob-unofficial' as const;

export interface FotMobDailyObservation {
  matchId: string;
  providerMatchId: string;
  outcome: 'terminal' | 'non_terminal' | 'invalid';
}

export interface FotMobDailyAdapterIssue {
  code: 'invalid_match_identity' | 'unknown_match' | 'competition_mismatch' | 'invalid_score';
  message: string;
  leagueIndex: number;
  matchIndex: number;
}

export interface AdaptFotMobDailyTerminalInput {
  registry: readonly CompetitionSourceEntry[];
  base: CanonicalWarehouseSnapshot;
  rawPayload: FotMobDailyPayload;
  observedAt: string;
}

export interface FotMobDailyTerminalBatch {
  delta: CanonicalWarehouseSnapshot;
  observations: FotMobDailyObservation[];
  issues: FotMobDailyAdapterIssue[];
}

export function adaptFotMobDailyTerminalResults(
  input: AdaptFotMobDailyTerminalInput
): FotMobDailyTerminalBatch {
  if (Number.isNaN(Date.parse(input.observedAt))) {
    throw new Error('FotMob daily adapter observedAt must be a valid timestamp.');
  }
  const entryByLeagueId = new Map<number, CompetitionSourceEntry>();
  for (const entry of input.registry) {
    const binding = entry.sourceBindings.result;
    if (binding?.sourceId !== PROVIDER
      || binding.endpointKind !== 'daily-api'
      || binding.executionStatus !== 'enabled'
      || !Number.isSafeInteger(binding.externalNumericId)) continue;
    entryByLeagueId.set(binding.externalNumericId!, entry);
  }
  const baseMatchById = new Map(input.base.matches.map((match) => [match.matchId, match]));
  const linksByProviderMatchId = new Map<string, ProviderLink[]>();
  for (const link of input.base.links) {
    if (link.entityType !== 'match'
      || link.provider !== PROVIDER
      || link.providerEntityType !== 'match') continue;
    const current = linksByProviderMatchId.get(link.providerEntityId) ?? [];
    current.push(link);
    linksByProviderMatchId.set(link.providerEntityId, current);
  }

  const matches: CanonicalMatch[] = [];
  const provenance: FieldProvenance[] = [];
  const observations: FotMobDailyObservation[] = [];
  const issues: FotMobDailyAdapterIssue[] = [];

  for (const [leagueIndex, league] of input.rawPayload.leagues.entries()) {
    const leagueId = positiveInteger(league.id);
    const entry = leagueId === null ? undefined : entryByLeagueId.get(leagueId);
    if (!entry) continue;

    for (const [matchIndex, raw] of league.matches.entries()) {
      const providerMatchId = providerId(raw.id);
      if (!providerMatchId) {
        if (isTerminal(raw)) {
          issues.push(issue(
            'invalid_match_identity',
            'Terminal row must contain a positive provider match ID.',
            leagueIndex,
            matchIndex
          ));
        }
        continue;
      }
      const linkedMatches = (linksByProviderMatchId.get(providerMatchId) ?? [])
        .map((link) => baseMatchById.get(link.entityId))
        .filter((match): match is CanonicalMatch => match !== undefined);
      const existing = linkedMatches.length === 1 ? linkedMatches[0] : undefined;
      if (!existing) {
        if (isTerminal(raw)) {
          issues.push(issue(
            'unknown_match',
            'Terminal row has no unique existing canonical match link; season is not guessed.',
            leagueIndex,
            matchIndex
          ));
        }
        continue;
      }
      if (existing.competitionId !== entry.competitionId) {
        issues.push(issue(
          'competition_mismatch',
          'Provider match link belongs to a different canonical competition.',
          leagueIndex,
          matchIndex
        ));
        continue;
      }
      const status = terminalStatus(raw);
      if (!status) {
        observations.push({
          matchId: existing.matchId,
          providerMatchId,
          outcome: 'non_terminal'
        });
        continue;
      }
      const score = status === 'completed' ? finalScore(raw) : null;
      if (status === 'completed' && !score) {
        observations.push({
          matchId: existing.matchId,
          providerMatchId,
          outcome: 'invalid'
        });
        issues.push(issue(
          'invalid_score',
          'Completed row must contain a valid non-negative final score.',
          leagueIndex,
          matchIndex
        ));
        continue;
      }

      const updated: CanonicalMatch = {
        ...existing,
        status,
        scoreHome: score?.home ?? null,
        scoreAway: score?.away ?? null,
        updatedAt: input.observedAt
      };
      matches.push(updated);
      observations.push({
        matchId: existing.matchId,
        providerMatchId,
        outcome: 'terminal'
      });
      provenance.push(createProvenance(
        existing.matchId,
        providerMatchId,
        'status',
        status,
        input.observedAt
      ));
      if (score) {
        provenance.push(
          createProvenance(
            existing.matchId,
            providerMatchId,
            'scoreHome',
            score.home,
            input.observedAt
          ),
          createProvenance(
            existing.matchId,
            providerMatchId,
            'scoreAway',
            score.away,
            input.observedAt
          )
        );
      }
    }
  }

  return {
    delta: {
      matches,
      teams: [],
      competitions: [],
      links: [],
      provenance
    },
    observations,
    issues
  };
}

function terminalStatus(raw: FotMobRawMatch): CanonicalMatchStatus | null {
  const reason = reasonText(raw.status?.reason).toLowerCase();
  if (reason.includes('postponed') || /(?:^|\s)pp(?:\s|$)/u.test(reason)) return 'postponed';
  if (raw.status?.cancelled === true) return 'cancelled';
  if (raw.status?.finished === true) return 'completed';
  return null;
}

function isTerminal(raw: FotMobRawMatch): boolean {
  return terminalStatus(raw) !== null;
}

function finalScore(raw: FotMobRawMatch): { home: number; away: number } | null {
  const score = raw.status?.scoreStr?.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/u);
  const home = score ? Number(score[1]) : raw.home?.score;
  const away = score ? Number(score[2]) : raw.away?.score;
  return Number.isSafeInteger(home) && Number.isSafeInteger(away) && home! >= 0 && away! >= 0
    ? { home: home!, away: away! }
    : null;
}

function reasonText(reason: NonNullable<FotMobRawMatch['status']>['reason']): string {
  if (typeof reason === 'string') return reason;
  if (!reason || typeof reason !== 'object') return '';
  return [reason.short, reason.shortKey, reason.long, reason.longKey]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function positiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^[1-9]\d*$/u.test(value)) return Number(value);
  return null;
}

function providerId(value: unknown): string | null {
  const parsed = positiveInteger(value);
  return parsed === null ? null : String(parsed);
}

function createProvenance(
  entityId: string,
  providerEntityId: string,
  fieldPath: string,
  value: unknown,
  observedAt: string
): FieldProvenance {
  return {
    entityType: 'match',
    entityId,
    fieldPath,
    provider: PROVIDER,
    providerEntityId,
    observedAt,
    confidence: 1,
    valueHash: createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex')
  };
}

function issue(
  code: FotMobDailyAdapterIssue['code'],
  message: string,
  leagueIndex: number,
  matchIndex: number
): FotMobDailyAdapterIssue {
  return { code, message, leagueIndex, matchIndex };
}
