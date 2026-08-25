import { describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiFootballJobLease,
  withApiFootballJobLease
} from './api-football-job-lease.js';

describe('ApiFootballJobLease', () => {
  it('acquires and releases publication lock for a single operation', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-lease-test-'));
    try {
      const lease = new ApiFootballJobLease({ dataRoot: tempDir });
      let executed = false;

      const result = await lease.withLease(async () => {
        executed = true;
        return 'success';
      });

      expect(result).toBe('success');
      expect(executed).toBe(true);

      // Lock file should be cleaned up after release
      const lockPath = join(tempDir, 'api-football', 'publication.lock');
      await expect(readFile(lockPath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not steal a live owner lease after the stale timeout', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-lease-test-'));
    try {
      const lease1 = new ApiFootballJobLease({ dataRoot: tempDir, staleTimeoutMs: 20, retryDelayMs: 5 });
      const lease2 = new ApiFootballJobLease({ dataRoot: tempDir, staleTimeoutMs: 20, retryDelayMs: 5 });

      const events: string[] = [];
      let signalFirstStarted: (() => void) | undefined;
      const firstStarted = new Promise<void>((resolve) => { signalFirstStarted = resolve; });
      let releaseFirst: (() => void) | undefined;
      const holdFirst = new Promise<void>((resolve) => { releaseFirst = resolve; });

      const p1 = lease1.withLease(async () => {
        events.push('start:p1');
        signalFirstStarted?.();
        await holdFirst;
        events.push('end:p1');
      });

      await firstStarted;

      const p2 = lease2.withLease(async () => {
        events.push('start:p2');
        events.push('end:p2');
      });

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(events).toEqual(['start:p1']);
      releaseFirst?.();
      await Promise.all([p1, p2]);

      expect(events).toEqual([
        'start:p1',
        'end:p1',
        'start:p2',
        'end:p2'
      ]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('recovers from stale lock whose owner process is dead', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-lease-test-'));
    const lockDir = join(tempDir, 'api-football');
    const lockPath = join(lockDir, 'publication.lock');

    try {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(lockDir, { recursive: true });

      // Simulate a stale lock from dead PID with an old timestamp
      const staleLock = {
        pid: 99999999, // non-existent PID
        createdAt: '2026-08-01T00:00:00.000Z',
        createdAtMs: Date.now() - 60_000,
        id: 'stale-lock-id'
      };
      await writeFile(lockPath, JSON.stringify(staleLock), 'utf8');

      const lease = new ApiFootballJobLease({
        dataRoot: tempDir,
        staleTimeoutMs: 1000
      });

      const res = await lease.withLease(async () => 'recovered');
      expect(res).toBe('recovered');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('helper withApiFootballJobLease executes seamlessly', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-lease-test-'));
    try {
      const result = await withApiFootballJobLease(tempDir, async () => 42);
      expect(result).toBe(42);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
