import { describe, expect, it } from 'vitest';
import { CommandExecutionError, createCommandRunner } from './command-runner.js';

describe('release command runner', () => {
  it('passes every argument literally without a shell', async () => {
    const runner = createCommandRunner();
    const value = 'literal; Write-Output injected && echo leaked';
    const result = await runner.run(process.execPath, [
      '-e', 'process.stdout.write(process.argv[1])', value
    ]);
    expect(result).toEqual({ stdout: value, stderr: '', exitCode: 0 });
  });

  it('returns a sanitized failure without echoing arguments or environment values', async () => {
    const runner = createCommandRunner();
    const secret = 'do-not-echo-this-secret';
    let observed: unknown;
    try {
      await runner.run(process.execPath, ['-e', 'process.exit(7)', secret], {
        env: { ...process.env, RELEASE_TEST_SECRET: secret }
      });
    } catch (error) {
      observed = error;
    }
    expect(observed).toBeInstanceOf(CommandExecutionError);
    expect(observed).toMatchObject({ code: 'command_failed', exitCode: 7 });
    expect(String(observed)).not.toContain(secret);
  });
});
