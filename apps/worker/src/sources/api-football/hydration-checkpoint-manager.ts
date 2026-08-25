import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  type ApiFootballCompetitionEntry,
  getHydrationSeasonsForCompetition
} from '@miraichi/config';

export type HydrationStatus = 'completed' | 'in_progress' | 'failed' | 'pending';

export interface HydrationRecord {
  competitionId: string;
  leagueId: number;
  season: number;
  status: HydrationStatus;
  matchCount: number;
  lastHydratedAt?: string;
  error?: string;
}

export interface HydrationStateFile {
  schemaVersion: 'miraichi.hydration.v1';
  updatedAt: string;
  records: Record<string, HydrationRecord>;
}

export interface HydrationTarget {
  entry: ApiFootballCompetitionEntry;
  season: number;
}

export class HydrationCheckpointManager {
  private records: Map<string, HydrationRecord> = new Map();
  private readonly storagePath?: string | undefined;

  constructor(options?: { storagePath?: string | undefined; initialRecords?: HydrationRecord[] }) {
    this.storagePath = options?.storagePath;
    if (options?.initialRecords) {
      for (const rec of options.initialRecords) {
        this.records.set(this.keyFor(rec.leagueId, rec.season), { ...rec });
      }
    }
  }

  private keyFor(leagueId: number, season: number): string {
    return `${leagueId}:${season}`;
  }

  public async load(): Promise<void> {
    if (!this.storagePath) return;
    try {
      const data = await readFile(this.storagePath, 'utf8');
      const parsed = JSON.parse(data) as HydrationStateFile;
      if (parsed && typeof parsed.records === 'object') {
        this.records.clear();
        for (const [key, val] of Object.entries(parsed.records)) {
          this.records.set(key, val);
        }
      }
    } catch {
      // File doesn't exist yet or is empty; start fresh
    }
  }

  public async save(): Promise<void> {
    if (!this.storagePath) return;
    const payload: HydrationStateFile = {
      schemaVersion: 'miraichi.hydration.v1',
      updatedAt: new Date().toISOString(),
      records: Object.fromEntries(this.records.entries())
    };
    await mkdir(dirname(this.storagePath), { recursive: true });
    await writeFile(this.storagePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  public isHydrated(leagueId: number, season: number): boolean {
    const rec = this.records.get(this.keyFor(leagueId, season));
    return rec !== undefined && rec.status === 'completed';
  }

  public getRecord(leagueId: number, season: number): HydrationRecord | undefined {
    return this.records.get(this.keyFor(leagueId, season));
  }

  public async markCompleted(
    competitionId: string,
    leagueId: number,
    season: number,
    matchCount: number,
    now: Date = new Date()
  ): Promise<void> {
    this.records.set(this.keyFor(leagueId, season), {
      competitionId,
      leagueId,
      season,
      status: 'completed',
      matchCount,
      lastHydratedAt: now.toISOString()
    });
    await this.save();
  }

  public async markFailed(
    competitionId: string,
    leagueId: number,
    season: number,
    error: string,
    now: Date = new Date()
  ): Promise<void> {
    this.records.set(this.keyFor(leagueId, season), {
      competitionId,
      leagueId,
      season,
      status: 'failed',
      matchCount: 0,
      lastHydratedAt: now.toISOString(),
      error
    });
    await this.save();
  }

  public getPendingHydrations(registry: readonly ApiFootballCompetitionEntry[]): HydrationTarget[] {
    const targets: HydrationTarget[] = [];
    for (const entry of registry) {
      if (!entry.enabled) continue;
      const seasons = getHydrationSeasonsForCompetition(entry);
      for (const season of seasons) {
        if (!this.isHydrated(entry.providerLeagueId, season)) {
          targets.push({ entry, season });
        }
      }
    }
    return targets;
  }

  public getProgress(registry: readonly ApiFootballCompetitionEntry[]): {
    totalRequired: number;
    completed: number;
    pending: number;
    failed: number;
  } {
    let totalRequired = 0;
    let completed = 0;
    let failed = 0;

    for (const entry of registry) {
      if (!entry.enabled) continue;
      const seasons = getHydrationSeasonsForCompetition(entry);
      for (const season of seasons) {
        totalRequired += 1;
        const rec = this.records.get(this.keyFor(entry.providerLeagueId, season));
        if (rec?.status === 'completed') {
          completed += 1;
        } else if (rec?.status === 'failed') {
          failed += 1;
        }
      }
    }

    return {
      totalRequired,
      completed,
      pending: totalRequired - completed,
      failed
    };
  }
}
