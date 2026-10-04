import { createHash } from 'node:crypto';
import type { CompetitionSourceEntry } from '@miraichi/config';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalMatchStatus,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import type { FotMobRawMatch, FotMobSeasonPayload } from './fotmob-season-client.js';

const PROVIDER = 'fotmob-unofficial' as const;

export interface FotMobSeasonAdapterIssue {
  code:
    | 'invalid_match_identity'
    | 'invalid_team_identity'
    | 'invalid_kickoff'
    | 'invalid_score'
    | 'live_record_ignored'
    | 'canonical_match_collision';
  severity: 'ignored' | 'invalid';
  message: string;
  recordIndex: number;
}

export interface FotMobCanonicalBatch {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
  issues: FotMobSeasonAdapterIssue[];
}

export interface AdaptFotMobSeasonInput {
  competitionEntry: CompetitionSourceEntry;
  canonicalSeason: string;
  expectedProviderSeason: string;
  externalCompetitionId: number;
  rawPayload: FotMobSeasonPayload;
  observedAt: string;
}

export function adaptFotMobSeason(input: AdaptFotMobSeasonInput): FotMobCanonicalBatch {
  if (Number.isNaN(Date.parse(input.observedAt))) {
    throw new Error('FotMob adapter observedAt must be a valid timestamp.');
  }
  if (input.rawPayload.details.selectedSeason.trim() !== input.expectedProviderSeason) {
    throw new Error(
      `FotMob selected season mismatch: expected ${input.expectedProviderSeason}, received ${input.rawPayload.details.selectedSeason}.`
    );
  }
  if (!Number.isSafeInteger(input.externalCompetitionId) || input.externalCompetitionId < 1) {
    throw new Error('FotMob adapter externalCompetitionId must be a positive integer.');
  }

  const matches: CanonicalMatch[] = [];
  const teams = new Map<string, CanonicalTeam>();
  const links: ProviderLink[] = [{
    entityType: 'competition',
    entityId: input.competitionEntry.competitionId,
    provider: PROVIDER,
    providerEntityType: 'competition',
    providerEntityId: String(input.externalCompetitionId),
    confidence: 1,
    linkedBy: 'fotmob-season-adapter',
    linkedAt: input.observedAt
  }];
  const provenance: FieldProvenance[] = [];
  const issues: FotMobSeasonAdapterIssue[] = [];
  const seenCanonicalIds = new Set<string>();
  const seenProviderIds = new Set<string>();

  for (const [recordIndex, raw] of input.rawPayload.fixtures.allMatches.entries()) {
    const providerMatchId = normalizeProviderId(raw.id);
    if (!providerMatchId) {
      issues.push(issue(
        'invalid_match_identity',
        'invalid',
        'Match must contain a positive provider identity.',
        recordIndex
      ));
      continue;
    }
    const home = normalizeTeam(raw.home);
    const away = normalizeTeam(raw.away);
    if (!home || !away || home.name.toLowerCase() === away.name.toLowerCase()) {
      issues.push(issue(
        'invalid_team_identity',
        'invalid',
        'Match must contain two distinct teams with stable provider identities.',
        recordIndex
      ));
      continue;
    }
    const kickoffUtc = normalizeUtc(raw.status?.utcTime);
    if (!kickoffUtc) {
      issues.push(issue(
        'invalid_kickoff',
        'invalid',
        'Match must contain an exact timezone-qualified kickoff.',
        recordIndex
      ));
      continue;
    }

    if (raw.status?.started === true && raw.status.finished !== true && raw.status.cancelled !== true) {
      issues.push(issue(
        'live_record_ignored',
        'ignored',
        'In-progress match data is excluded from the terminal-only canonical feed.',
        recordIndex
      ));
      continue;
    }

    const status = canonicalStatus(raw);
    const score = status === 'completed' ? finalScore(raw) : null;
    if (status === 'completed' && !score) {
      issues.push(issue(
        'invalid_score',
        'invalid',
        'Completed match must contain a valid non-negative final score.',
        recordIndex
      ));
      continue;
    }

    const homeTeamId = deriveTeamId(home.name);
    const awayTeamId = deriveTeamId(away.name);
    const matchId = deriveMatchId({
      competitionId: input.competitionEntry.competitionId,
      canonicalSeason: input.canonicalSeason,
      kickoffDate: kickoffUtc.slice(0, 10),
      homeTeamId,
      awayTeamId
    });
    if (seenCanonicalIds.has(matchId) || seenProviderIds.has(providerMatchId)) {
      issues.push(issue(
        'canonical_match_collision',
        'invalid',
        'Duplicate match identity detected in the provider season payload.',
        recordIndex
      ));
      continue;
    }
    seenCanonicalIds.add(matchId);
    seenProviderIds.add(providerMatchId);

    addTeam(teams, links, {
      teamId: homeTeamId,
      name: home.name,
      providerTeamId: home.providerId,
      observedAt: input.observedAt
    });
    addTeam(teams, links, {
      teamId: awayTeamId,
      name: away.name,
      providerTeamId: away.providerId,
      observedAt: input.observedAt
    });

    const venue = normalizeOptionalText(raw.venue);
    const round = normalizeOptionalText(raw.round);
    const match: CanonicalMatch = {
      matchId,
      competitionId: input.competitionEntry.competitionId,
      season: input.canonicalSeason,
      kickoffUtc,
      status,
      homeTeamId,
      awayTeamId,
      scoreHome: score?.home ?? null,
      scoreAway: score?.away ?? null,
      ...(venue ? { venue } : {}),
      ...(round ? { round } : {}),
      updatedAt: input.observedAt
    };
    matches.push(match);
    links.push({
      entityType: 'match',
      entityId: matchId,
      provider: PROVIDER,
      providerEntityType: 'match',
      providerEntityId: providerMatchId,
      confidence: 1,
      linkedBy: 'fotmob-season-adapter',
      linkedAt: input.observedAt
    });
    provenance.push(
      createProvenance(matchId, providerMatchId, 'status', status, input.observedAt),
      createProvenance(matchId, providerMatchId, 'kickoffUtc', kickoffUtc, input.observedAt)
    );
    if (score) {
      provenance.push(
        createProvenance(matchId, providerMatchId, 'scoreHome', score.home, input.observedAt),
        createProvenance(matchId, providerMatchId, 'scoreAway', score.away, input.observedAt)
      );
    }
  }

  return {
    matches,
    teams: [...teams.values()],
    competitions: [{
      competitionId: input.competitionEntry.competitionId,
      name: input.competitionEntry.competitionName,
      type: input.competitionEntry.competitionType,
      updatedAt: input.observedAt
    }],
    links,
    provenance,
    issues
  };
}

