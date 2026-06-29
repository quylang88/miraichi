import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFixtureDiscoveryClient,
  generatePhase86BReports
} from './phase8-sofascore-national-team-discovery-verify.js';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-6b-'));
  tempRoots.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/config'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/reports'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'docs/data'), { recursive: true });
  return rootDir;
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('Phase 8.6B Sofascore verifier', () => {
  it('writes discovery, odds, and Markdown artifacts without touching processed datasets', async () => {
    const rootDir = makeTempRoot();
    const registryPath = path.join(rootDir, 'apps/local-ai/config/sofascore-national-team-discovery.json');
    fs.writeFileSync(
      registryPath,
      `${JSON.stringify({
        providerId: 'sofascore-direct',
        phase: '8.6B',
        competitions: [
          {
            competitionId: 'comp-int-afcon',
            displayName: 'Africa Cup of Nations',
            competitionType: 'national_team',
            gender: 'men',
            seniority: 'senior',
            sofascoreUniqueTournamentId: 270,
            enabledForDiscovery: true,
            minimumCompletedSeasonsForFutureIngestion: 2
          }
        ]
      }, null, 2)}\n`,
      'utf8'
    );

    const result = await generatePhase86BReports(rootDir, createFixtureDiscoveryClient());

    expect(result.discoveryReport.status).toBe('pass');
    expect(result.oddsReport.bookmakerBaselineAvailableNow).toBe(false);
    expect(fs.existsSync(path.join(rootDir, 'apps/local-ai/reports/phase-8-6b-sofascore-national-team-source-discovery.json'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'apps/local-ai/reports/phase-8-6b-odds-baseline-source-discovery.json'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'docs/data/PHASE-8-6B-SOFASCORE-NATIONAL-TEAM-SOURCE-DISCOVERY.md'))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, 'apps/local-ai/data/processed'))).toBe(false);
  });
});
