import * as fs from 'fs/promises';
import * as path from 'path';
import {
  LocalMatch,
  LocalMatchSnapshotQuery,
  LocalMatchFeedResponse,
  LocalDataSnapshotStatus,
  LocalMatchStatus,
  validateLocalMatch,
  LocalMatchSourceRef
} from '@miraichi/shared';

export interface LocalMatchSnapshot {
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  sources: LocalMatchSourceRef[];
  matches: LocalMatch[];
}

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

export class LocalMatchSnapshotRepository {
  private snapshotPath: string;
  private nowFn: () => Date;

  constructor(options?: { snapshotPath?: string; now?: () => Date }) {
    const rootDir = process.cwd().includes('apps/api')
      ? path.resolve(process.cwd(), '../..')
      : process.cwd();
    this.snapshotPath = options?.snapshotPath ||
      process.env.LOCAL_MATCH_SNAPSHOT_PATH ||
      path.resolve(rootDir, 'apps/api/data/local-match-snapshots/national-team-matches.json');
    this.nowFn = options?.now || (() => new Date());
  }

  async loadSnapshot(): Promise<LocalMatchSnapshot> {
    try {
      const data = await fs.readFile(this.snapshotPath, 'utf-8');
      const parsed = JSON.parse(data);

      if (!parsed || typeof parsed !== 'object') {
        const error = new Error('Snapshot is not a valid JSON object');
        const errWithCode = error as unknown as { code: string; statusCode: number };
        errWithCode.code = 'local_snapshot_invalid';
        errWithCode.statusCode = 500;
        throw error;
      }

      if (!Array.isArray(parsed.matches)) {
        const error = new Error('Snapshot matches is not an array');
        const errWithCode = error as unknown as { code: string; statusCode: number };
        errWithCode.code = 'local_snapshot_invalid';
        errWithCode.statusCode = 500;
        throw error;
      }

      for (let i = 0; i < parsed.matches.length; i++) {
        const match = parsed.matches[i];
        const res = validateLocalMatch(match);
        if (!res.ok) {
          const error = new Error(`Invalid match at index ${i}: ${res.errors.join(', ')}`);
          const errWithCode = error as unknown as { code: string; statusCode: number };
          errWithCode.code = 'local_snapshot_invalid';
          errWithCode.statusCode = 500;
          throw error;
        }
      }

      return parsed as LocalMatchSnapshot;
    } catch (err) {
      const errorWithCode = err as { code?: string; message?: string };
      if (errorWithCode.code === 'ENOENT') {
        const error = new Error(`Local snapshot file not found at ${this.snapshotPath}`);
        const errWithCode = error as unknown as { code: string; statusCode: number };
        errWithCode.code = 'local_snapshot_missing';
        errWithCode.statusCode = 503;
        throw error;
      }
      if (errorWithCode.code === 'local_snapshot_invalid') {
        throw err;
      }
      const error = new Error(`Malformed snapshot: ${errorWithCode.message}`);
      const errWithCode = error as unknown as { code: string; statusCode: number };
      errWithCode.code = 'local_snapshot_invalid';
      errWithCode.statusCode = 500;
      throw error;
    }
  }

  async listMatches(query?: LocalMatchSnapshotQuery): Promise<LocalMatchFeedResponse> {
    const snapshot = await this.loadSnapshot();
    let matches = [...snapshot.matches];

    if (query?.date) {
      const queryDateStr = query.date;
      matches = matches.filter(m => m.kickoffUtc.startsWith(queryDateStr));
    }

    if (query?.competitionId) {
      matches = matches.filter(m => m.competition.id === query.competitionId);
    }

    if (query?.status) {
      matches = matches.filter(m => m.status === query.status);
    }

    matches.sort(compareMatches);

    const status = await this.getStatusFromSnapshot(snapshot);

    return {
      matches,
      snapshot: status
    };
  }

  async findById(id: string): Promise<LocalMatch | null> {
    const snapshot = await this.loadSnapshot();
    return snapshot.matches.find(m => m.id === id) || null;
  }

  async getStatus(): Promise<LocalDataSnapshotStatus> {
    try {
      const snapshot = await this.loadSnapshot();
      return this.getStatusFromSnapshot(snapshot);
    } catch (err) {
      const errorWithCode = err as { code?: string };
      if (errorWithCode.code === 'local_snapshot_missing') {
        return {
          snapshotId: '',
          generatedAt: '',
          importedAt: '',
          matchCount: 0,
          competitions: [],
          sources: [],
          freshness: 'missing',
          warnings: ['Local snapshot file is missing']
        };
      }
      throw err;
    }
  }

  private getStatusFromSnapshot(snapshot: LocalMatchSnapshot): LocalDataSnapshotStatus {
    const competitionsMap = new Map<string, { name: string; seasons: Set<string>; count: number }>();
    snapshot.matches.forEach(m => {
      const compId = m.competition.id;
      const compName = m.competition.name;
      const season = m.competition.season;

      let info = competitionsMap.get(compId);
      if (!info) {
        info = { name: compName, seasons: new Set<string>(), count: 0 };
        competitionsMap.set(compId, info);
      }
      info.seasons.add(season);
      info.count++;
    });

    const competitions = Array.from(competitionsMap.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      seasons: Array.from(info.seasons),
      matchCount: info.count
    }));

    const nowTime = this.nowFn().getTime();
    const genTime = new Date(snapshot.generatedAt).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const freshness = (nowTime - genTime) <= sevenDaysMs ? 'fresh' : 'stale';

    return {
      snapshotId: snapshot.snapshotId,
      generatedAt: snapshot.generatedAt,
      importedAt: snapshot.importedAt,
      matchCount: snapshot.matches.length,
      competitions,
      sources: snapshot.sources,
      freshness,
      warnings: []
    };
  }
}
