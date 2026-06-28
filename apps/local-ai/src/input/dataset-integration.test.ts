import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { NormalizedMatch } from '@miraichi/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Processed Dataset Integration Check', () => {
  it('should conform to the NormalizedMatch TypeScript contract structure', () => {
    const datasetPath = path.resolve(__dirname, '../../data/processed/comp-int-world-cup/train.jsonl');
    
    // Check if pipeline has run and file exists (fails gracefully with advice if not run)
    if (!fs.existsSync(datasetPath)) {
      console.warn("Skipping integration test: train.jsonl does not exist. Run build_dataset.py first.");
      return;
    }
    
    const content = fs.readFileSync(datasetPath, 'utf-8');
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    
    expect(lines.length).toBeGreaterThan(0);
    
    lines.forEach((line, index) => {
      let match: NormalizedMatch;
      try {
        match = JSON.parse(line) as NormalizedMatch;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        throw new Error(`JSON parse failure on line ${index + 1}: ${errMsg}\nLine content: "${line}"`);
      }
      
      // ID / Reference Assertions
      expect(match.id).toBeDefined();
      expect(typeof match.id).toBe('string');
      
      expect(match.competitionId).toBeDefined();
      expect(typeof match.competitionId).toBe('string');
      
      expect(match.seasonId).toBeDefined();
      expect(typeof match.seasonId).toBe('string');
      
      expect(match.homeTeamId).toBeDefined();
      expect(typeof match.homeTeamId).toBe('string');
      
      expect(match.awayTeamId).toBeDefined();
      expect(typeof match.awayTeamId).toBe('string');
      
      // Status and Time Format Assertions
      expect(match.status).toMatch(/^(scheduled|in_play|completed)$/);
      expect(match.kickoffTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      
      // Scores Structure & Bounds Checks (integers >= 0)
      if (match.scores) {
        expect(typeof match.scores.homeScore).toBe('number');
        expect(Number.isInteger(match.scores.homeScore)).toBe(true);
        expect(match.scores.homeScore).toBeGreaterThanOrEqual(0);
        
        expect(typeof match.scores.awayScore).toBe('number');
        expect(Number.isInteger(match.scores.awayScore)).toBe(true);
        expect(match.scores.awayScore).toBeGreaterThanOrEqual(0);
      }
      
      // Optional Venue Name Check
      if (match.venueName !== undefined && match.venueName !== null) {
        expect(typeof match.venueName).toBe('string');
      }
    });
  });
});
