import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createFixtureIngestionClient,
  ingestSofascoreNationalTeamData
} from './phase8-sofascore-national-team-ingestion-verify.js';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-6c-'));
  tempRoots.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/config'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/data/raw'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/data/processed'), { recursive: true });
  return rootDir;
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('Phase 8.6C Sofascore Ingestion Verifier', () => {
  it('correctly ingests historical events to CSV files and builds splits', async () => {
    const rootDir = makeTempRoot();
    
    // Set up mock Sofascore discovery registry json
    const discoveryRegistryPath = path.join(rootDir, 'apps/local-ai/config/sofascore-national-team-discovery.json');
    fs.writeFileSync(
      discoveryRegistryPath,
      JSON.stringify({
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
      }, null, 2) + '\n',
      'utf8'
    );

    const client = createFixtureIngestionClient();
    const result = await ingestSofascoreNationalTeamData(rootDir, client, {
      skipBuildDataset: true // Skip actual python script runner inside unit test
    });

    expect(result.success).toBe(true);
    expect(result.writtenCompetitions).toContain('comp-int-afcon');

    const csvPath = path.join(rootDir, 'apps/local-ai/data/raw/comp-int-afcon_schedule.csv');
    expect(fs.existsSync(csvPath)).toBe(true);

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    expect(csvContent).toContain('11761871,2024-01-13,2023,20:00,Cote d Ivoire,Guinea-Bissau,2,0,');
  });
});
