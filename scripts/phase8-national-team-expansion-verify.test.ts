import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateExpansionReport } from './phase8-national-team-expansion-verify.js';

type SplitName = 'train' | 'val' | 'test';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-3a-'));
  tempRoots.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/config'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/data/processed'), { recursive: true });
  return rootDir;
}

function writeRegistry(rootDir: string): void {
  fs.writeFileSync(
    path.join(rootDir, 'apps/local-ai/config/competition-registry.json'),
    `${JSON.stringify({
      initialCompetitionId: 'comp-int-world-cup',
      competitions: [
        {
          competition_id: 'comp-int-world-cup',
          soccerdata_league: 'INT-World Cup',
          competition_type: 'national_team',
          provider_status: 'supported',
          enabled: true
        },
        {
          competition_id: 'comp-int-euro',
          soccerdata_league: 'INT-European Championship',
          competition_type: 'national_team',
          provider_status: 'supported',
          enabled: true
        }
      ]
    }, null, 2)}\n`,
    'utf8'
  );
}

function makeRecord(competitionId: string, split: SplitName, index: number) {
  return {
    id: `match-${competitionId}-${split}-${index}`,
    competitionId,
    seasonId: `season-${split}`,
    homeTeamId: 'team-home-national',
    awayTeamId: 'team-away-national',
    status: 'completed',
    kickoffTime: '2024-06-10T20:00:00Z',
    scores: { homeScore: 2, awayScore: 1 }
  };
}

function writeJsonl(filePath: string, records: readonly unknown[]): void {
  fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
}

function writeProcessedCompetition(
  rootDir: string,
  competitionId: string,
  counts: { train: number; val: number; test: number },
  quality: { rejectedCount: number; warnings: string[] } = { rejectedCount: 0, warnings: [] }
): void {
  const processedDir = path.join(rootDir, 'apps/local-ai/data/processed', competitionId);
  fs.mkdirSync(processedDir, { recursive: true });

  writeJsonl(
    path.join(processedDir, 'train.jsonl'),
    Array.from({ length: counts.train }, (_, index) => makeRecord(competitionId, 'train', index))
  );
  writeJsonl(
    path.join(processedDir, 'val.jsonl'),
    Array.from({ length: counts.val }, (_, index) => makeRecord(competitionId, 'val', index))
  );
  writeJsonl(
    path.join(processedDir, 'test.jsonl'),
    Array.from({ length: counts.test }, (_, index) => makeRecord(competitionId, 'test', index))
  );

  fs.writeFileSync(
    path.join(processedDir, 'metadata.json'),
    `${JSON.stringify({
      datasetId: `dataset-${competitionId}`,
      competitionId,
      schemaVersion: '1.0.0',
      featureSpecVersion: 'feature-spec-v0.1.0',
      sourceProviderId: 'soccerdata-fbref',
      sourceSnapshotHash: `hash-${competitionId}`,
      builtAt: '2026-06-28T00:00:00Z',
      trainCount: counts.train,
      valCount: counts.val,
      testCount: counts.test
    }, null, 2)}\n`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(processedDir, 'quality_report.json'),
    `${JSON.stringify({
      processedCount: counts.train + counts.val + counts.test + quality.rejectedCount,
      rejectedCount: quality.rejectedCount,
      trainCount: counts.train,
      valCount: counts.val,
      testCount: counts.test,
      warnings: quality.warnings
    }, null, 2)}\n`,
    'utf8'
  );
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('Phase 8.3A national-team expansion verifier', () => {
  it('blocks Phase 8.4 when an enabled competition has an empty validation split and quality warnings', () => {
    const rootDir = makeTempRoot();
    writeRegistry(rootDir);
    writeProcessedCompetition(rootDir, 'comp-int-world-cup', { train: 10, val: 10, test: 100 });
    writeProcessedCompetition(
      rootDir,
      'comp-int-euro',
      { train: 10, val: 0, test: 10 },
      { rejectedCount: 51, warnings: ['Row 51: Season 2020 not in splits configuration.'] }
    );

    const { report } = generateExpansionReport(rootDir);

    expect(report.phase84DataReady).toBe(false);
    expect(report.status).toBe('blocked_for_phase_8_4');
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        'comp-int-euro validation split has 0 scored fixtures.',
        'comp-int-euro quality report has 51 rejected records.',
        'comp-int-euro quality report has 1 warning.'
      ])
    );
  });

  it('passes when every enabled national-team competition has non-empty clean splits and aggregate test count is ready', () => {
    const rootDir = makeTempRoot();
    writeRegistry(rootDir);
    writeProcessedCompetition(rootDir, 'comp-int-world-cup', { train: 10, val: 10, test: 64 });
    writeProcessedCompetition(rootDir, 'comp-int-euro', { train: 10, val: 10, test: 51 });

    const { report } = generateExpansionReport(rootDir);

    expect(report.phase84DataReady).toBe(true);
    expect(report.status).toBe('pass');
    expect(report.totalValidationCount).toBe(20);
    expect(report.totalTestCount).toBe(115);
    expect(report.warnings).toEqual([]);
  });
});
