import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workflow release candidate CLI invocation', () => {
  // Reintroducing a forwarded "--" must fail at argument parsing before provenance runs.
  it.each(['release-candidate.yml', 'deploy-production.yml'])(
    '%s reaches event validation using the real pnpm command',
    (workflow) => {
      const source = readFileSync(path.resolve('.github/workflows', workflow), 'utf8');
      const command = source.match(/pnpm run verify:release-candidate[^\n]*(?:\n {10,}\S[^\n]*)*/u)?.[0];
      expect(command, 'workflow candidate invocation exists').toBeDefined();
      const [executable, ...args] = command!.trim().split(/\s+/u);
      const result = spawnSync(executable!, args, {
        cwd: process.cwd(),
        env: { ...process.env, GITHUB_EVENT_PATH: '' },
        encoding: 'utf8', timeout: 15_000
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      const reports = `${result.stdout}\n${result.stderr}`.split(/\r?\n/u)
        .filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
      expect(reports).toEqual([{ status: 'failed', code: 'candidate_event_path_missing' }]);
    }, 20_000
  );
});
