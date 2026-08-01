import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { OpenFootballIngestionRunResult } from '../apps/worker/src/jobs/openfootball-ingestion-job.js';
import { OPENFOOTBALL_SOURCE_REGISTRY } from '../packages/config/src/openfootball-source-registry.js';
import { runCaptureOpenFootballCommand } from './capture-openfootball.js';

function result(status: 'published' | 'not_modified' | 'skipped' | 'failed'): OpenFootballIngestionRunResult {
  if (status === 'published') {
    return {
      status,
      runId: 'run-1',
      changedSourceCount: 2,
      notModifiedSourceCount: 0,
      publishedMatchCount: 440,
      servingVersion: 'serving-1'
    };
  }
  return {
    status,
    runId: 'run-1',
    changedSourceCount: 0,
    notModifiedSourceCount: 0,
    errorCodes: status === 'failed' ? ['source_unavailable'] : []
  };
}

describe('runCaptureOpenFootballCommand', () => {
  it('runs the due-gated job with the default data root and no force option', async () => {
    const runJob = vi.fn().mockResolvedValue(result('skipped'));

    await expect(runCaptureOpenFootballCommand({ args: [], runJob })).resolves.toBe(0);
    expect(runJob).toHaveBeenCalledOnce();
    expect(runJob).toHaveBeenCalledWith({
      dataRoot: path.resolve(process.cwd(), 'apps/api/data'),
      sources: OPENFOOTBALL_SOURCE_REGISTRY,
      now: expect.any(Function)
    });
    expect(runJob).toHaveBeenCalledWith(expect.not.objectContaining({ force: true }));
  });

  it('accepts only an absolute --data-root override', async () => {
    const runJob = vi.fn().mockResolvedValue(result('published'));
    const absoluteDataRoot = path.resolve(process.cwd(), 'tmp/openfootball-data');

    await expect(runCaptureOpenFootballCommand({
      args: ['--data-root', absoluteDataRoot],
      runJob
    })).resolves.toBe(0);
    expect(runJob).toHaveBeenCalledWith(expect.objectContaining({ dataRoot: absoluteDataRoot }));
  });

  it.each([
    ['--force'],
    ['--url', 'https://raw.githubusercontent.com/openfootball/england/master/2026-27/1-premierleague.txt'],
    ['https://raw.githubusercontent.com/openfootball/england/master/2026-27/1-premierleague.txt'],
    ['--repository', 'england'],
    ['--repo', 'england'],
    ['--ref', 'master'],
    ['--path', '2026-27/1-premierleague.txt'],
    ['--file-path', '2026-27/1-premierleague.txt'],
    ['--unknown'],
    ['--data-root'],
    ['--data-root', 'relative/path'],
    ['--data-root=relative/path'],
    ['--data-root', path.resolve(process.cwd(), 'one'), '--data-root', path.resolve(process.cwd(), 'two')]
  ])('rejects unsupported arguments %j without invoking the job', async (...args) => {
    const runJob = vi.fn().mockResolvedValue(result('skipped'));

    await expect(runCaptureOpenFootballCommand({ args, runJob })).resolves.toBe(2);
    expect(runJob).not.toHaveBeenCalled();
  });

  it('returns exit code 1 for a failed job result or thrown job error', async () => {
    const failedJob = vi.fn().mockResolvedValue(result('failed'));
    const rejectedJob = vi.fn().mockRejectedValue(new Error('unsafe serving pointer'));

    await expect(runCaptureOpenFootballCommand({ args: [], runJob: failedJob })).resolves.toBe(1);
    await expect(runCaptureOpenFootballCommand({ args: [], runJob: rejectedJob })).resolves.toBe(1);
  });
});
