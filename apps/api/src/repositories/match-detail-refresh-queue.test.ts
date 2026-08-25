import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  MatchDetailRefreshQueue,
  resolveContainedPath,
  assertSafeMatchId,
  validateMatchDetailRefreshItem,
  type MatchDetailRefreshItem
} from './match-detail-refresh-queue.js';

describe('MatchDetailRefreshQueue', () => {
  let tempDir: string;
  let queue: MatchDetailRefreshQueue;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-queue-test-'));
    queue = new MatchDetailRefreshQueue({ dataRoot: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor and initialization', () => {
    it('accepts string dataRoot or object options', () => {
      const queueFromString = new MatchDetailRefreshQueue(tempDir);
      expect(queueFromString).toBeInstanceOf(MatchDetailRefreshQueue);

      const queueFromOptions = new MatchDetailRefreshQueue({ dataRoot: tempDir });
      expect(queueFromOptions).toBeInstanceOf(MatchDetailRefreshQueue);
    });

    it('rejects empty or whitespace dataRoot', () => {
      expect(() => new MatchDetailRefreshQueue('')).toThrow(/dataRoot must be a non-empty string/);
      expect(() => new MatchDetailRefreshQueue({ dataRoot: '   ' })).toThrow(/dataRoot must be a non-empty string/);
    });

    it('stores queue in <dataRoot>/match-detail-refresh/queue.json', () => {
      const expectedDir = path.join(tempDir, 'match-detail-refresh');
      const expectedFile = path.join(expectedDir, 'queue.json');
      expect(queue.getQueueDir()).toBe(expectedDir);
      expect(queue.getQueueFilePath()).toBe(expectedFile);
    });
  });

  describe('enqueue and getItem', () => {
    it('enqueues a new item and retrieves it accurately', async () => {
      const fixedNow = new Date('2026-08-20T10:00:00.000Z');
      const item = await queue.enqueue('match-test-001', { maxAttempts: 5, now: fixedNow });

      expect(item).toEqual({
        matchId: 'match-test-001',
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: '2026-08-20T10:00:00.000Z',
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      });

      const retrieved = await queue.getItem('match-test-001');
      expect(retrieved).toEqual(item);
    });

    it('uses default maxAttempts = 3 when not specified', async () => {
      const item = await queue.enqueue('match-test-default');
      expect(item.maxAttempts).toBe(3);
      expect(item.attempts).toBe(0);
      expect(item.status).toBe('pending');
    });

    it('returns null for non-existent match ID', async () => {
      const retrieved = await queue.getItem('match-non-existent');
      expect(retrieved).toBeNull();
    });

    it('rejects invalid maxAttempts option on enqueue', async () => {
      await expect(queue.enqueue('match-test-bad-max', { maxAttempts: 0 })).rejects.toThrow(
        /maxAttempts must be a positive integer/
      );
      await expect(queue.enqueue('match-test-bad-max', { maxAttempts: -1 })).rejects.toThrow(
        /maxAttempts must be a positive integer/
      );
    });
  });

  describe('deduplication', () => {
    it('enqueuing the same matchId twice does not create duplicate entries or reset attempts', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      const first = await queue.enqueue('match-dedupe-01', { maxAttempts: 3, now: t0 });
      expect(first.status).toBe('pending');
      expect(first.attempts).toBe(0);

      // Simulate processing
      const t1 = new Date('2026-08-20T10:05:00.000Z');
      await queue.markProcessing(['match-dedupe-01'], t1);

      const processingItem = await queue.getItem('match-dedupe-01');
      expect(processingItem?.status).toBe('processing');
      expect(processingItem?.attempts).toBe(1);

      // Enqueue again with a later time
      const t2 = new Date('2026-08-20T10:10:00.000Z');
      const second = await queue.enqueue('match-dedupe-01', { maxAttempts: 5, now: t2 });

      // Should return existing item without modifying attempts or status
      expect(second.status).toBe('processing');
      expect(second.attempts).toBe(1);
      expect(second.maxAttempts).toBe(3);
      expect(second.updatedAt).toBe('2026-08-20T10:05:00.000Z');

      const allItems = await queue.getAllItems();
      expect(allItems).toHaveLength(1);
    });

    it('does not re-enqueue or overwrite completed items', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-completed-01', { now: t0 });
      await queue.markCompleted(['match-completed-01'], t0);

      const t1 = new Date('2026-08-20T11:00:00.000Z');
      const reEnqueued = await queue.enqueue('match-completed-01', { now: t1 });

      expect(reEnqueued.status).toBe('completed');
      expect(reEnqueued.updatedAt).toBe('2026-08-20T10:00:00.000Z');
    });

    it('does not reset a terminally failed item when it is enqueued again', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-fail-retry', { maxAttempts: 1, now: t0 });
      await queue.markProcessing(['match-fail-retry'], t0);
      await queue.markFailed(['match-fail-retry'], 'network error', '2026-08-20T10:05:00.000Z', t0);

      const failed = await queue.getItem('match-fail-retry');
      expect(failed?.status).toBe('failed');

      // Enqueue when now is past nextAttemptAt
      const t1 = new Date('2026-08-20T10:10:00.000Z');
      const resetItem = await queue.enqueue('match-fail-retry', { now: t1 });

      expect(resetItem.status).toBe('failed');
      expect(resetItem.attempts).toBe(1);
      expect(resetItem.updatedAt).toBe('2026-08-20T10:00:00.000Z');
    });

    it('resets quota_deferred item to pending if nextAttemptAt is expired/due', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-deferred-retry', { now: t0 });
      await queue.markDeferred(['match-deferred-retry'], 'daily quota reached', {
        nextAttemptAt: '2026-08-20T10:05:00.000Z',
        now: t0
      });

      const deferred = await queue.getItem('match-deferred-retry');
      expect(deferred?.status).toBe('quota_deferred');

      const t1 = new Date('2026-08-20T10:15:00.000Z');
      const resetItem = await queue.enqueue('match-deferred-retry', { now: t1 });

      expect(resetItem.status).toBe('pending');
      expect(resetItem.nextAttemptAt).toBe('2026-08-20T10:15:00.000Z');
    });

    it('does not reset quota_deferred or failed item if nextAttemptAt is still in the future', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-deferred-future', { now: t0 });
      await queue.markDeferred(['match-deferred-future'], 'deferred', {
        nextAttemptAt: '2026-08-20T12:00:00.000Z',
        now: t0
      });

      const t1 = new Date('2026-08-20T10:30:00.000Z');
      const item = await queue.enqueue('match-deferred-future', { now: t1 });

      expect(item.status).toBe('quota_deferred');
      expect(item.nextAttemptAt).toBe('2026-08-20T12:00:00.000Z');
    });
  });

  describe('getDueItems', () => {
    it('returns items where status is pending or (quota_deferred/failed with nextAttemptAt <= now), sorted ascending and capped at limit', async () => {
      const now = new Date('2026-08-20T12:00:00.000Z');

      // 1. Pending item due now
      await queue.enqueue('match-pending-01', { now: new Date('2026-08-20T10:00:00.000Z') });

      // 2. Pending item created earlier
      await queue.enqueue('match-pending-00', { now: new Date('2026-08-20T09:00:00.000Z') });

      // 3. Deferred item due in the past
      await queue.enqueue('match-deferred-due', { now: new Date('2026-08-20T08:00:00.000Z') });
      await queue.markDeferred(['match-deferred-due'], 'rate limit', {
        nextAttemptAt: '2026-08-20T11:00:00.000Z',
        now: new Date('2026-08-20T08:30:00.000Z')
      });

      // 4. Deferred item NOT due yet (future nextAttemptAt)
      await queue.enqueue('match-deferred-future', { now: new Date('2026-08-20T08:00:00.000Z') });
      await queue.markDeferred(['match-deferred-future'], 'quota', {
        nextAttemptAt: '2026-08-20T15:00:00.000Z',
        now: new Date('2026-08-20T08:30:00.000Z')
      });

      // 5. Retryable failed item with retry due now (status reset to pending)
      await queue.enqueue('match-failed-due', { maxAttempts: 3, now: new Date('2026-08-20T07:00:00.000Z') });
      await queue.markProcessing(['match-failed-due'], new Date('2026-08-20T07:30:00.000Z'));
      await queue.markFailed(['match-failed-due'], 'timeout', '2026-08-20T11:30:00.000Z', new Date('2026-08-20T07:30:00.000Z'));

      // 6. Terminally failed item (maxAttempts reached, status: failed, should NOT be returned)
      await queue.enqueue('match-failed-terminal', { maxAttempts: 1, now: new Date('2026-08-20T07:00:00.000Z') });
      await queue.markProcessing(['match-failed-terminal'], new Date('2026-08-20T07:30:00.000Z'));
      await queue.markFailed(['match-failed-terminal'], 'permanent error', undefined, new Date('2026-08-20T07:30:00.000Z'));

      // 7. Completed item (should NOT be returned)
      await queue.enqueue('match-completed-01', { now: new Date('2026-08-20T06:00:00.000Z') });
      await queue.markCompleted(['match-completed-01'], new Date('2026-08-20T06:30:00.000Z'));

      // 8. Processing item whose claim lease expired (must recover after a crash)
      await queue.enqueue('match-processing-01', { now: new Date('2026-08-20T06:00:00.000Z') });
      await queue.markProcessing(['match-processing-01'], new Date('2026-08-20T06:30:00.000Z'));

      const dueItems = await queue.getDueItems(20, now);
      const dueMatchIds = dueItems.map((item) => item.matchId);

      expect(dueMatchIds).toEqual([
        'match-processing-01', // processing claim expired at 06:45:00
        'match-pending-00',    // nextAttemptAt: 09:00:00
        'match-pending-01',    // nextAttemptAt: 10:00:00
        'match-deferred-due',  // nextAttemptAt: 11:00:00
        'match-failed-due'     // nextAttemptAt: 11:30:00
      ]);

      expect(dueMatchIds).not.toContain('match-deferred-future');
      expect(dueMatchIds).not.toContain('match-failed-terminal');
      expect(dueMatchIds).not.toContain('match-completed-01');
    });

    it('respects limit parameter', async () => {
      const now = new Date('2026-08-20T12:00:00.000Z');
      for (let i = 1; i <= 10; i++) {
        const id = `match-bulk-${String(i).padStart(2, '0')}`;
        await queue.enqueue(id, { now });
      }

      const dueTop3 = await queue.getDueItems(3, now);
      expect(dueTop3).toHaveLength(3);

      const dueDefault = await queue.getDueItems(undefined, now);
      expect(dueDefault).toHaveLength(10);
    });

    it('rejects non-positive integer limit', async () => {
      await expect(queue.getDueItems(0)).rejects.toThrow(/limit must be a positive integer/);
      await expect(queue.getDueItems(-5)).rejects.toThrow(/limit must be a positive integer/);
    });
  });

  describe('state transitions: markProcessing, markCompleted, markDeferred, markFailed', () => {
    it('markProcessing transitions status to processing, increments attempts, and sets lastAttemptAt', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-proc-01', { now: t0 });
      await queue.enqueue('match-proc-02', { now: t0 });

      const t1 = new Date('2026-08-20T10:05:00.000Z');
      await queue.markProcessing(['match-proc-01', 'match-proc-02'], t1);

      const item1 = await queue.getItem('match-proc-01');
      expect(item1?.status).toBe('processing');
      expect(item1?.attempts).toBe(1);
      expect(item1?.lastAttemptAt).toBe('2026-08-20T10:05:00.000Z');
      expect(item1?.updatedAt).toBe('2026-08-20T10:05:00.000Z');

      // Second processing increment
      const t2 = new Date('2026-08-20T10:15:00.000Z');
      await queue.markProcessing(['match-proc-01'], t2);

      const item1Again = await queue.getItem('match-proc-01');
      expect(item1Again?.attempts).toBe(2);
      expect(item1Again?.lastAttemptAt).toBe('2026-08-20T10:15:00.000Z');
    });

    it('markCompleted transitions status to completed and updates updatedAt', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-comp-01', { now: t0 });

      const t1 = new Date('2026-08-20T10:10:00.000Z');
      await queue.markCompleted(['match-comp-01'], t1);

      const item = await queue.getItem('match-comp-01');
      expect(item?.status).toBe('completed');
      expect(item?.updatedAt).toBe('2026-08-20T10:10:00.000Z');
    });

    it('markDeferred transitions status to quota_deferred, records reason, and optional nextAttemptAt', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-def-01', { now: t0 });

      const t1 = new Date('2026-08-20T10:05:00.000Z');
      await queue.markDeferred(
        ['match-def-01'],
        'Daily quota exhausted (85/85)',
        { nextAttemptAt: '2026-08-21T00:00:00.000Z', now: t1 }
      );

      const item = await queue.getItem('match-def-01');
      expect(item?.status).toBe('quota_deferred');
      expect(item?.lastError).toBe('Daily quota exhausted (85/85)');
      expect(item?.nextAttemptAt).toBe('2026-08-21T00:00:00.000Z');
      expect(item?.updatedAt).toBe('2026-08-20T10:05:00.000Z');
    });

    it('markDeferred supports Date argument as 3rd parameter', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-def-date', { now: t0 });

      const t1 = new Date('2026-08-20T10:20:00.000Z');
      await queue.markDeferred(['match-def-date'], 'reason text', t1);

      const item = await queue.getItem('match-def-date');
      expect(item?.status).toBe('quota_deferred');
      expect(item?.lastError).toBe('reason text');
      expect(item?.updatedAt).toBe('2026-08-20T10:20:00.000Z');
    });

    it('markFailed marks retryable failure as pending with nextAttemptAt when attempts < maxAttempts', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-fail-retry-01', { maxAttempts: 3, now: t0 });
      await queue.markProcessing(['match-fail-retry-01'], t0); // attempts = 1

      const t1 = new Date('2026-08-20T10:05:00.000Z');
      await queue.markFailed(['match-fail-retry-01'], 'HTTP 500 error', '2026-08-20T10:15:00.000Z', t1);

      const item = await queue.getItem('match-fail-retry-01');
      expect(item?.status).toBe('pending');
      expect(item?.attempts).toBe(1);
      expect(item?.lastError).toBe('HTTP 500 error');
      expect(item?.nextAttemptAt).toBe('2026-08-20T10:15:00.000Z');
      expect(item?.updatedAt).toBe('2026-08-20T10:05:00.000Z');
    });

    it('markFailed marks terminal failure as failed when attempts >= maxAttempts', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-fail-term-01', { maxAttempts: 2, now: t0 });

      // Attempt 1
      await queue.markProcessing(['match-fail-term-01'], t0);
      await queue.markFailed(['match-fail-term-01'], 'fail 1', '2026-08-20T10:05:00.000Z', t0);
      let item = await queue.getItem('match-fail-term-01');
      expect(item?.status).toBe('pending');
      expect(item?.attempts).toBe(1);

      // Attempt 2 (reaches maxAttempts = 2)
      const t1 = new Date('2026-08-20T10:10:00.000Z');
      await queue.markProcessing(['match-fail-term-01'], t1);
      await queue.markFailed(['match-fail-term-01'], 'fail 2 max reached', undefined, t1);

      item = await queue.getItem('match-fail-term-01');
      expect(item?.status).toBe('failed');
      expect(item?.attempts).toBe(2);
      expect(item?.lastError).toBe('fail 2 max reached');
      expect(item?.updatedAt).toBe('2026-08-20T10:10:00.000Z');
    });

    it('markFailed marks terminal failure as failed immediately when terminal: true even if attempts < maxAttempts', async () => {
      const t0 = new Date('2026-08-20T10:00:00.000Z');
      await queue.enqueue('match-term-flag-01', { maxAttempts: 5, now: t0 });

      const t1 = new Date('2026-08-20T10:05:00.000Z');
      await queue.markFailed(['match-term-flag-01'], 'match missing', { terminal: true, now: t1 });

      const item = await queue.getItem('match-term-flag-01');
      expect(item?.status).toBe('failed');
      expect(item?.attempts).toBe(0);
      expect(item?.lastError).toBe('match missing');
      expect(item?.updatedAt).toBe('2026-08-20T10:05:00.000Z');

      const due = await queue.getDueItems(10, new Date('2026-08-20T11:00:00.000Z'));
      expect(due.map((d) => d.matchId)).not.toContain('match-term-flag-01');
    });

    it('ignores non-existent match IDs in batch mark methods without error', async () => {
      await expect(queue.markProcessing(['match-unknown-01'])).resolves.not.toThrow();
      await expect(queue.markCompleted(['match-unknown-02'])).resolves.not.toThrow();
      await expect(queue.markDeferred(['match-unknown-03'])).resolves.not.toThrow();
      await expect(queue.markFailed(['match-unknown-04'], 'err')).resolves.not.toThrow();
    });
  });

  describe('pruneCompleted', () => {
    it('prunes completed items older than specified seconds and retains newer items', async () => {
      const now = new Date('2026-08-20T12:00:00.000Z');

      // Completed 2 hours ago (> 1 hour / 3600s)
      await queue.enqueue('match-old-comp', { now: new Date('2026-08-20T09:00:00.000Z') });
      await queue.markCompleted(['match-old-comp'], new Date('2026-08-20T10:00:00.000Z'));

      // Completed 10 minutes ago (< 1 hour)
      await queue.enqueue('match-fresh-comp', { now: new Date('2026-08-20T11:40:00.000Z') });
      await queue.markCompleted(['match-fresh-comp'], new Date('2026-08-20T11:50:00.000Z'));

      // Pending (should not be pruned regardless of age)
      await queue.enqueue('match-old-pending', { now: new Date('2026-08-19T00:00:00.000Z') });

      // Failed (should not be pruned by pruneCompleted)
      await queue.enqueue('match-old-failed', { maxAttempts: 1, now: new Date('2026-08-19T00:00:00.000Z') });
      await queue.markProcessing(['match-old-failed'], new Date('2026-08-19T00:00:00.000Z'));
      await queue.markFailed(['match-old-failed'], 'fatal', undefined, new Date('2026-08-19T00:00:00.000Z'));

      const prunedCount = await queue.pruneCompleted(3600, now);
      expect(prunedCount).toBe(1);

      expect(await queue.getItem('match-old-comp')).toBeNull();
      expect(await queue.getItem('match-fresh-comp')).not.toBeNull();
      expect(await queue.getItem('match-old-pending')).not.toBeNull();
      expect(await queue.getItem('match-old-failed')).not.toBeNull();
    });

    it('rejects negative olderThanSeconds', async () => {
      await expect(queue.pruneCompleted(-1)).rejects.toThrow(/olderThanSeconds must be a non-negative number/);
    });
  });

  describe('path traversal and match ID security', () => {
    it('rejects unsafe match IDs with parent directory traversal, slashes, or special characters', async () => {
      const unsafeIds = [
        '../escaped',
        '..\\escaped',
        '../../outside',
        'sub/path/id',
        'sub\\path\\id',
        'unsafe:name',
        'id with spaces',
        '__proto__',
        'constructor',
        'prototype',
        '',
        '   '
      ];

      for (const unsafeId of unsafeIds) {
        await expect(queue.enqueue(unsafeId)).rejects.toThrow();
        await expect(queue.getItem(unsafeId)).rejects.toThrow();
        await expect(queue.markProcessing([unsafeId])).rejects.toThrow();
        await expect(queue.markCompleted([unsafeId])).rejects.toThrow();
        await expect(queue.markDeferred([unsafeId])).rejects.toThrow();
        await expect(queue.markFailed([unsafeId], 'err')).rejects.toThrow();
      }
    });

    it('resolveContainedPath throws when path escapes root', () => {
      expect(() => resolveContainedPath(tempDir, '..', 'escaped.json')).toThrow(/escaped/i);
      expect(() => resolveContainedPath(tempDir, '../../outside.json')).toThrow(/escaped/i);
    });

    it('assertSafeMatchId validates allowed characters', () => {
      expect(() => assertSafeMatchId('match-123_abc-DEF')).not.toThrow();
      expect(() => assertSafeMatchId('abc')).not.toThrow();
      expect(() => assertSafeMatchId('123')).not.toThrow();
    });
  });

  describe('atomic file replacement, crash safety, and backup recovery', () => {
    it('never steals a queue lock from a live process merely because the lock is old', async () => {
      const guardedQueue = new MatchDetailRefreshQueue({
        dataRoot: tempDir,
        staleLockTimeoutMs: 1,
        lockTimeoutMs: 10,
        lockRetryDelayMs: 1
      });
      await fs.mkdir(guardedQueue.getQueueDir(), { recursive: true });
      const lockPath = path.join(guardedQueue.getQueueDir(), 'queue.lock');
      await fs.writeFile(lockPath, JSON.stringify({
        pid: process.pid,
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        createdAtMs: Date.now() - 60_000,
        id: 'live-owner'
      }), 'utf8');

      await expect(guardedQueue.getAllItems()).rejects.toThrow(/Timeout acquiring lock/);
      expect(JSON.parse(await fs.readFile(lockPath, 'utf8')).id).toBe('live-owner');
    });

    it('cleans up temporary file and leaves target completely unharmed if write fails during fsync', async () => {
      await queue.enqueue('match-first-01');

      const originalFilePath = queue.getQueueFilePath();
      const originalContent = await fs.readFile(originalFilePath, 'utf8');

      const failingQueue = new MatchDetailRefreshQueue({
        dataRoot: tempDir,
        _writeHook: (stage) => {
          if (stage === 'before-sync') {
            throw new Error('Simulated IO fsync failure');
          }
        }
      });

      await expect(failingQueue.enqueue('match-failing-02')).rejects.toThrow('Simulated IO fsync failure');

      const currentContent = await fs.readFile(originalFilePath, 'utf8');
      expect(currentContent).toBe(originalContent);

      const files = await fs.readdir(queue.getQueueDir());
      const tmpFiles = files.filter((f) => f.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('cleans up temporary file and leaves target completely unharmed if write fails before rename', async () => {
      await queue.enqueue('match-first-01');

      const originalFilePath = queue.getQueueFilePath();
      const originalContent = await fs.readFile(originalFilePath, 'utf8');

      const failingQueue = new MatchDetailRefreshQueue({
        dataRoot: tempDir,
        _writeHook: (stage) => {
          if (stage === 'before-rename') {
            throw new Error('Simulated failure before atomic rename');
          }
        }
      });

      await expect(failingQueue.enqueue('match-failing-02')).rejects.toThrow(
        'Simulated failure before atomic rename'
      );

      const currentContent = await fs.readFile(originalFilePath, 'utf8');
      expect(currentContent).toBe(originalContent);

      const files = await fs.readdir(queue.getQueueDir());
      const tmpFiles = files.filter((f) => f.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('recovers from .backup-queue.json after an interrupted rename', async () => {
      await queue.enqueue('match-backup-01');
      const queueFile = queue.getQueueFilePath();
      const backupFile = path.join(queue.getQueueDir(), '.backup-queue.json');

      // Simulate interrupted rename: move queue.json to .backup-queue.json
      await fs.rename(queueFile, backupFile);

      const restartedQueue = new MatchDetailRefreshQueue({ dataRoot: tempDir });
      const item = await restartedQueue.getItem('match-backup-01');
      expect(item).not.toBeNull();
      expect(item?.matchId).toBe('match-backup-01');

      // Verify .backup-queue.json was restored to queue.json
      const exists = await fs.stat(queueFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('throws typed error if queue file is corrupted and no backup exists', async () => {
      await queue.enqueue('match-valid-01');
      const queueFile = queue.getQueueFilePath();
      await fs.writeFile(queueFile, 'corrupted { invalid json', 'utf8');

      const brokenQueue = new MatchDetailRefreshQueue({ dataRoot: tempDir });
      await expect(brokenQueue.getItem('match-valid-01')).rejects.toThrow(/Corrupted queue storage file/);
    });
  });

  describe('schema validation and exactOptionalPropertyTypes compliance', () => {
    it('validateMatchDetailRefreshItem correctly validates shape', () => {
      const validItem: MatchDetailRefreshItem = {
        matchId: 'match-schema-01',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextAttemptAt: '2026-08-20T10:00:00.000Z',
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      };
      expect(validateMatchDetailRefreshItem(validItem)).toBe(true);

      expect(validateMatchDetailRefreshItem({ ...validItem, lastAttemptAt: '2026-08-20T10:05:00.000Z' })).toBe(true);
      expect(validateMatchDetailRefreshItem({ ...validItem, lastAttemptAt: null })).toBe(true);
      expect(validateMatchDetailRefreshItem({ ...validItem, lastError: 'Some error' })).toBe(true);
      expect(validateMatchDetailRefreshItem({ ...validItem, lastError: null })).toBe(true);

      // Invalid status
      expect(validateMatchDetailRefreshItem({ ...validItem, status: 'in_play' })).toBe(false);
      // Negative attempts
      expect(validateMatchDetailRefreshItem({ ...validItem, attempts: -1 })).toBe(false);
      // Zero maxAttempts
      expect(validateMatchDetailRefreshItem({ ...validItem, maxAttempts: 0 })).toBe(false);
      // Invalid date
      expect(validateMatchDetailRefreshItem({ ...validItem, nextAttemptAt: 'not-a-date' })).toBe(false);
      // Unsafe matchId
      expect(validateMatchDetailRefreshItem({ ...validItem, matchId: '../bad' })).toBe(false);
    });

    it('satisfies exactOptionalPropertyTypes without compilation error', () => {
      const itemWithoutOptionals: MatchDetailRefreshItem = {
        matchId: 'match-opts-01',
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        nextAttemptAt: '2026-08-20T10:00:00.000Z',
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      };

      const itemWithNullOptionals: MatchDetailRefreshItem = {
        matchId: 'match-opts-02',
        status: 'processing',
        attempts: 1,
        maxAttempts: 3,
        nextAttemptAt: '2026-08-20T10:00:00.000Z',
        lastAttemptAt: null,
        lastError: null,
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:00:00.000Z'
      };

      const itemWithStringOptionals: MatchDetailRefreshItem = {
        matchId: 'match-opts-03',
        status: 'failed',
        attempts: 3,
        maxAttempts: 3,
        nextAttemptAt: '2026-08-20T10:00:00.000Z',
        lastAttemptAt: '2026-08-20T10:05:00.000Z',
        lastError: 'Quota exceeded',
        createdAt: '2026-08-20T10:00:00.000Z',
        updatedAt: '2026-08-20T10:05:00.000Z'
      };

      expect(itemWithoutOptionals.lastAttemptAt).toBeUndefined();
      expect(itemWithNullOptionals.lastAttemptAt).toBeNull();
      expect(itemWithStringOptionals.lastError).toBe('Quota exceeded');
    });
  });

  describe('queue helper methods: size, clear, getAllItems', () => {
    it('size returns accurate count, clear empties queue, getAllItems returns all items', async () => {
      expect(await queue.size()).toBe(0);
      expect(await queue.getAllItems()).toEqual([]);

      await queue.enqueue('match-count-01');
      await queue.enqueue('match-count-02');
      await queue.enqueue('match-count-03');

      expect(await queue.size()).toBe(3);
      const all = await queue.getAllItems();
      expect(all).toHaveLength(3);
      expect(all.map((i) => i.matchId).sort()).toEqual(['match-count-01', 'match-count-02', 'match-count-03']);

      await queue.clear();
      expect(await queue.size()).toBe(0);
      expect(await queue.getAllItems()).toEqual([]);
    });
  });
});