function canonicalStatus(raw: FotMobRawMatch): CanonicalMatchStatus {
  if (raw.status?.cancelled === true) return 'cancelled';
  if (/postponed/u.test(reasonText(raw.status?.reason).toLowerCase())) return 'postponed';
  if (raw.status?.finished === true) return 'completed';
  return 'scheduled';
}

function reasonText(reason: NonNullable<FotMobRawMatch['status']>['reason']): string {
  if (typeof reason === 'string') return reason;
  if (!reason || typeof reason !== 'object') return '';
  return [reason.short, reason.shortKey, reason.long, reason.longKey]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');
}

function finalScore(raw: FotMobRawMatch): { home: number; away: number } | null {
  const score = raw.status?.scoreStr?.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/u);
  const home = score ? Number(score[1]) : raw.home?.score;
  const away = score ? Number(score[2]) : raw.away?.score;
  return Number.isSafeInteger(home) && Number.isSafeInteger(away) && home! >= 0 && away! >= 0
    ? { home: home!, away: away! }
    : null;
}

function normalizeTeam(team: FotMobRawMatch['home']): {
  providerId: string;
  name: string;
} | null {
  const providerId = normalizeProviderId(team?.id);
  const name = normalizeOptionalText(team?.name);
  return providerId && name ? { providerId, name } : null;
}

function normalizeProviderId(value: unknown): string | null {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value === 'string' && /^[1-9]\d*$/u.test(value)) return value;
  return null;
}

function normalizeUtc(value: unknown): string | null {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/u.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const normalized = String(value).trim().replace(/\s+/gu, ' ');
  return normalized || undefined;
}

function addTeam(
  teams: Map<string, CanonicalTeam>,
  links: ProviderLink[],
  input: {
    teamId: string;
    name: string;
    providerTeamId: string;
    observedAt: string;
  }
): void {
  if (teams.has(input.teamId)) return;
  teams.set(input.teamId, {
    teamId: input.teamId,
    name: input.name,
    updatedAt: input.observedAt
  });
  links.push({
    entityType: 'team',
    entityId: input.teamId,
    provider: PROVIDER,
    providerEntityType: 'team',
    providerEntityId: input.providerTeamId,
    confidence: 1,
    linkedBy: 'fotmob-season-adapter',
    linkedAt: input.observedAt
  });
}

function deriveTeamId(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return `team-${slug || sha256Hex(name).slice(0, 16)}`;
}

function deriveMatchId(input: {
  competitionId: string;
  canonicalSeason: string;
  kickoffDate: string;
  homeTeamId: string;
  awayTeamId: string;
}): string {
  return `match-${sha256Hex([
    input.competitionId,
    input.canonicalSeason,
    input.kickoffDate,
    input.homeTeamId,
    input.awayTeamId
  ].join(':')).slice(0, 24)}`;
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
    valueHash: sha256Hex(JSON.stringify(value))
  };
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function issue(
  code: FotMobSeasonAdapterIssue['code'],
  severity: FotMobSeasonAdapterIssue['severity'],
  message: string,
  recordIndex: number
): FotMobSeasonAdapterIssue {
  return { code, severity, message, recordIndex };
}
