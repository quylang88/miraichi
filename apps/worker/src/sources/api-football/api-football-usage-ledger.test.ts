import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiFootballUsageLedger,
  API_FOOTBALL_USAGE_SCHEMA_VERSION,
  ApiFootballQuotaExceededError
} from './api-football-usage-ledger.js';

describe('ApiFootballUsageLedger', () => {
  it('requires an explicit storagePath or dataRoot', () => {
    expect(() => new ApiFootballUsageLedger()).toThrow('api_football_ledger_path_missing');
  });

  it('initializes default state with schemaVersion miraichi.api-football-usage.v1', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-test-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      const now = new Date('2026-08-25T12:00:00.000Z');
      const ledger = new ApiFootballUsageLedger({
        storagePath,
        now: () => now
      });

      const state = await ledger.getState();
      expect(state.schemaVersion).toBe(API_FOOTBALL_USAGE_SCHEMA_VERSION);
      expect(state.dayKey).toBe('2026-08-25');
      expect(state.dailyUsage.reserved).toBe(0);
      expect(state.dailyUsage.confirmed).toBe(0);
      expect(state.dailyUsage.limit).toBe(85);
      expect(state.rollingRequests).toEqual([]);
      expect(state.lastReportedHeader.limit).toBeNull();
      expect(state.lastReportedHeader.remaining).toBeNull();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('persists reservations to disk and shares state across separate instances', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-persist-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      const now = new Date('2026-08-25T12:00:00.000Z');
      const instance1 = new ApiFootballUsageLedger({
        storagePath,
        hardCeiling: 3,
        now: () => now
      });

      await instance1.reserveSlot();
      await instance1.reserveSlot();

      // Separate instance reading the same file
      const instance2 = new ApiFootballUsageLedger({
        storagePath,
        hardCeiling: 3,
        now: () => now
      });

      const state = await instance2.getState();
      expect(state.dailyUsage.reserved).toBe(2);

      // Third reservation hits ceiling of 3
      await instance2.reserveSlot();
      expect((await instance2.getState()).dailyUsage.reserved).toBe(3);

      // Fourth reservation from instance1 must fail with ApiFootballQuotaExceededError
      await expect(instance1.reserveSlot()).rejects.toThrow(ApiFootballQuotaExceededError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('reconciles response headers upward and never downward below known consumption', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-reconcile-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      const now = new Date('2026-08-25T12:00:00.000Z');
      const ledger = new ApiFootballUsageLedger({
        storagePath,
        now: () => now
      });

      // Reserve 2 slots
      await ledger.reserveSlot();
      await ledger.reserveSlot();

      // Provider headers report 10 used (limit 100, remaining 90)
      const headers = {
        'x-ratelimit-requests-limit': '100',
        'x-ratelimit-requests-remaining': '90',
        'x-ratelimit-requests-reset': '3600'
      };

      const reconciledState = await ledger.reconcileHeaders(headers);
      expect(reconciledState.dailyUsage.confirmed).toBe(10);
      expect(reconciledState.dailyUsage.reserved).toBe(10);
      expect(reconciledState.lastReportedHeader.limit).toBe(100);
      expect(reconciledState.lastReportedHeader.remaining).toBe(90);
      expect(reconciledState.lastReportedHeader.resetsInSeconds).toBe(3600);
      expect(reconciledState.lastReportedHeader.observedAt).toBe('2026-08-25T12:00:00.000Z');

      // Subsequent response headers report stale / lower value (e.g. 5 used: limit 100, remaining 95)
      const staleHeaders = {
        'x-ratelimit-requests-limit': '100',
        'x-ratelimit-requests-remaining': '95'
      };

      const stateAfterStale = await ledger.reconcileHeaders(staleHeaders);
      // Must not decrease below 10!
      expect(stateAfterStale.dailyUsage.confirmed).toBe(10);
      expect(stateAfterStale.dailyUsage.reserved).toBe(10);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('paces rolling 10 requests per 60 seconds with injected sleep', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-rate-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      let currentTimeMs = Date.parse('2026-08-25T12:00:00.000Z');
      const nowFn = () => new Date(currentTimeMs);
      const sleepFn = vi.fn().mockImplementation(async (ms: number) => {
        currentTimeMs += ms;
      });

      const ledger = new ApiFootballUsageLedger({
        storagePath,
        now: nowFn,
        sleepFn,
        maxRequestsPerMinute: 10,
        rollingWindowMs: 60_000
      });

      // 10 immediate requests
      for (let i = 0; i < 10; i++) {
        await ledger.reserveSlot();
      }

      expect(sleepFn).not.toHaveBeenCalled();
      const state10 = await ledger.getState();
      expect(state10.rollingRequests).toHaveLength(10);

      // 11th request must wait
      await ledger.reserveSlot();

      expect(sleepFn).toHaveBeenCalledTimes(1);
      // Wait time should be at least 60000ms
      expect(sleepFn.mock.calls[0][0]).toBeGreaterThanOrEqual(60_000);
      const state11 = await ledger.getState();
      expect(state11.dailyUsage.reserved).toBe(11);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('rotates usage when UTC day changes', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-rotation-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      let currentTime = new Date('2026-08-25T23:59:50.000Z');
      const ledger = new ApiFootballUsageLedger({
        storagePath,
        hardCeiling: 2,
        now: () => currentTime
      });

      await ledger.reserveSlot();
      await ledger.reserveSlot();
      expect((await ledger.getState()).dailyUsage.reserved).toBe(2);

      // Next day starts
      currentTime = new Date('2026-08-26T00:00:05.000Z');
      const state = await ledger.reserveSlot();
      expect(state.dayKey).toBe('2026-08-26');
      expect(state.dailyUsage.reserved).toBe(1);
      expect(state.dailyUsage.confirmed).toBe(0);
      expect(state.rollingRequests).toHaveLength(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('supports emergency ceiling up to 100', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-emergency-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      const now = new Date('2026-08-25T12:00:00.000Z');
      const ledger = new ApiFootballUsageLedger({
        storagePath,
        hardCeiling: 2,
        totalLimit: 4,
        now: () => now
      });

      await ledger.reserveSlot();
      await ledger.reserveSlot();

      // Normal ceiling reached
      await expect(ledger.reserveSlot()).rejects.toThrow(ApiFootballQuotaExceededError);

      // Emergency slot succeeds
      const state3 = await ledger.reserveSlot({ emergency: true });
      expect(state3.dailyUsage.reserved).toBe(3);

      const state4 = await ledger.reserveSlot({ emergency: true });
      expect(state4.dailyUsage.reserved).toBe(4);

      // Emergency limit (4) reached
      await expect(ledger.reserveSlot({ emergency: true })).rejects.toThrow(ApiFootballQuotaExceededError);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('handles stale locks automatically', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-stale-lock-'));
    const storagePath = join(tempDir, 'usage-ledger.json');
    const lockPath = `${storagePath}.lock`;

    try {
      const currentTimeMs = Date.now();
      const now = () => new Date('2026-08-25T12:00:00.000Z');

      // Create a stale lock file created 20 seconds ago
      const staleLockInfo = JSON.stringify({
        pid: 999999,
        createdAt: new Date(currentTimeMs - 20_000).toISOString(),
        createdAtMs: currentTimeMs - 20_000
      });
      await writeFile(lockPath, staleLockInfo, 'utf8');

      const ledger = new ApiFootballUsageLedger({
        storagePath,
        staleLockTimeoutMs: 10_000,
        now
      });

      // Should detect stale lock, clean it up, and succeed
      const state = await ledger.reserveSlot();
      expect(state.dailyUsage.reserved).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('fails closed instead of resetting quota when the ledger is corrupt', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-corrupt-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      await writeFile(storagePath, '{not-json', 'utf8');
      const ledger = new ApiFootballUsageLedger({ storagePath });

      await expect(ledger.getState()).rejects.toThrow('api_football_usage_ledger_invalid');
      await expect(ledger.reserveSlot()).rejects.toThrow('api_football_usage_ledger_invalid');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not remove a lock that has been replaced by another owner', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-lock-owner-'));
    const storagePath = join(tempDir, 'usage-ledger.json');
    const lockPath = `${storagePath}.lock`;

    try {
      const ledger = new ApiFootballUsageLedger({ storagePath });
      const release = await (ledger as unknown as {
        acquireLock: () => Promise<() => Promise<void>>;
      }).acquireLock();
      const replacementLock = JSON.stringify({ id: 'new-owner', createdAtMs: Date.now() });
      await writeFile(lockPath, replacementLock, 'utf8');

      await release();

      expect(await readFile(lockPath, 'utf8')).toBe(replacementLock);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('does not steal a live ledger lock after the stale timeout', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-live-owner-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      const ledger1 = new ApiFootballUsageLedger({
        storagePath,
        staleLockTimeoutMs: 20,
        lockRetryDelayMs: 5
      });
      const ledger2 = new ApiFootballUsageLedger({
        storagePath,
        staleLockTimeoutMs: 20,
        lockRetryDelayMs: 5
      });
      let releaseFirst: (() => void) | undefined;
      const holdFirst = new Promise<void>((resolve) => { releaseFirst = resolve; });
      let signalFirstStarted: (() => void) | undefined;
      const firstStarted = new Promise<void>((resolve) => { signalFirstStarted = resolve; });

      const first = ledger1.withLock(async () => {
        signalFirstStarted?.();
        await holdFirst;
      });
      await firstStarted;

      let secondEntered = false;
      const second = ledger2.withLock(async () => {
        secondEntered = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(secondEntered).toBe(false);

      releaseFirst?.();
      await Promise.all([first, second]);
      expect(secondEntered).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('locks concurrently so multiple reservations do not overwrite each other', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ledger-concurrency-'));
    const storagePath = join(tempDir, 'usage-ledger.json');

    try {
      const now = new Date('2026-08-25T12:00:00.000Z');
      const ledger1 = new ApiFootballUsageLedger({ storagePath, now: () => now });
      const ledger2 = new ApiFootballUsageLedger({ storagePath, now: () => now });

      await Promise.all([
        ledger1.reserveSlot(),
        ledger2.reserveSlot(),
        ledger1.reserveSlot(),
        ledger2.reserveSlot()
      ]);

      const finalState = await ledger1.getState();
      expect(finalState.dailyUsage.reserved).toBe(4);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
