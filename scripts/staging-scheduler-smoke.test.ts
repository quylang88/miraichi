import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const spawn = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ spawnSync: spawn }));
import { expectedStagingSchedulerCommand, linkedStagingQuery } from './staging-scheduler-smoke.js';

describe('hosted scheduler database transport', () => {
  beforeEach(() => spawn.mockReset());
  afterEach(() => vi.unstubAllEnvs());
  it('uses the verified pooler to bypass IPv6 preflight without IPv6 or password arguments', () => {
    vi.stubEnv('SUPABASE_PROJECT_REF', 'abcdefghijklmnopqrst');
    vi.stubEnv('SUPABASE_DATABASE_URL', 'postgresql://postgres.abcdefghijklmnopqrst:private@aws-7-eu-central-1.pooler.supabase.com:5432/postgres');
    spawn.mockReturnValue({ status: 0, stderr: '', stdout: '{"rows":[{"jobname":"current"}]}' });
    expect(linkedStagingQuery('select jobname from cron.job')).toEqual([{ jobname: 'current' }]);
    const args = spawn.mock.calls[0][1];
    expect(args).toEqual(['node_modules/supabase/dist/supabase.js', 'db', 'query', '--db-url',
      'postgresql://postgres.abcdefghijklmnopqrst@aws-7-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require',
      '--output', 'json', '--agent', 'yes']);
    expect(JSON.stringify(args)).not.toContain('private');
    expect(spawn.mock.calls[0][2].env.PGPASSWORD).toBe('private');
  });
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
  it('requires every hosted cron command to remain pinned to Frankfurt', () => {
    expect(expectedStagingSchedulerCommand('current')).toBe(
      "select miraichi_app.invoke_hosted_refresh('current','eu-central-1');"
    );
    expect(expectedStagingSchedulerCommand('live')).toBe(
      "select miraichi_app.invoke_hosted_refresh('live','eu-central-1');"
    );
  });
});
