import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FotMobResultJobLease,
  FotMobResultLedger,
  fotMobDateKey,
  fotMobMatchKey
} from './fotmob-result-ledger.js';

const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'miraichi-fotmob-result-ledger-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('FotMob terminal-result ledger', () => {
  it('persists date ETag and match retry atomically across restart', async () => {
    const dataRoot = await makeRoot();
    const observedAt = new Date('2026-08-31T14:00:00.000Z');
    const ledger = new FotMobResultLedger({ dataRoot, now: () => observedAt });

    await ledger.recordBatch({
      dates: [{ kind: 'success', date: '2026-08-31', etag: 'W/"daily"' }],
      matches: [{ kind: 'retry', matchId: 'match-alpha', delayMinutes: 2 }]
    }, observedAt);

    const restarted = new FotMobResultLedger({ dataRoot, now: () => observedAt });
    const state = await restarted.getState();
    expect(state.revision).toBe(1);
    expect(state.dates[fotMobDateKey('2026-08-31')]).toEqual({
      etag: 'W/"daily"',
      lastCheckedAt: '2026-08-31T14:00:00.000Z',
      failureCount: 0
    });
    expect(state.matches[fotMobMatchKey('match-alpha')]).toEqual({
      attemptCount: 1,
      nextCheckAt: '2026-08-31T14:02:00.000Z'
    });
    const stateDir = path.join(dataRoot, 'providers', 'fotmob-unofficial', 'state');
    expect((await readdir(stateDir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('records terminal, exhausted, and date failure outcomes without duplicate keys', async () => {
    const dataRoot = await makeRoot();
    const observedAt = new Date('2026-08-31T14:00:00.000Z');
    const ledger = new FotMobResultLedger({ dataRoot });

    await ledger.recordBatch({
      dates: [{ kind: 'failure', date: '2026-08-31', error: 'blocked detail', delayMinutes: 15 }],
      matches: [
        { kind: 'terminal', matchId: 'match-alpha' },
        { kind: 'exhausted', matchId: 'match-beta' }
      ]
    }, observedAt);
    const state = await ledger.getState();
    expect(state.dates[fotMobDateKey('2026-08-31')]).toMatchObject({
      failureCount: 1,
      nextAttemptAt: '2026-08-31T14:15:00.000Z',
      lastError: 'blocked detail'
    });
    expect(state.matches[fotMobMatchKey('match-alpha')]).toMatchObject({
      attemptCount: 1,
      terminalAt: '2026-08-31T14:00:00.000Z'
    });
    expect(state.matches[fotMobMatchKey('match-beta')]).toMatchObject({
      attemptCount: 1,
      exhaustedAt: '2026-08-31T14:00:00.000Z'
    });

    await expect(ledger.recordBatch({
      dates: [],
      matches: [
        { kind: 'retry', matchId: 'match-alpha', delayMinutes: 2 },
        { kind: 'terminal', matchId: 'match-alpha' }
      ]
    }, observedAt)).rejects.toThrow(/duplicate/iu);
  });

  it('fails closed on a malformed persisted ledger', async () => {
    const dataRoot = await makeRoot();
    const stateDir = path.join(dataRoot, 'providers', 'fotmob-unofficial', 'state');
    await mkdir(stateDir, { recursive: true });
    await writeFile(path.join(stateDir, 'terminal-results.json'), '{"revision":-1}', 'utf8');
    await expect(new FotMobResultLedger({ dataRoot }).getState())
      .rejects.toThrow('fotmob_result_ledger_invalid');
  });

  it('allows only one concurrent terminal-result lease owner', async () => {
    const dataRoot = await makeRoot();
    const lease = new FotMobResultJobLease({ dataRoot });
    let releaseFirst!: () => void;
    const blocker = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const first = lease.tryWithLease(async () => {
      await blocker;
      return 'first';
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(new FotMobResultJobLease({ dataRoot }).tryWithLease(async () => 'second'))
      .resolves.toEqual({ acquired: false });
    releaseFirst();
    await expect(first).resolves.toEqual({ acquired: true, value: 'first' });
  });
});
