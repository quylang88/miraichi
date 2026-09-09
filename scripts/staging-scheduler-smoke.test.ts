import { beforeEach, describe, expect, it, vi } from 'vitest';
const spawn = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawnSync: spawn }));
import { linkedStagingQuery } from './staging-scheduler-smoke.js';

describe('hosted scheduler database transport', () => {
  beforeEach(() => spawn.mockReset());
  it('retries a failed metadata read without weakening the gate', () => {
    spawn.mockReturnValueOnce({ status: 1, stderr: 'connection reset', stdout: '' })
      .mockReturnValueOnce({ status: 0, stderr: '', stdout: '{"rows":[{"jobname":"current"}]}' });
    expect(linkedStagingQuery('select jobname from cron.job')).toEqual([{ jobname: 'current' }]);
    expect(spawn).toHaveBeenCalledTimes(2);
  });
  it('never retries an uncertain scheduler invocation', () => {
    spawn.mockReturnValue({ status: 1, stderr: 'connection reset', stdout: '' });
    expect(() => linkedStagingQuery("select miraichi_app.invoke_hosted_refresh('current')")).toThrow();
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});
