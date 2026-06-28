import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  actualOutcomeFromScores,
  loadEvaluationDataset,
  type ProcessedMatchRecord
} from './evaluation-dataset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase 8.3 evaluation dataset loader', () => {
  it('maps completed match scores to 1X2 outcomes', () => {
    expect(actualOutcomeFromScores({ homeScore: 2, awayScore: 0 })).toBe('home');
    expect(actualOutcomeFromScores({ homeScore: 1, awayScore: 1 })).toBe('draw');
    expect(actualOutcomeFromScores({ homeScore: 0, awayScore: 3 })).toBe('away');
  });

  it('loads the existing World Cup processed dataset with chronological split labels', () => {
    const dataset = loadEvaluationDataset(
      path.resolve(__dirname, '../../data/processed/comp-int-world-cup')
    );

    expect(dataset.competitionId).toBe('comp-int-world-cup');
    expect(dataset.train).toHaveLength(1);
    expect(dataset.validation).toHaveLength(1);
    expect(dataset.test).toHaveLength(1);
    expect(dataset.test[0]).toEqual(
      expect.objectContaining({
        matchId: 'match-wc-2022-sample-1',
        split: 'test',
        actualOutcome: 'home'
      })
    );
    expect(dataset.skippedRecordCount).toBe(0);
  });

  it('skips records without completed scores instead of inventing labels', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp-evaluation-dataset-'));
    const record: ProcessedMatchRecord = {
      id: 'match-scheduled',
      competitionId: 'comp-int-world-cup',
      seasonId: 'season-2026',
      homeTeamId: 'team-home-national',
      awayTeamId: 'team-away-national',
      status: 'scheduled',
      kickoffTime: '2026-06-28T12:00:00Z',
      scores: null
    };

    fs.writeFileSync(path.join(tmpDir, 'train.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'val.jsonl'), '', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'test.jsonl'), '', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, 'metadata.json'),
      JSON.stringify({
        datasetId: 'dataset-test',
        competitionId: 'comp-int-world-cup',
        schemaVersion: '1.0.0',
        featureSpecVersion: 'feature-spec-v0.1.0',
        sourceProviderId: 'test',
        sourceSnapshotHash: 'hash',
        builtAt: '2026-06-28T00:00:00Z',
        trainCount: 1,
        valCount: 0,
        testCount: 0
      }),
      'utf8'
    );

    const dataset = loadEvaluationDataset(tmpDir);

    expect(dataset.train).toEqual([]);
    expect(dataset.skippedRecordCount).toBe(1);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
