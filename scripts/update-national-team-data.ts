import * as fs from 'fs/promises';
import * as path from 'path';
import {
  LocalMatch,
  LocalMatchStatus,
  LocalDataSourceId,
  validateLocalMatch,
  ValidationResult
} from '../packages/shared/src/contracts/local-match-contracts.js';

export interface UpdateNationalTeamDataOptions {
  inputPath: string;
  outputPath: string;
  now?: () => Date;
}

export interface ValidateNationalTeamSnapshotFileOptions {
  snapshotPath: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function assertIsoDateTime(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !ISO_DATETIME_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid ISO datetime string`);
  }
  return value;
}

function compareMatches(a: LocalMatch, b: LocalMatch): number {
  const aCompleted = a.status === 'completed';
  const bCompleted = b.status === 'completed';

  if (!aCompleted && bCompleted) {
    return -1;
  }
  if (aCompleted && !bCompleted) {
    return 1;
  }

  if (!aCompleted && !bCompleted) {
    return new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime();
  }

  return new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime();
}

export async function updateNationalTeamData(
  options: UpdateNationalTeamDataOptions
): Promise<{ outputPath: string; matchCount: number; snapshotId: string }> {
  const now = options.now || (() => new Date());
  const nowStr = now().toISOString();

  // Read input
  const inputContent = await fs.readFile(options.inputPath, 'utf-8');
  const seed = JSON.parse(inputContent);

  if (!seed || typeof seed !== 'object') {
    throw new Error('Seed input is not a valid JSON object');
  }

  const sourceBatchId = seed.sourceBatchId || `manual-snapshot-${nowStr.slice(0, 10)}`;
  const snapshotId = `snapshot-${sourceBatchId}`;

  const sources = Array.isArray(seed.sources)
    ? seed.sources.map((src: Record<string, unknown>) => ({
        sourceId: src.sourceId as LocalDataSourceId,
        sourceUrl: src.sourceUrl as string,
        importedAt: (src.importedAt as string) || nowStr
      }))
    : [];

  // Process matches
  if (!Array.isArray(seed.matches)) {
    throw new Error('Seed input matches is not an array');
  }

  const matches: LocalMatch[] = seed.matches.map((m: Record<string, unknown>) => {
    // Normalize updatedAt
    const updatedAt = (m.updatedAt as string) || nowStr;

    // Normalize sourceRefs
    const sourceRefs = Array.isArray(m.sourceRefs)
      ? m.sourceRefs.map((ref: Record<string, unknown>) => ({
          sourceId: ref.sourceId as LocalDataSourceId,
          sourceMatchId: ref.sourceMatchId as string,
          sourceUrl: ref.sourceUrl as string,
          importedAt: (ref.importedAt as string) || nowStr
        }))
      : [];

    return {
      ...m,
      sourceRefs,
      updatedAt
    };
  });

  // Validate each match
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const validation: ValidationResult = validateLocalMatch(match);
    if (!validation.ok) {
      throw new Error(`Match validation failed at index ${i}: ${validation.errors.join(', ')}`);
    }
  }

  // Sort matches
  matches.sort(compareMatches);

  // Build snapshot
  const snapshot = {
    snapshotId,
    generatedAt: nowStr,
    importedAt: nowStr,
    sources,
    matches
  };

  // Write output
  const outputContent = JSON.stringify(snapshot, null, 2) + '\n';
  await fs.mkdir(path.dirname(options.outputPath), { recursive: true });
  await fs.writeFile(options.outputPath, outputContent, 'utf-8');

  return {
    outputPath: options.outputPath,
    matchCount: matches.length,
    snapshotId
  };
}

export async function validateNationalTeamSnapshotFile(
  options: ValidateNationalTeamSnapshotFileOptions
): Promise<{ snapshotPath: string; matchCount: number; snapshotId: string }> {
  const content = await fs.readFile(options.snapshotPath, 'utf-8');
  const snapshot = JSON.parse(content) as unknown;

  if (!isObject(snapshot)) {
    throw new Error('Snapshot is not a valid JSON object');
  }

  if (typeof snapshot.snapshotId !== 'string' || snapshot.snapshotId.trim() === '') {
    throw new Error('snapshotId must be a non-empty string');
  }
  assertIsoDateTime(snapshot.generatedAt, 'generatedAt');
  assertIsoDateTime(snapshot.importedAt, 'importedAt');

  if (!Array.isArray(snapshot.sources)) {
    throw new Error('sources must be an array');
  }

  if (!Array.isArray(snapshot.matches)) {
    throw new Error('matches must be an array');
  }

  for (let i = 0; i < snapshot.matches.length; i++) {
    const validation = validateLocalMatch(snapshot.matches[i]);
    if (!validation.ok) {
      throw new Error(`Match validation failed at index ${i}: ${validation.errors.join(', ')}`);
    }
  }

  return {
    snapshotPath: options.snapshotPath,
    matchCount: snapshot.matches.length,
    snapshotId: snapshot.snapshotId
  };
}

// CLI entrypoint
async function run() {
  // Simple arg parser
  const args = process.argv.slice(2);
  let inputPath = '';
  let outputPath = '';
  let validateOnly = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = args[i + 1];
    } else if (args[i] === '--output' && args[i + 1]) {
      outputPath = args[i + 1];
    } else if (args[i] === '--validate-only') {
      validateOnly = true;
    }
  }

  // Default paths relative to workspace root
  const rootDir = process.cwd().includes('apps/api') || process.cwd().includes('scripts')
    ? path.resolve(process.cwd(), '..')
    : process.cwd();

  inputPath = inputPath || path.resolve(rootDir, 'apps/api/data/local-match-snapshots/national-team-matches.seed.json');
  outputPath = outputPath || path.resolve(rootDir, 'apps/api/data/local-match-snapshots/national-team-matches.json');

  try {
    if (validateOnly) {
      const result = await validateNationalTeamSnapshotFile({ snapshotPath: outputPath });
      console.log(`Validated national-team snapshot: ${result.matchCount} matches -> ${result.snapshotPath}`);
      return;
    }

    const result = await updateNationalTeamData({ inputPath, outputPath });
    console.log(`Updated national-team snapshot: ${result.matchCount} matches -> ${result.outputPath}`);
  } catch (err) {
    const error = err as Error;
    console.error(`Error running update-national-team-data: ${error.message}`);
    process.exit(1);
  }
}

// Only run CLI if invoked directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith('update-national-team-data.ts') ||
  process.argv[1].endsWith('update-national-team-data.js')
);

if (isMain) {
  void run();
}
