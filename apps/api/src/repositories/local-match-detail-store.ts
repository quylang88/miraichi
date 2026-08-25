import * as fs from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'node:crypto';
import type {
  LocalMatch,
  LocalMatchDetail,
  LocalMatchEvent,
  LocalMatchSourceRef,
  LocalMatchTeamStats,
  LocalScoreBreakdown
} from '@miraichi/shared';
import { validateLocalMatchDetail } from '@miraichi/shared';

export interface LocalMatchDetailStoreOptions {
  dataRoot: string;
  _writeHook?: (stage: 'before-sync' | 'before-rename') => Promise<void> | void;
}

export function resolveContainedPath(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const relativePath = path.relative(resolvedRoot, candidate);
  if (
    (relativePath === '' && segments.length > 0) ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    relativePath.startsWith('..\\') ||
    relativePath.startsWith('../') ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Path escaped its allowed root: ${candidate}`);
  }
  return candidate;
}

function assertSafeMatchId(matchId: string): void {
  if (typeof matchId !== 'string' || matchId.trim() === '') {
    throw new Error('Match ID must be a non-empty string');
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(matchId)) {
    throw new Error(`Unsafe match ID rejected: "${matchId}"`);
  }
}

export class LocalMatchDetailStore {
  private readonly detailsDir: string;
  private readonly writeHook?: (stage: 'before-sync' | 'before-rename') => Promise<void> | void;

  constructor(options: LocalMatchDetailStoreOptions | string) {
    const dataRoot = typeof options === 'string' ? options : options?.dataRoot;
    if (!dataRoot || typeof dataRoot !== 'string' || dataRoot.trim() === '') {
      throw new Error('dataRoot must be a non-empty string');
    }
    this.detailsDir = path.resolve(dataRoot, 'match-details');
    if (typeof options === 'object' && options?._writeHook) {
      this.writeHook = options._writeHook;
    }
  }

  async getDetail(matchId: string): Promise<LocalMatchDetail | null> {
    assertSafeMatchId(matchId);
    const filePath = resolveContainedPath(this.detailsDir, `${matchId}.json`);
    const backupPath = resolveContainedPath(this.detailsDir, `.backup-${matchId}.json`);

    let content: string;
    let recoveredFromBackup = false;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        try {
          content = await fs.readFile(backupPath, 'utf8');
          recoveredFromBackup = true;
        } catch (backupError) {
          if ((backupError as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
          }
          throw backupError;
        }
      } else {
        throw error;
      }
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return null;
    }

    const validation = validateLocalMatchDetail(parsed);
    if (!validation.ok) {
      return null;
    }

    if (recoveredFromBackup) {
      await fs.rename(backupPath, filePath);
    }

    return parsed as LocalMatchDetail;
  }

  async upsertDetail(detail: LocalMatchDetail): Promise<void> {
    if (!detail || typeof detail !== 'object' || !detail.match || typeof detail.match !== 'object') {
      throw new Error('Invalid detail: missing match object');
    }
    assertSafeMatchId(detail.match.id);

    const validation = validateLocalMatchDetail(detail);
    if (!validation.ok) {
      throw new Error(`Invalid LocalMatchDetail: ${validation.errors.join(', ')}`);
    }

    const targetPath = resolveContainedPath(this.detailsDir, `${detail.match.id}.json`);
    const existing = await this.getDetail(detail.match.id);

    let detailToPersist = detail;
    if (existing) {
      detailToPersist = mergeDetails(existing, detail);
      const mergedValidation = validateLocalMatchDetail(detailToPersist);
      if (!mergedValidation.ok) {
        throw new Error(`Invalid merged LocalMatchDetail: ${mergedValidation.errors.join(', ')}`);
      }
    }

    await fs.mkdir(this.detailsDir, { recursive: true });

    const safeId = detail.match.id.replace(/[^A-Za-z0-9_-]/g, '_');
    const tempFileName = `.tmp-${safeId}-${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    const tempPath = resolveContainedPath(this.detailsDir, tempFileName);
    const backupPath = resolveContainedPath(this.detailsDir, `.backup-${safeId}.json`);

    const handle = await fs.open(tempPath, 'wx');
    try {
      await handle.writeFile(`${JSON.stringify(detailToPersist, null, 2)}\n`, 'utf8');
      if (this.writeHook) {
        await this.writeHook('before-sync');
      }
      await handle.sync();
    } catch (writeError) {
      await handle.close().catch(() => {});
      await fs.unlink(tempPath).catch(() => {});
      throw writeError;
    }
    await handle.close();

    try {
      if (this.writeHook) {
        await this.writeHook('before-rename');
      }
      await fs.rename(tempPath, targetPath);
    } catch (renameError) {
      const code = (renameError as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EEXIST') {
        await fs.unlink(tempPath).catch(() => {});
        throw renameError;
      }

      await fs.unlink(backupPath).catch(() => {});
      await fs.rename(targetPath, backupPath);
      try {
        await fs.rename(tempPath, targetPath);
      } catch (replacementError) {
        await fs.rename(backupPath, targetPath).catch(() => {});
        await fs.unlink(tempPath).catch(() => {});
        throw replacementError;
      }
      await fs.unlink(backupPath).catch(() => {});
    }
  }

  async hasDetail(matchId: string): Promise<boolean> {
    assertSafeMatchId(matchId);
    const detail = await this.getDetail(matchId);
    return detail !== null;
  }

  async listDetailMatchIds(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.detailsDir, { withFileTypes: true });
      const matchIds: string[] = [];
      for (const entry of entries) {
        if (
          entry.isFile() &&
          entry.name.endsWith('.json') &&
          !entry.name.startsWith('.') &&
          !entry.name.startsWith('.tmp')
        ) {
          const matchId = entry.name.slice(0, -5);
          matchIds.push(matchId);
        }
      }
      return matchIds.sort((a, b) => a.localeCompare(b));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}

function mergeReferee(
  primaryReferee?: string | null,
  fallbackReferee?: string | null
): string | null | undefined {
  if (primaryReferee !== undefined && primaryReferee !== null) {
    return primaryReferee;
  }
  if (fallbackReferee !== undefined && fallbackReferee !== null) {
    return fallbackReferee;
  }
  if (primaryReferee !== undefined) {
    return primaryReferee;
  }
  if (fallbackReferee !== undefined) {
    return fallbackReferee;
  }
  return undefined;
}

export function mergeDetails(existing: LocalMatchDetail, incoming: LocalMatchDetail): LocalMatchDetail {
  const incomingTime = new Date(incoming.updatedAt).getTime();
  const existingTime = new Date(existing.updatedAt).getTime();

  if (incomingTime >= existingTime) {
    // Incoming is newer or equal: use incoming as primary base
    const mergedScoreBreakdown = mergeScoreBreakdown(incoming.scoreBreakdown, existing.scoreBreakdown);
    const mergedTeamStats = mergeTeamStats(incoming.teamStats, existing.teamStats);
    const mergedEvents = mergeEvents(incoming.events, existing.events, incoming.warnings);
    const mergedWarnings = mergeWarnings(existing.warnings, incoming.warnings);
    const mergedNotes = mergeStringArrays(existing.notes, incoming.notes);
    const mergedReferee = mergeReferee(incoming.referee, existing.referee);

    return {
      match: mergeMatches(
        existing.status === 'completed' && incoming.status !== 'completed' ? existing.match : incoming.match,
        existing.status === 'completed' && incoming.status !== 'completed' ? incoming.match : existing.match
      ),
      status: existing.status === 'completed' && incoming.status !== 'completed' ? 'completed' : incoming.status,
      elapsedMinute: incoming.elapsedMinute !== null && incoming.elapsedMinute !== undefined
        ? incoming.elapsedMinute
        : (existing.elapsedMinute ?? null),
      ...(mergedReferee !== undefined ? { referee: mergedReferee } : {}),
      ...(mergedScoreBreakdown !== undefined ? { scoreBreakdown: mergedScoreBreakdown } : {}),
      events: mergedEvents,
      ...(mergedTeamStats !== undefined ? { teamStats: mergedTeamStats } : {}),
      ...(mergedWarnings !== undefined ? { warnings: mergedWarnings } : {}),
      ...(mergedNotes !== undefined ? { notes: mergedNotes } : {}),
      updatedAt: incoming.updatedAt
    };
  } else {
    // Incoming is older: keep existing as base and only merge non-conflicting properties
    const mergedScoreBreakdown = mergeScoreBreakdown(existing.scoreBreakdown, incoming.scoreBreakdown);
    const mergedTeamStats = mergeTeamStats(existing.teamStats, incoming.teamStats);
    const mergedEvents = mergeEvents(existing.events, incoming.events, existing.warnings);
    const mergedWarnings = mergeWarnings(incoming.warnings, existing.warnings);
    const mergedNotes = mergeStringArrays(existing.notes, incoming.notes);
    const mergedReferee = mergeReferee(existing.referee, incoming.referee);

    return {
      match: mergeMatches(existing.match, incoming.match),
      status: existing.status,
      elapsedMinute: existing.elapsedMinute !== null && existing.elapsedMinute !== undefined
        ? existing.elapsedMinute
        : (incoming.elapsedMinute ?? null),
      ...(mergedReferee !== undefined ? { referee: mergedReferee } : {}),
      ...(mergedScoreBreakdown !== undefined ? { scoreBreakdown: mergedScoreBreakdown } : {}),
      events: mergedEvents,
      ...(mergedTeamStats !== undefined ? { teamStats: mergedTeamStats } : {}),
      ...(mergedWarnings !== undefined ? { warnings: mergedWarnings } : {}),
      ...(mergedNotes !== undefined ? { notes: mergedNotes } : {}),
      updatedAt: existing.updatedAt
    };
  }
}

function mergeMatches(primary: LocalMatch, fallback: LocalMatch): LocalMatch {
  return {
    id: primary.id,
    competition: {
      id: primary.competition?.id ?? fallback.competition?.id,
      name: primary.competition?.name ?? fallback.competition?.name,
      type: primary.competition?.type ?? fallback.competition?.type,
      season: primary.competition?.season ?? fallback.competition?.season
    },
    kickoffUtc: primary.kickoffUtc ?? fallback.kickoffUtc,
    status: primary.status ?? fallback.status,
    homeTeam: {
      id: primary.homeTeam?.id ?? fallback.homeTeam?.id,
      name: primary.homeTeam?.name ?? fallback.homeTeam?.name,
      ...(primary.homeTeam?.countryCode !== undefined
        ? { countryCode: primary.homeTeam.countryCode }
        : fallback.homeTeam?.countryCode !== undefined
        ? { countryCode: fallback.homeTeam.countryCode }
        : {})
    },
    awayTeam: {
      id: primary.awayTeam?.id ?? fallback.awayTeam?.id,
      name: primary.awayTeam?.name ?? fallback.awayTeam?.name,
      ...(primary.awayTeam?.countryCode !== undefined
        ? { countryCode: primary.awayTeam.countryCode }
        : fallback.awayTeam?.countryCode !== undefined
        ? { countryCode: fallback.awayTeam.countryCode }
        : {})
    },
    score: {
      home: primary.score?.home !== null && primary.score?.home !== undefined
        ? primary.score.home
        : (fallback.score?.home ?? null),
      away: primary.score?.away !== null && primary.score?.away !== undefined
        ? primary.score.away
        : (fallback.score?.away ?? null)
    },
    ...(primary.venue !== undefined ? { venue: primary.venue } : fallback.venue !== undefined ? { venue: fallback.venue } : {}),
    ...(primary.round !== undefined ? { round: primary.round } : fallback.round !== undefined ? { round: fallback.round } : {}),
    ...(primary.stage !== undefined ? { stage: primary.stage } : fallback.stage !== undefined ? { stage: fallback.stage } : {}),
    ...(primary.neutralVenue !== undefined ? { neutralVenue: primary.neutralVenue } : fallback.neutralVenue !== undefined ? { neutralVenue: fallback.neutralVenue } : {}),
    sourceRefs: dedupeSourceRefs([...(fallback.sourceRefs ?? []), ...(primary.sourceRefs ?? [])]),
    updatedAt: primary.updatedAt >= fallback.updatedAt ? primary.updatedAt : fallback.updatedAt
  };
}

function mergeScoreBreakdown(
  primary?: LocalScoreBreakdown,
  fallback?: LocalScoreBreakdown
): LocalScoreBreakdown | undefined {
  if (!primary && !fallback) return undefined;
  if (!primary) return fallback;
  if (!fallback) return primary;

  const periods = ['halftime', 'fulltime', 'extratime', 'penalty'] as const;
  const result = {} as LocalScoreBreakdown;
  for (const period of periods) {
    const pScore = primary[period];
    const fScore = fallback[period];
    result[period] = {
      home: pScore?.home !== null && pScore?.home !== undefined ? pScore.home : (fScore?.home ?? null),
      away: pScore?.away !== null && pScore?.away !== undefined ? pScore.away : (fScore?.away ?? null)
    };
  }
  return result;
}

function mergeTeamStats(
  primary?: LocalMatchTeamStats[],
  fallback?: LocalMatchTeamStats[]
): LocalMatchTeamStats[] | undefined {
  if (!primary && !fallback) return undefined;
  if (!primary) return fallback;
  if (!fallback) return primary;

  const fallbackByTeamId = new Map(fallback.map((s) => [s.teamId, s]));
  const result: LocalMatchTeamStats[] = [];

  for (const pStat of primary) {
    const fStat = fallbackByTeamId.get(pStat.teamId);
    if (!fStat) {
      result.push(pStat);
      continue;
    }
    result.push({
      teamId: pStat.teamId,
      ...(pStat.teamName !== undefined
        ? { teamName: pStat.teamName }
        : fStat.teamName !== undefined
        ? { teamName: fStat.teamName }
        : {}),
      cornerKicks: pStat.cornerKicks !== null && pStat.cornerKicks !== undefined
        ? pStat.cornerKicks
        : (fStat.cornerKicks ?? null),
      yellowCards: pStat.yellowCards !== null && pStat.yellowCards !== undefined
        ? pStat.yellowCards
        : (fStat.yellowCards ?? null),
      redCards: pStat.redCards !== null && pStat.redCards !== undefined
        ? pStat.redCards
        : (fStat.redCards ?? null),
      totalShots: pStat.totalShots !== null && pStat.totalShots !== undefined
        ? pStat.totalShots
        : (fStat.totalShots ?? null),
      shotsOnGoal: pStat.shotsOnGoal !== null && pStat.shotsOnGoal !== undefined
        ? pStat.shotsOnGoal
        : (fStat.shotsOnGoal ?? null),
      possessionPercentage: pStat.possessionPercentage !== null && pStat.possessionPercentage !== undefined
        ? pStat.possessionPercentage
        : (fStat.possessionPercentage ?? null)
    });
    fallbackByTeamId.delete(pStat.teamId);
  }

  for (const remaining of fallbackByTeamId.values()) {
    result.push(remaining);
  }

  return result;
}

function mergeEvents(
  primary: LocalMatchEvent[],
  fallback: LocalMatchEvent[],
  primaryWarnings?: string[]
): LocalMatchEvent[] {
  const incomplete = primaryWarnings?.includes('events_partial') ||
    primaryWarnings?.includes('events_unavailable');
  if (!incomplete && (primaryWarnings !== undefined || primary.length > 0)) return primary;
  const merged = new Map<string, LocalMatchEvent>();
  for (const event of [...fallback, ...primary]) {
    const key = JSON.stringify([
      event.minute,
      event.extraMinute ?? null,
      event.teamId ?? null,
      event.type,
      event.player ?? null,
      event.assist ?? null
    ]);
    merged.set(key, event);
  }
  return [...merged.values()];
}

function mergeWarnings(fallback?: string[], primary?: string[]): string[] | undefined {
  if (primary === undefined) return mergeStringArrays(fallback, undefined);
  const fallbackWithoutStaleCoverage = fallback?.filter((warning) => (
    !warning.startsWith('events_') && !warning.startsWith('statistics_')
  ));
  return mergeStringArrays(fallbackWithoutStaleCoverage, primary);
}

function mergeStringArrays(a?: string[], b?: string[]): string[] | undefined {
  if (!a && !b) return undefined;
  const set = new Set<string>();
  if (a) {
    for (const item of a) {
      if (typeof item === 'string' && item.trim() !== '') set.add(item);
    }
  }
  if (b) {
    for (const item of b) {
      if (typeof item === 'string' && item.trim() !== '') set.add(item);
    }
  }
  return set.size > 0 ? Array.from(set) : (a !== undefined || b !== undefined ? [] : undefined);
}

function dedupeSourceRefs(sourceRefs: LocalMatchSourceRef[]): LocalMatchSourceRef[] {
  const byKey = new Map<string, LocalMatchSourceRef>();
  for (const sourceRef of sourceRefs) {
    const key = [
      sourceRef.sourceId,
      sourceRef.sourceMatchId ?? '',
      sourceRef.sourceUrl ?? ''
    ].join('|');
    const existing = byKey.get(key);
    if (!existing || sourceRef.importedAt.localeCompare(existing.importedAt) > 0) {
      byKey.set(key, sourceRef);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const sourceCompare = a.sourceId.localeCompare(b.sourceId);
    if (sourceCompare !== 0) return sourceCompare;
    return (a.sourceMatchId ?? '').localeCompare(b.sourceMatchId ?? '');
  });
}
