import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { auditProductBoundary } from './product-boundary-verify.js';

async function createFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'miraichi-product-boundary-'));
  await mkdir(join(root, 'apps/api/src'), { recursive: true });
  await mkdir(join(root, 'apps/web/src/config'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: {} }));
  await writeFile(join(root, 'apps/api/src/index.ts'), "const route = '/api/v1/health';\n");
  await writeFile(
    join(root, 'apps/web/src/config/navigation-tabs.ts'),
    "export const PRODUCTION_NAVIGATION_TAB_IDS = Object.freeze(['today', 'matches', 'bets', 'bankroll'] as const);\n"
  );
  return root;
}

describe('product boundary verifier', () => {
  it('reports forbidden product paths, commands, API routes, and navigation tabs', async () => {
    const root = await createFixture();
    await mkdir(join(root, 'apps/local-ai'), { recursive: true });
    await writeFile(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { 'dev:local-ai': 'tsx app.ts', 'data:verify:sportmonks': 'tsx verify.ts' } })
    );
    await writeFile(join(root, 'apps/api/src/index.ts'), "const route = '/api/v1/predictions';\n");
    await writeFile(
      join(root, 'apps/web/src/config/navigation-tabs.ts'),
      "export const PRODUCTION_NAVIGATION_TAB_IDS = Object.freeze(['today', 'matches', 'bets', 'bankroll', 'miraichi'] as const);\n"
    );

    expect(await auditProductBoundary(root)).toEqual(expect.arrayContaining([
      'Forbidden path exists: apps/local-ai',
      'Forbidden package script: dev:local-ai',
      'Forbidden package script: data:verify:sportmonks',
      'Forbidden API route: /api/v1/predictions',
      'Navigation tabs must be exactly: today, matches, bets, bankroll'
    ]));
  });

  it('accepts the four-tab non-AI product boundary', async () => {
    expect(await auditProductBoundary(await createFixture())).toEqual([]);
  });

  it('reports OpenFootball runtime URLs anywhere under the web source tree', async () => {
    const root = await createFixture();
    await writeFile(
      join(root, 'apps/web/src/config/match-source.ts'),
      [
        "export const rawSource = 'https://raw.githubusercontent.com/example/data/main/fixtures.json';",
        "export const repositorySource = 'https://github.com/openfootball/football.json';",
        "export const runtimeSource = 'https://openfootball.example/fixtures.json';"
      ].join('\n')
    );

    expect(await auditProductBoundary(root)).toEqual(expect.arrayContaining([
      expect.stringContaining('raw.githubusercontent.com'),
      expect.stringContaining('github.com/openfootball'),
      expect.stringContaining('openfootball.example')
    ]));
  });
});
