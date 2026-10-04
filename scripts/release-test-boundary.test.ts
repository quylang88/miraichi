import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('release test command boundary', () => {
  it('keeps unit tests separate from integration and bounds filesystem concurrency', async () => {
    const packageJson = JSON.parse(
      await readFile(path.join(process.cwd(), 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    const command = packageJson.scripts?.['test:unit'];

    expect(command).toContain('--exclude "tests/integration/**"');
    expect(command).toContain('--maxWorkers=2');
  });
});
