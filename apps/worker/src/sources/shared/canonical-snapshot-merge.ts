import path from 'node:path';
import type {
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import {
  readCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import { readServingMatchStoreManifest } from '../../../../api/src/repositories/serving-match-store.js';

export async function loadLastGoodWarehouseSnapshot(
  dataRoot: string
): Promise<CanonicalWarehouseSnapshot> {
  try {
    const manifest = await readServingMatchStoreManifest(path.join(dataRoot, 'serving'));
    if (!manifest.warehouseRunId) {
      throw new Error(
        'Existing serving snapshot has no canonical warehouse run; refusing to replace last-good data.'
      );
    }
    return readCanonicalWarehouseRun(dataRoot, manifest.warehouseRunId);
  } catch (error) {
    if ((error as { code?: string }).code === 'serving_match_store_missing') {
      return emptyCanonicalWarehouseSnapshot();
    }
    throw error;
  }
}

export function emptyCanonicalWarehouseSnapshot(): CanonicalWarehouseSnapshot {
  return {
    matches: [],
    teams: [],
    competitions: [],
    links: [],
    provenance: []
  };
}

/**
 * Reuses a prior canonical ID when the same provider source link reports a
 * rescheduled kickoff. The provider slug resolves an existing identity; it is
 * never used as the public canonical ID itself.
 */
export function alignDeltaMatchIds(
  base: CanonicalWarehouseSnapshot,
  delta: CanonicalWarehouseSnapshot
): CanonicalWarehouseSnapshot {
  const baseMatchById = new Map(base.matches.map((match) => [match.matchId, match]));
  const baseLinksByProviderId = new Map<string, ProviderLink[]>();
  for (const link of base.links) {
    if (link.entityType !== 'match') continue;
    const sourceKey = providerEntityKey(link);
    const current = baseLinksByProviderId.get(sourceKey) ?? [];
    current.push(link);
    baseLinksByProviderId.set(sourceKey, current);
  }
  const baseMatchesByFixture = new Map<string, typeof base.matches>();
  for (const match of base.matches) {
    const key = canonicalFixtureKey(match);
    const current = baseMatchesByFixture.get(key) ?? [];
    current.push(match);
    baseMatchesByFixture.set(key, current);
  }
  const deltaLinksByMatchId = new Map<string, ProviderLink[]>();
  for (const link of delta.links) {
    if (link.entityType !== 'match') continue;
    const current = deltaLinksByMatchId.get(link.entityId) ?? [];
    current.push(link);
    deltaLinksByMatchId.set(link.entityId, current);
  }

  const remappedIds = new Map<string, string>();
  for (const deltaMatch of delta.matches) {
    const sourceLinkedBase = (deltaLinksByMatchId.get(deltaMatch.matchId) ?? [])
      .flatMap((link) => baseLinksByProviderId.get(providerEntityKey(link)) ?? [])
      .map((baseLink) => baseMatchById.get(baseLink.entityId))
      .find((baseMatch) => baseMatch !== undefined
        && baseMatch.competitionId === deltaMatch.competitionId
        && baseMatch.season === deltaMatch.season
        && baseMatch.homeTeamId === deltaMatch.homeTeamId
        && baseMatch.awayTeamId === deltaMatch.awayTeamId);
    const fixtureMatches = baseMatchesByFixture.get(canonicalFixtureKey(deltaMatch)) ?? [];
    const matchingBase = sourceLinkedBase ?? (
      fixtureMatches.length === 1 ? fixtureMatches[0] : undefined
    );
    if (matchingBase && matchingBase.matchId !== deltaMatch.matchId) {
      remappedIds.set(deltaMatch.matchId, matchingBase.matchId);
    }
  }

  if (remappedIds.size === 0) return delta;
  const remap = (entityId: string): string => remappedIds.get(entityId) ?? entityId;
  return {
    ...delta,
    matches: delta.matches.map((match) => ({ ...match, matchId: remap(match.matchId) })),
    links: delta.links.map((link) => link.entityType === 'match'
      ? { ...link, entityId: remap(link.entityId) }
      : link),
    provenance: delta.provenance.map((item) => item.entityType === 'match'
      ? { ...item, entityId: remap(item.entityId) }
      : item)
  };
}

function canonicalFixtureKey(match: {
  competitionId: string;
  season: string;
  kickoffUtc: string;
  homeTeamId: string;
  awayTeamId: string;
}): string {
  return [
    match.competitionId,
    match.season,
    match.kickoffUtc.slice(0, 10),
    match.homeTeamId,
    match.awayTeamId
  ].join('|');
}

export function mergeCanonicalWarehouseSnapshots(
  base: CanonicalWarehouseSnapshot,
  unalignedDelta: CanonicalWarehouseSnapshot
): CanonicalWarehouseSnapshot {
  const delta = alignDeltaMatchIds(base, unalignedDelta);
  const matches = new Map(base.matches.map((match) => [match.matchId, match]));
  const regressedCompletedMatchIds = new Set<string>();
  for (const candidate of delta.matches) {
    const existing = matches.get(candidate.matchId);
    if (!existing) {
      matches.set(candidate.matchId, candidate);
      continue;
    }
    if (existing.status === 'completed' && candidate.status !== 'completed') {
      regressedCompletedMatchIds.add(candidate.matchId);
      continue;
    }
    if (isAtLeastAsNew(candidate.updatedAt, existing.updatedAt)) {
      matches.set(candidate.matchId, candidate);
    }
  }

  const teams = mergeByUpdatedAt(
    base.teams,
    delta.teams,
    (team) => team.teamId,
    (team) => team.updatedAt
  );
  const competitions = mergeByUpdatedAt(
    base.competitions,
    delta.competitions,
    (competition) => competition.competitionId,
    (competition) => competition.updatedAt
  );
  const links = mergeByUpdatedAt(
    base.links,
    delta.links,
    providerLinkKey,
    (link) => link.linkedAt
  );
  const acceptedProvenance = delta.provenance.filter((item) => !(
    item.entityType === 'match' && regressedCompletedMatchIds.has(item.entityId)
  ));
  const provenance = mergeByUpdatedAt(
    base.provenance,
    acceptedProvenance,
    provenanceKey,
    (item) => item.observedAt
  );

  return {
    matches: [...matches.values()].sort((left, right) => left.matchId.localeCompare(right.matchId)),
    teams: teams.sort((left, right) => left.teamId.localeCompare(right.teamId)),
    competitions: competitions.sort((left, right) => left.competitionId.localeCompare(right.competitionId)),
    links: links.sort((left, right) => providerLinkKey(left).localeCompare(providerLinkKey(right))),
    provenance: provenance.sort((left, right) => provenanceKey(left).localeCompare(provenanceKey(right)))
  };
}

function mergeByUpdatedAt<T>(
  base: readonly T[],
  delta: readonly T[],
  key: (value: T) => string,
  updatedAt: (value: T) => string
): T[] {
  const merged = new Map(base.map((value) => [key(value), value]));
  for (const candidate of delta) {
    const existing = merged.get(key(candidate));
    if (!existing || isAtLeastAsNew(updatedAt(candidate), updatedAt(existing))) {
      merged.set(key(candidate), candidate);
    }
  }
  return [...merged.values()];
}

function isAtLeastAsNew(candidate: string, existing: string): boolean {
  const candidateTime = Date.parse(candidate);
  const existingTime = Date.parse(existing);
  return !Number.isNaN(candidateTime)
    && (Number.isNaN(existingTime) || candidateTime >= existingTime);
}

function providerLinkKey(link: ProviderLink): string {
  return [
    link.entityType,
    link.entityId,
    link.provider,
    link.providerEntityType,
    link.providerEntityId
  ].join('|');
}

function providerEntityKey(link: ProviderLink): string {
  return [link.provider, link.providerEntityType, link.providerEntityId].join('|');
}

function provenanceKey(item: FieldProvenance): string {
  return [
    item.entityType,
    item.entityId,
    item.fieldPath,
    item.provider,
    item.providerEntityId
  ].join('|');
}
