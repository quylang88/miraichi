import path from 'node:path';
import type { SportScoreCompetitionEntry } from '@miraichi/config';
import {
  validateCanonicalMatch,
  validateFieldProvenance,
  validateProviderLink
} from '@miraichi/shared';
import {
  writeCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  buildServingMatchesFromWarehouse,
  buildServingMatchStore
} from '../../../api/src/repositories/serving-match-store.js';
import {
  adaptSportScoreFixtures,
  type SportScoreAdapterIssue
} from '../sources/sportscore/sportscore-adapter.js';
import type { SportScoreFixturesResponse } from '../sources/sportscore/sportscore-response-contract.js';
import {
  loadLastGoodWarehouseSnapshot,
  mergeCanonicalWarehouseSnapshots
} from '../sources/shared/canonical-snapshot-merge.js';

export interface SportScorePublicationJobOptions {
  dataRoot: string;
  runId: string;
  competitionEntry: SportScoreCompetitionEntry;
  season: string;
  response: SportScoreFixturesResponse;
  observedAt: string;
}

export interface SportScorePublicationJobResult {
  status: 'published' | 'not_modified' | 'rejected';
  runId: string;
  matchesPublished: number;
  ignoredInPlayCount: number;
  reason?:
    | 'empty_response'
    | 'partial_response'
    | 'invalid_response'
    | 'no_publishable_matches';
  issues: SportScoreAdapterIssue[];
}

export async function runSportScorePublicationJob(
  options: SportScorePublicationJobOptions
): Promise<SportScorePublicationJobResult> {
  const responseValidation = validateResponseCompleteness(options.response);
  if (!responseValidation.ok) {
    return result(options.runId, 'rejected', 0, 0, responseValidation.reason, []);
  }
  if (options.response.matches.length === 0) {
    return result(options.runId, 'not_modified', 0, 0, 'empty_response', []);
  }

  const adapted = adaptSportScoreFixtures({
    competitionEntry: options.competitionEntry,
    season: options.season,
    fixtures: options.response.matches,
    observedAt: options.observedAt
  });
  if (adapted.issues.some((issue) => issue.severity === 'invalid')) {
    return result(
      options.runId,
      'rejected',
      0,
      adapted.ignoredInPlayCount,
      'invalid_response',
      adapted.issues
    );
  }
  if (adapted.matches.length === 0) {
    return result(
      options.runId,
      'not_modified',
      0,
      adapted.ignoredInPlayCount,
      'no_publishable_matches',
      adapted.issues
    );
  }

  const base = await loadLastGoodWarehouseSnapshot(options.dataRoot);
  const delta: CanonicalWarehouseSnapshot = {
    matches: adapted.matches,
    teams: adapted.teams,
    competitions: adapted.competitions,
    links: adapted.links,
    provenance: adapted.provenance
  };
  const candidate = mergeCanonicalWarehouseSnapshots(base, delta);
  const publicationErrors = validatePublicationCandidate(candidate);
  if (publicationErrors.length > 0) {
    return result(
      options.runId,
      'rejected',
      0,
      adapted.ignoredInPlayCount,
      'invalid_response',
      adapted.issues
    );
  }

  const warehouseRoot = await writeCanonicalWarehouseRun(
    options.dataRoot,
    options.runId,
    candidate
  );
  const serving = await buildServingMatchesFromWarehouse({
    warehouseRoot,
    importedAt: options.observedAt
  });
  await buildServingMatchStore({
    servingRoot: path.join(options.dataRoot, 'serving'),
    version: options.runId,
    snapshotId: options.runId,
    generatedAt: options.observedAt,
    importedAt: options.observedAt,
    sources: serving.sources,
    matches: serving.matches,
    warehouseRunId: options.runId
  });

  return result(
    options.runId,
    'published',
    serving.matches.length,
    adapted.ignoredInPlayCount,
    undefined,
    adapted.issues
  );
}

function validateResponseCompleteness(response: SportScoreFixturesResponse):
  | { ok: true }
  | { ok: false; reason: 'partial_response' | 'invalid_response' } {
  if (response.sport !== 'football') {
    return { ok: false, reason: 'invalid_response' };
  }
  if (!Number.isInteger(response.count) || (response.count as number) < 0) {
    return { ok: false, reason: 'invalid_response' };
  }
  if ((response.count as number) !== response.matches.length || response.matches.length > 200) {
    return { ok: false, reason: 'partial_response' };
  }
  return { ok: true };
}

function validatePublicationCandidate(snapshot: CanonicalWarehouseSnapshot): string[] {
  const errors: string[] = [];
  const teamIds = new Set(snapshot.teams.map((team) => team.teamId));
  const competitionIds = new Set(snapshot.competitions.map((competition) => competition.competitionId));
  const entityIds = {
    match: new Set(snapshot.matches.map((match) => match.matchId)),
    team: teamIds,
    competition: competitionIds
  };

  for (const match of snapshot.matches) {
    const validation = validateCanonicalMatch(match);
    if (!validation.ok) errors.push(...validation.errors);
    if (!teamIds.has(match.homeTeamId) || !teamIds.has(match.awayTeamId)) {
      errors.push(`Canonical match ${match.matchId} references a missing team.`);
    }
    if (!competitionIds.has(match.competitionId)) {
      errors.push(`Canonical match ${match.matchId} references a missing competition.`);
    }
    if (match.status === 'completed' && (match.scoreHome === null || match.scoreAway === null)) {
      errors.push(`Completed match ${match.matchId} is missing a final score.`);
    }
    if (match.status !== 'completed' && (match.scoreHome !== null || match.scoreAway !== null)) {
      errors.push(`Non-completed match ${match.matchId} contains a score.`);
    }
  }

  for (const link of snapshot.links) {
    const validation = validateProviderLink(link);
    if (!validation.ok) errors.push(...validation.errors);
    if (hasKnownCanonicalEntity(entityIds, link.entityType)
      && !entityIds[link.entityType].has(link.entityId)) {
      errors.push(`Provider link references missing ${link.entityType} ${link.entityId}.`);
    }
  }
  for (const provenance of snapshot.provenance) {
    const validation = validateFieldProvenance(provenance);
    if (!validation.ok) errors.push(...validation.errors);
    if (hasKnownCanonicalEntity(entityIds, provenance.entityType)
      && !entityIds[provenance.entityType].has(provenance.entityId)) {
      errors.push(`Provenance references missing ${provenance.entityType} ${provenance.entityId}.`);
    }
  }
  return errors;
}

function hasKnownCanonicalEntity(
  entityIds: { match: Set<string>; team: Set<string>; competition: Set<string> },
  entityType: string
): entityType is keyof typeof entityIds {
  return entityType === 'match' || entityType === 'team' || entityType === 'competition';
}

function result(
  runId: string,
  status: SportScorePublicationJobResult['status'],
  matchesPublished: number,
  ignoredInPlayCount: number,
  reason: SportScorePublicationJobResult['reason'] | undefined,
  issues: SportScoreAdapterIssue[]
): SportScorePublicationJobResult {
  return {
    status,
    runId,
    matchesPublished,
    ignoredInPlayCount,
    ...(reason === undefined ? {} : { reason }),
    issues
  };
}
