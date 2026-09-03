import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface EdgeRuntimeSmokeArgs {
  readonly scope: 'postgres';
}

export interface EdgeRuntimeSmokeResult {
  readonly scope: 'postgres';
  readonly parameterizedQuery: boolean;
  readonly rollback: boolean;
  readonly commit: boolean;
  readonly cleanup: boolean;
}

export function parseEdgeRuntimeSmokeArgs(args: readonly string[]): EdgeRuntimeSmokeArgs {
  const scopeIndex = args.indexOf('--scope');
  const scope = scopeIndex >= 0 ? args[scopeIndex + 1] : undefined;
  if (scope !== 'postgres') throw new Error(`Unsupported Edge runtime smoke scope: ${scope ?? 'missing'}`);
  return { scope };
}

export async function runEdgeRuntimeSmoke(options: {
  readonly scope: 'postgres';
  readonly functionUrl: string;
  readonly gatewayToken: string;
  readonly fetcher?: typeof fetch;
}): Promise<EdgeRuntimeSmokeResult> {
  if (Buffer.byteLength(options.gatewayToken, 'utf8') < 32) {
    throw new Error('MIRAICHI_GATEWAY_TOKEN must be at least 32 bytes');
  }
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(`${options.functionUrl.replace(/\/$/, '')}/__runtime-smoke/postgres`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-miraichi-gateway-token': options.gatewayToken
    },
    body: JSON.stringify({ marker: randomUUID() })
  });
  if (!response.ok) throw new Error(`Edge postgres smoke failed with HTTP ${response.status}`);
  const result = await response.json() as Partial<EdgeRuntimeSmokeResult>;
  if (result.scope !== options.scope
    || result.parameterizedQuery !== true
    || result.rollback !== true
    || result.commit !== true
    || result.cleanup !== true) {
    throw new Error('Edge postgres smoke did not prove all gates');
  }
  return result as EdgeRuntimeSmokeResult;
}

function readLocalSecrets(file: string): Record<string, string> {
  if (!existsSync(file)) throw new Error(`Local Edge env file does not exist: ${file}`);
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const separator = trimmed.indexOf('=');
    if (separator < 1) return [];
    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]];
  }));
}

async function main(): Promise<void> {
  const args = parseEdgeRuntimeSmokeArgs(process.argv.slice(2));
  const secrets = readLocalSecrets(path.resolve('.secrets/edge.local.env'));
  const result = await runEdgeRuntimeSmoke({
    ...args,
    functionUrl: process.env.MIRAICHI_EDGE_FUNCTION_URL
      ?? 'http://127.0.0.1:15421/functions/v1/miraichi-api',
    gatewayToken: process.env.MIRAICHI_GATEWAY_TOKEN ?? secrets.MIRAICHI_GATEWAY_TOKEN ?? ''
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
