import { readFile, open, mkdir, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  type ApiFootballCompetitionEntry,
  getHydrationSeasonsForCompetition
} from '@miraichi/config';

export type HydrationStatus = 'completed' | 'in_progress' | 'failed' | 'empty' | 'pending';

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

export interface HydrationCompletion {
  competitionId: string;
  leagueId: number;
  season: number;
  matchCount: number;
}

export function parseHydrationStateFile(content: string): HydrationStateFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`hydration_checkpoint_corrupt: Malformed JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('hydration_checkpoint_corrupt: State must be an object');
  }
  const recObj = parsed as Record<string, unknown>;
  if (recObj.schemaVersion !== 'miraichi.hydration.v1') {
    throw new Error(`hydration_checkpoint_corrupt: Invalid schemaVersion ${String(recObj.schemaVersion)}`);
  }
  if (typeof recObj.updatedAt !== 'string' || Number.isNaN(Date.parse(recObj.updatedAt))) {
    throw new Error('hydration_checkpoint_corrupt: Invalid updatedAt');
  }
  if (!recObj.records || typeof recObj.records !== 'object' || Array.isArray(recObj.records)) {
    throw new Error('hydration_checkpoint_corrupt: Invalid records map');
  }
  const records = recObj.records as Record<string, unknown>;
  for (const [key, val] of Object.entries(records)) {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} is not an object`);
    }
    const r = val as Record<string, unknown>;
    if (typeof r.competitionId !== 'string' || r.competitionId.trim() === '') {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} missing valid competitionId`);
    }
    if (typeof r.leagueId !== 'number' || !Number.isInteger(r.leagueId) || r.leagueId <= 0) {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} missing valid leagueId`);
    }
    if (typeof r.season !== 'number' || !Number.isInteger(r.season) || r.season <= 0) {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} missing valid season`);
    }
    if (typeof r.status !== 'string' || !['completed', 'in_progress', 'failed', 'empty', 'pending'].includes(r.status)) {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} has invalid status ${String(r.status)}`);
    }
    if (typeof r.matchCount !== 'number' || !Number.isInteger(r.matchCount) || r.matchCount < 0) {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} has invalid matchCount`);
    }
    if (key !== `${r.leagueId}:${r.season}`) {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} does not match leagueId/season identity`);
    }
    if (r.lastHydratedAt !== undefined && (typeof r.lastHydratedAt !== 'string' || Number.isNaN(Date.parse(r.lastHydratedAt)))) {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} has invalid lastHydratedAt`);
    }
    if (r.error !== undefined && typeof r.error !== 'string') {
      throw new Error(`hydration_checkpoint_corrupt: Record ${key} has invalid error`);
    }
  }
  return parsed as HydrationStateFile;
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
    let data: string;
    try {
      data = await readFile(this.storagePath, 'utf8');
    } catch (error) {
      const err = error as { code?: string };
      if (err.code === 'ENOENT') {
        const backupPath = `${this.storagePath}.backup`;
        try {
          data = await readFile(backupPath, 'utf8');
          const recovered = parseHydrationStateFile(data);
          await rename(backupPath, this.storagePath);
          this.records = new Map(Object.entries(recovered.records));
          return;
        } catch (backupError) {
          if ((backupError as NodeJS.ErrnoException).code === 'ENOENT') {
            this.records.clear();
            return;
          }
          throw backupError;
        }
      }
      throw error;
    }

    const parsed = parseHydrationStateFile(data);
    this.records = new Map(Object.entries(parsed.records));
  }

  public async save(): Promise<void> {
    await this.persistRecords(this.records);
  }

  private async persistRecords(records: ReadonlyMap<string, HydrationRecord>): Promise<void> {
    if (!this.storagePath) return;
    const dir = dirname(this.storagePath);
    await mkdir(dir, { recursive: true });
    const payload: HydrationStateFile = {
      schemaVersion: 'miraichi.hydration.v1',
      updatedAt: new Date().toISOString(),
      records: Object.fromEntries(records.entries())
    };
    const tempPath = `${this.storagePath}.tmp.${Date.now()}.${randomUUID()}`;
    const backupPath = `${this.storagePath}.backup`;
    const serialized = `${JSON.stringify(payload, null, 2)}\n`;
    const handle = await open(tempPath, 'wx');
    try {
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(tempPath, this.storagePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EPERM' && code !== 'EEXIST') {
        await unlink(tempPath).catch(() => {});
        throw error;
      }
      await unlink(backupPath).catch(() => {});
      await rename(this.storagePath, backupPath);
      try {
        await rename(tempPath, this.storagePath);
      } catch (replacementError) {
        await rename(backupPath, this.storagePath).catch(() => {});
        await unlink(tempPath).catch(() => {});
        throw replacementError;
      }
      await unlink(backupPath).catch(() => {});
    }
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
    await this.markCompletedBatch([{ competitionId, leagueId, season, matchCount }], now);
  }

  public async markCompletedBatch(
    completions: readonly HydrationCompletion[],
    now: Date = new Date()
  ): Promise<void> {
    const nextRecords = new Map(this.records);
    for (const completion of completions) {
      nextRecords.set(this.keyFor(completion.leagueId, completion.season), {
        ...completion,
        status: 'completed',
        lastHydratedAt: now.toISOString()
      });
    }
    await this.persistRecords(nextRecords);
    this.records = nextRecords;
  }

  public async markEmpty(
    competitionId: string,
    leagueId: number,
    season: number,
    now: Date = new Date()
  ): Promise<void> {
    const nextRecords = new Map(this.records);
    nextRecords.set(this.keyFor(leagueId, season), {
      competitionId,
      leagueId,
      season,
      status: 'empty',
      matchCount: 0,
      lastHydratedAt: now.toISOString()
    });
    await this.persistRecords(nextRecords);
    this.records = nextRecords;
  }

  public async markFailed(
    competitionId: string,
    leagueId: number,
    season: number,
    error: string,
    now: Date = new Date()
  ): Promise<void> {
    const nextRecords = new Map(this.records);
    nextRecords.set(this.keyFor(leagueId, season), {
      competitionId,
      leagueId,
      season,
      status: 'failed',
      matchCount: 0,
      lastHydratedAt: now.toISOString(),
      error
    });
    await this.persistRecords(nextRecords);
    this.records = nextRecords;
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
