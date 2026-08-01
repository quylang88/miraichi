import * as path from 'path';
import type {
  LocalDataSnapshotStatus,
  LocalMatch,
  LocalMatchFeedResponse,
  LocalMatchSnapshotQuery
} from '@miraichi/shared';
import type { MatchSnapshotRepository } from './match-snapshot-repository.js';
import {
  readServingMatchStoreSnapshot,
  type LocalMatchSnapshot
} from './serving-match-store.js';
import { classifyMatchSnapshotFreshness } from '../match-snapshot-freshness.js';

export { MATCH_SNAPSHOT_STALE_AFTER_MS } from '../match-snapshot-freshness.js';

function compareMatches(a: LocalMatch, b: LocalMatch): number {
  const aCompleted = a.status === 'completed';
  const bCompleted = b.status === 'completed';

  if (!aCompleted && bCompleted) {
    return -1;
  }
  if (aCompleted && !bCompleted) {
    return 1;
  }

  if (!aCompleted && !bCompleted) {
    return new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime();
  }

  return new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime();
}

export class ServingMatchStoreRepository implements MatchSnapshotRepository {
  private readonly servingRoot: string;
  private readonly nowFn: () => Date;

  constructor(options: { servingRoot?: string; now?: () => Date } = {}) {
    const rootDir = process.cwd().includes('apps/api')
      ? path.resolve(process.cwd(), '../..')
      : process.cwd();
    this.servingRoot = options.servingRoot ||
      process.env.LOCAL_MATCH_SERVING_ROOT ||
      path.resolve(rootDir, 'apps/api/data/serving');
    this.nowFn = options.now || (() => new Date());
  }

  async loadSnapshot(): Promise<LocalMatchSnapshot> {
    return readServingMatchStoreSnapshot(this.servingRoot);
  }

  async listMatches(query?: LocalMatchSnapshotQuery): Promise<LocalMatchFeedResponse> {
    const snapshot = await this.loadSnapshot();
    let matches = [...snapshot.matches];

    if (query?.date) {
      matches = matches.filter((match) => match.kickoffUtc.startsWith(query.date!));
    }

    if (query?.competitionId) {
      matches = matches.filter((match) => match.competition.id === query.competitionId);
    }

    if (query?.status) {
      matches = matches.filter((match) => match.status === query.status);
    }

    matches.sort(compareMatches);

    return {
      matches,
      snapshot: this.getStatusFromSnapshot(snapshot)
    };
  }

  async findById(id: string): Promise<LocalMatch | null> {
    const snapshot = await this.loadSnapshot();
    return snapshot.matches.find((match) => match.id === id) ?? null;
  }

  async getStatus(): Promise<LocalDataSnapshotStatus> {
    try {
      const snapshot = await this.loadSnapshot();
      return this.getStatusFromSnapshot(snapshot);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'serving_match_store_missing') {
        const now = this.nowFn().toISOString();
        return {
          snapshotId: 'missing-serving-match-store',
          generatedAt: now,
          importedAt: now,
          matchCount: 0,
          competitions: [],
          sources: [],
          freshness: 'missing',
          warnings: ['Serving match store is missing']
        };
      }
      throw error;
    }
  }

  private getStatusFromSnapshot(snapshot: LocalMatchSnapshot): LocalDataSnapshotStatus {
    const competitionsMap = new Map<string, { name: string; seasons: Set<string>; count: number }>();
    snapshot.matches.forEach((match) => {
      const competitionId = match.competition.id;
      const info = competitionsMap.get(competitionId) ?? {
        name: match.competition.name,
        seasons: new Set<string>(),
        count: 0
      };
      info.seasons.add(match.competition.season);
      info.count += 1;
      competitionsMap.set(competitionId, info);
    });

    const competitions = Array.from(competitionsMap.entries())
      .map(([id, info]) => ({
        id,
        name: info.name,
        seasons: Array.from(info.seasons).sort(),
        matchCount: info.count
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      snapshotId: snapshot.snapshotId,
      generatedAt: snapshot.generatedAt,
      importedAt: snapshot.importedAt,
      matchCount: snapshot.matches.length,
      competitions,
      sources: snapshot.sources,
      freshness: classifyMatchSnapshotFreshness(snapshot.generatedAt, this.nowFn()),
      warnings: []
    };
  }
}
