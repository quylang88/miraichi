import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OPENFOOTBALL_SOURCE_REGISTRY } from '../packages/config/src/openfootball-source-registry.js';
import {
  runOpenFootballIngestionJob,
  type OpenFootballIngestionJobOptions,
  type OpenFootballIngestionRunResult
} from '../apps/worker/src/jobs/openfootball-ingestion-job.js';

export interface CaptureOpenFootballCommandDependencies {
  args: string[];
  runJob: (options: OpenFootballIngestionJobOptions) => Promise<OpenFootballIngestionRunResult>;
}

export async function runCaptureOpenFootballCommand(
  dependencies: CaptureOpenFootballCommandDependencies
): Promise<0 | 1 | 2> {
  const dataRoot = parseDataRoot(dependencies.args);
  if (dataRoot === null) return 2;

  try {
    const result = await dependencies.runJob({
      dataRoot,
      sources: OPENFOOTBALL_SOURCE_REGISTRY,
      now: () => new Date()
    });
    return result.status === 'failed' ? 1 : 0;
  } catch {
    return 1;
  }
}

function parseDataRoot(args: readonly string[]): string | null {
  if (args.length === 0) return defaultDataRoot();
  if (args.length !== 2 || args[0] !== '--data-root') return null;
  const dataRoot = args[1];
  return dataRoot !== undefined && path.isAbsolute(dataRoot) ? dataRoot : null;
}

function defaultDataRoot(): string {
  const workspaceRoot = fileURLToPath(new URL('../', import.meta.url));
  return path.resolve(workspaceRoot, 'apps/api/data');
}

async function main(): Promise<void> {
  process.exitCode = await runCaptureOpenFootballCommand({
    args: process.argv.slice(2),
    runJob: runOpenFootballIngestionJob
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main();
}
