import { join } from 'node:path';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
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
  const servingRoot = join(dataRoot, 'serving');
  try {
    const manifest = await readServingMatchStoreManifest(servingRoot);
    if (!manifest.warehouseRunId) {
      return emptyCanonicalWarehouseSnapshot();
    }
    return await readCanonicalWarehouseRun(dataRoot, manifest.warehouseRunId);
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'serving_match_store_missing') {
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

export function mergeCanonicalWarehouseSnapshots(
  base: CanonicalWarehouseSnapshot,
  delta: CanonicalWarehouseSnapshot
): CanonicalWarehouseSnapshot {
  const matchMap = new Map<string, CanonicalMatch>();
  const regressedCompletedMatchIds = new Set<string>();
  for (const match of base.matches) {
    matchMap.set(match.matchId, match);
  }
  for (const deltaMatch of delta.matches) {
    const existing = matchMap.get(deltaMatch.matchId);
    if (!existing) {
      matchMap.set(deltaMatch.matchId, deltaMatch);
      continue;
    }

    // Monotonic status integrity:
    // A completed match must never regress to scheduled or non-terminal
    if (existing.status === 'completed' && deltaMatch.status !== 'completed') {
      regressedCompletedMatchIds.add(deltaMatch.matchId);
      matchMap.set(deltaMatch.matchId, {
        ...deltaMatch,
        status: existing.status,
        scoreHome: existing.scoreHome,
        scoreAway: existing.scoreAway,
        updatedAt: deltaMatch.updatedAt
      });
      continue;
    }

    // If delta is completed and existing was scheduled, delta wins
    if (deltaMatch.status === 'completed' && existing.status !== 'completed') {
      matchMap.set(deltaMatch.matchId, deltaMatch);
      continue;
    }

    // If both have same status or normal progression, newer updatedAt wins
    const existingTime = Date.parse(existing.updatedAt);
    const deltaTime = Date.parse(deltaMatch.updatedAt);
    if (Number.isNaN(existingTime) || (!Number.isNaN(deltaTime) && deltaTime >= existingTime)) {
      matchMap.set(deltaMatch.matchId, deltaMatch);
    } else {
      matchMap.set(deltaMatch.matchId, existing);
    }
  }

  const teamMap = new Map<string, CanonicalTeam>();
  for (const team of base.teams) {
    teamMap.set(team.teamId, team);
  }
  for (const deltaTeam of delta.teams) {
    const existing = teamMap.get(deltaTeam.teamId);
    if (!existing) {
      teamMap.set(deltaTeam.teamId, deltaTeam);
      continue;
    }
    const existingTime = Date.parse(existing.updatedAt);
    const deltaTime = Date.parse(deltaTeam.updatedAt);
    const chosen = !Number.isNaN(deltaTime) && !Number.isNaN(existingTime) && deltaTime >= existingTime ? deltaTeam : existing;
    const countryCode = deltaTeam.countryCode ?? existing.countryCode;
    teamMap.set(deltaTeam.teamId, {
      ...chosen,
      ...(countryCode !== undefined ? { countryCode } : {})
    });
  }

  const competitionMap = new Map<string, CanonicalCompetition>();
  for (const comp of base.competitions) {
    competitionMap.set(comp.competitionId, comp);
  }
  for (const deltaComp of delta.competitions) {
    const existing = competitionMap.get(deltaComp.competitionId);
    if (!existing) {
      competitionMap.set(deltaComp.competitionId, deltaComp);
      continue;
    }
    const existingTime = Date.parse(existing.updatedAt);
    const deltaTime = Date.parse(deltaComp.updatedAt);
    const chosen = !Number.isNaN(deltaTime) && !Number.isNaN(existingTime) && deltaTime >= existingTime ? deltaComp : existing;
    competitionMap.set(deltaComp.competitionId, chosen);
  }

  const linkMap = new Map<string, ProviderLink>();
  for (const link of base.links) {
    const key = [link.entityType, link.entityId, link.provider, link.providerEntityType, link.providerEntityId].join('|');
    linkMap.set(key, link);
  }
  for (const deltaLink of delta.links) {
    const key = [deltaLink.entityType, deltaLink.entityId, deltaLink.provider, deltaLink.providerEntityType, deltaLink.providerEntityId].join('|');
    const existing = linkMap.get(key);
    if (!existing) {
      linkMap.set(key, deltaLink);
      continue;
    }
    const existingTime = Date.parse(existing.linkedAt);
    const deltaTime = Date.parse(deltaLink.linkedAt);
    const chosen = !Number.isNaN(deltaTime) && !Number.isNaN(existingTime) && deltaTime >= existingTime ? deltaLink : existing;
    linkMap.set(key, chosen);
  }

  const provMap = new Map<string, FieldProvenance>();
  for (const prov of base.provenance) {
    const key = [prov.entityType, prov.entityId, prov.fieldPath, prov.provider, prov.providerEntityId].join('|');
    provMap.set(key, prov);
  }
  for (const deltaProv of delta.provenance) {
    if (
      regressedCompletedMatchIds.has(deltaProv.entityId) &&
      ['status', 'scoreHome', 'scoreAway'].includes(deltaProv.fieldPath)
    ) {
      continue;
    }
    const key = [deltaProv.entityType, deltaProv.entityId, deltaProv.fieldPath, deltaProv.provider, deltaProv.providerEntityId].join('|');
    const existing = provMap.get(key);
    if (!existing) {
      provMap.set(key, deltaProv);
      continue;
    }
    const existingTime = Date.parse(existing.observedAt);
    const deltaTime = Date.parse(deltaProv.observedAt);
    const chosen = !Number.isNaN(deltaTime) && !Number.isNaN(existingTime) && deltaTime >= existingTime ? deltaProv : existing;
    provMap.set(key, chosen);
  }

  return {
    matches: [...matchMap.values()].sort((a, b) => a.matchId.localeCompare(b.matchId)),
    teams: [...teamMap.values()].sort((a, b) => a.teamId.localeCompare(b.teamId)),
    competitions: [...competitionMap.values()].sort((a, b) => a.competitionId.localeCompare(b.competitionId)),
    links: [...linkMap.values()].sort((a, b) => a.entityId.localeCompare(b.entityId)),
    provenance: [...provMap.values()].sort((a, b) => a.entityId.localeCompare(b.entityId))
  };
}
