import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

interface GraphImport {
  readonly path: string;
  readonly kind: string;
}

interface GraphInput {
  readonly bytes: number;
  readonly imports: readonly GraphImport[];
}

export interface EdgeModuleGraph {
  readonly inputs: Readonly<Record<string, GraphInput>>;
  readonly outputs: Readonly<Record<string, unknown>>;
}

const forbiddenInputMarkers = [
  'apps/api/src/index.ts',
  'hosted-static-server',
  'local-match-detail-store',
  'match-detail-refresh-queue',
  'serving-match-store',
  'fallback-match-snapshot-repository',
  'persistence/supabase/postgres-query-client'
] as const;
const forbiddenImports = new Set(['node:fs', 'node:http', 'fs', 'http', 'pg']);

export function inspectSupabaseEdgeModuleGraph(graph: EdgeModuleGraph): string[] {
  const findings: string[] = [];
  for (const [input, details] of Object.entries(graph.inputs)) {
    const normalized = input.replace(/\\/g, '/');
    for (const marker of forbiddenInputMarkers) {
      if (normalized.includes(marker)) findings.push(`forbidden input: ${normalized}`);
    }
    if (/supabase\/functions\/(?!miraichi-api\/|_shared\/)/.test(normalized)) {
      findings.push(`cross-function input: ${normalized}`);
    }
    for (const imported of details.imports) {
      if (forbiddenImports.has(imported.path)) {
        findings.push(`forbidden import: ${normalized} -> ${imported.path}`);
      }
    }
  }
  return [...new Set(findings)].sort();
}

export async function verifySupabaseEdgeModuleGraph(
  metadataFile = path.resolve('supabase/functions/_shared/generated/miraichi-edge-runtime.meta.json')
): Promise<void> {
  const graph = JSON.parse(await readFile(metadataFile, 'utf8')) as EdgeModuleGraph;
  const findings = inspectSupabaseEdgeModuleGraph(graph);
  if (findings.length > 0) throw new Error(`Supabase Edge module graph rejected:\n${findings.join('\n')}`);
}

async function main(): Promise<void> {
  await verifySupabaseEdgeModuleGraph();
  console.log(JSON.stringify({ status: 'passed', graph: 'miraichi-edge-runtime' }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
