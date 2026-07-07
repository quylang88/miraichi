import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RawProviderPayloadEnvelope } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface LeagueSeasonInventory {
  seasonId: number;
  name?: string;
  sortDate?: string;
}

export interface LeagueTeamSeasonInventory {
  teamId: number;
  seasonId: number;
}

export interface SportmonksLeagueCaptureInventory {
  leagueId: number;
  seasons: LeagueSeasonInventory[];
  fixtureIds: number[];
  teamIds: number[];
  teamSeasons: LeagueTeamSeasonInventory[];
}

export interface BuildSportmonksLeagueInventoryOptions {
  captureRoot: string;
  leagueId: number;
  seasonIds?: number[];
  maxSeasons?: number;
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Build a deterministic league/season/fixture/team inventory from existing
 * raw Sportmonks envelopes. Never writes files or calls the Sportmonks API.
 *
 * @throws if maxSeasons < 1
 * @throws if no fixture inventory exists for the given leagueId
 * @throws if explicit seasonIds produces an empty selection
 */
export async function buildSportmonksLeagueCaptureInventory(
  options: BuildSportmonksLeagueInventoryOptions
): Promise<SportmonksLeagueCaptureInventory> {
  const { captureRoot, leagueId, seasonIds: explicitSeasonIds, maxSeasons } = options;

  if (maxSeasons !== undefined && maxSeasons < 1) {
    throw new Error('maxSeasons must be at least 1');
  }

  // ── 1. Read all raw fixtures.all envelopes ──────────────────────────────────
  const allFixtures = await readAllEnvelopePayloads(captureRoot, 'fixtures.all');
  const allFixtureItems = allFixtures.flatMap((p) => extractDataArray(p));

  // Filter to this league
  const leagueFixtures = allFixtureItems.filter(
    (f): f is { id: number; league_id: number; season_id: number } =>
      isPositiveInt(f.id) && f.league_id === leagueId && isPositiveInt(f.season_id)
  );

  if (leagueFixtures.length === 0) {
    throw new Error(`No local Sportmonks fixture inventory found for league ${leagueId}`);
  }

  // ── 2. Read all raw seasons.all envelopes ───────────────────────────────────
  const allSeasons = await readAllEnvelopePayloads(captureRoot, 'seasons.all');
  const allSeasonItems = allSeasons.flatMap((p) => extractDataArray(p));

  // Map league seasons by id
  const leagueSeasonMap = new Map<
    number,
    { id: number; name?: string; ending_at?: string; starting_at?: string }
  >();
  for (const s of allSeasonItems) {
    if (isPositiveInt(s.id) && s.league_id === leagueId) {
      leagueSeasonMap.set(s.id as number, s as { id: number; name?: string; ending_at?: string; starting_at?: string });
    }
  }

  // Determine which season IDs have fixtures in this league
  const fixtureSeasonIds = new Set(leagueFixtures.map((f) => f.season_id));

  // Build the candidate season list from fixtureSeasonIds (merged with season metadata if present)
  let candidateSeasons: LeagueSeasonInventory[] = [...fixtureSeasonIds].map((id) => {
    const meta = leagueSeasonMap.get(id);
    const sortDate = meta?.ending_at ?? meta?.starting_at;
    const entry: LeagueSeasonInventory = { seasonId: id };
    if (meta?.name !== undefined) entry.name = meta.name;
    if (sortDate !== undefined) entry.sortDate = sortDate;
    return entry;
  });

  // Sort: by sortDate descending (newest first), then by seasonId descending as tiebreaker
  candidateSeasons.sort((a, b) => {
    if (a.sortDate && b.sortDate) {
      if (b.sortDate !== a.sortDate) return b.sortDate.localeCompare(a.sortDate);
    } else if (a.sortDate) {
      return -1;
    } else if (b.sortDate) {
      return 1;
    }
    return b.seasonId - a.seasonId;
  });

  // ── 3. Apply explicit seasonIds filter first, then maxSeasons ──────────────
  let selectedSeasons: LeagueSeasonInventory[];
  if (explicitSeasonIds !== undefined && explicitSeasonIds.length > 0) {
    const explicit = new Set(explicitSeasonIds);
    selectedSeasons = candidateSeasons.filter((s) => explicit.has(s.seasonId));
    if (selectedSeasons.length === 0) {
      throw new Error(
        `No seasons matched explicit seasonIds [${explicitSeasonIds.join(', ')}] for league ${leagueId}`
      );
    }
    if (maxSeasons !== undefined) {
      selectedSeasons = selectedSeasons.slice(0, maxSeasons);
    }
  } else {
    selectedSeasons = maxSeasons !== undefined ? candidateSeasons.slice(0, maxSeasons) : candidateSeasons;
  }

  const selectedSeasonIds = new Set(selectedSeasons.map((s) => s.seasonId));

  // ── 4. Filter fixtures to selected seasons ──────────────────────────────────
  const selectedFixtureIds = deduplicateSorted(
    leagueFixtures
      .filter((f) => selectedSeasonIds.has(f.season_id))
      .map((f) => f.id)
  );

  // ── 5. Resolve team IDs ─────────────────────────────────────────────────────
  // Primary: read teams.bySeasonId raw envelopes for each selected season
  const teamSeasonPairs: LeagueTeamSeasonInventory[] = [];
  let teamIdsFromSeasons: number[] = [];

  for (const season of selectedSeasons) {
    const teamPayloads = await readAllEnvelopePayloadsByUrlPattern(
      captureRoot,
      'teams.bySeasonId',
      `/teams/seasons/${season.seasonId}`
    );

    if (teamPayloads.length > 0) {
      const seasonTeamIds = teamPayloads
        .flatMap((p) => extractDataArray(p))
        .map((t): number | null => (isPositiveInt(t.id) ? (t.id as number) : null))
        .filter((id): id is number => id !== null);

      teamIdsFromSeasons.push(...seasonTeamIds);
      for (const teamId of new Set(seasonTeamIds)) {
        teamSeasonPairs.push({ teamId, seasonId: season.seasonId });
      }
    }
  }

  // Fallback: if no teams.bySeasonId data, extract from fixtures.enrichedById participants
  if (teamIdsFromSeasons.length === 0) {
    for (const fixtureId of selectedFixtureIds) {
      const enrichedPayloads = await readAllEnvelopePayloadsByUrlPattern(
        captureRoot,
        'fixtures.enrichedById',
        `/fixtures/${fixtureId}`
      );
      for (const payload of enrichedPayloads) {
        const data = (payload as Record<string, unknown>).data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        const fixture = data as Record<string, unknown>;
        if (!isPositiveInt(fixture.season_id)) continue;
        const seasonId = fixture.season_id as number;
        if (!selectedSeasonIds.has(seasonId)) continue;
        const participants = fixture.participants;
        if (!Array.isArray(participants)) continue;
        for (const p of participants) {
          if (isPositiveInt(p.id)) {
            const teamId = p.id as number;
            teamIdsFromSeasons.push(teamId);
            teamSeasonPairs.push({ teamId, seasonId });
          }
        }
      }
    }
  }

  const allTeamIds = deduplicateSorted(teamIdsFromSeasons);

  // Sort team-season pairs by (seasonId desc, teamId asc)
  const sortedTeamSeasons = deduplicateTeamSeasonPairs(teamSeasonPairs).sort(
    (a, b) => a.seasonId - b.seasonId || a.teamId - b.teamId
  );

  return {
    leagueId,
    seasons: selectedSeasons,
    fixtureIds: selectedFixtureIds,
    teamIds: allTeamIds,
    teamSeasons: sortedTeamSeasons
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Read all raw payloads for a given endpoint key across all dated subdirectories.
 */
async function readAllEnvelopePayloads(root: string, endpointKey: string): Promise<unknown[]> {
  const endpointDir = join(root, 'providers', 'sportmonks', 'raw', endpointKey);
  let dateDirs: string[];
  try {
    const entries = await readdir(endpointDir);
    dateDirs = entries;
  } catch {
    return [];
  }

  const payloads: unknown[] = [];
  for (const dateDir of dateDirs) {
    const dateFullPath = join(endpointDir, dateDir);
    let files: string[];
    try {
      files = await readdir(dateFullPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(dateFullPath, file), 'utf8');
        const envelope = JSON.parse(content) as RawProviderPayloadEnvelope;
        if (envelope.payload !== undefined) {
          payloads.push(envelope.payload);
        }
      } catch {
        // Skip invalid JSON or unreadable files
      }
    }
  }
  return payloads;
}

/**
 * Read raw payloads for a given endpoint key matching a specific URL path.
 */
async function readAllEnvelopePayloadsByUrlPattern(
  root: string,
  endpointKey: string,
  urlPath: string
): Promise<unknown[]> {
  const endpointDir = join(root, 'providers', 'sportmonks', 'raw', endpointKey);
  let dateDirs: string[];
  try {
    dateDirs = await readdir(endpointDir);
  } catch {
    return [];
  }

  const payloads: unknown[] = [];
  for (const dateDir of dateDirs) {
    const dateFullPath = join(endpointDir, dateDir);
    let files: string[];
    try {
      files = await readdir(dateFullPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(dateFullPath, file), 'utf8');
        const envelope = JSON.parse(content) as RawProviderPayloadEnvelope;
        if (envelope.urlPath === urlPath && envelope.payload !== undefined) {
          payloads.push(envelope.payload);
        }
      } catch {
        // Skip invalid entries
      }
    }
  }
  return payloads;
}

/**
 * Extract `.data` array from a raw payload, returning [] if absent or not an array.
 */
function extractDataArray(payload: unknown): Record<string, unknown>[] {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const p = payload as Record<string, unknown>;
  if (!Array.isArray(p.data)) return [];
  return p.data.filter(
    (item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item)
  );
}

/**
 * Returns true for positive integers (number type, >= 1).
 */
function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1;
}

/**
 * Deduplicate and sort a number array ascending.
 */
function deduplicateSorted(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Deduplicate (teamId, seasonId) pairs preserving the first occurrence order.
 */
function deduplicateTeamSeasonPairs(pairs: LeagueTeamSeasonInventory[]): LeagueTeamSeasonInventory[] {
  const seen = new Set<string>();
  const result: LeagueTeamSeasonInventory[] = [];
  for (const pair of pairs) {
    const key = `${pair.teamId}:${pair.seasonId}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(pair);
    }
  }
  return result;
}
