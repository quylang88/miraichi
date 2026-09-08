import { existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLOUDFLARE_MAX_FILES = 20_000;
const CLOUDFLARE_MAX_FILE_BYTES = 25 * 1024 * 1024;
const CURRENT_BASELINE_FILE_COUNT = 64;

export interface StaticArtifactInventory {
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly largestFileBytes: number;
}

export interface CloudflareAssetsConfig {
  readonly deploymentEnvironments: readonly ['staging'];
  readonly directory: string;
  readonly binding: 'ASSETS';
  readonly notFoundHandling: 'single-page-application';
  readonly runWorkerFirst: readonly ['/api', '/api/*'];
}

function filesBelow(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(absolute) : entry.isFile() ? [absolute] : [];
  });
}

export function inspectCloudflareStaticArtifact(options: {
  readonly distDir: string;
  readonly expectedFileCount?: number;
  readonly maxFiles?: number;
  readonly maxFileBytes?: number;
}): StaticArtifactInventory {
  const expectedFileCount = options.expectedFileCount ?? CURRENT_BASELINE_FILE_COUNT;
  const maxFiles = options.maxFiles ?? CLOUDFLARE_MAX_FILES;
  const maxFileBytes = options.maxFileBytes ?? CLOUDFLARE_MAX_FILE_BYTES;
  if (!existsSync(options.distDir)) throw new Error('Cloudflare static artifact is missing');
  const files = filesBelow(options.distDir);
  if (files.length !== expectedFileCount) {
    throw new Error(`Cloudflare static artifact expected ${expectedFileCount} files but found ${files.length}`);
  }
  if (files.length >= maxFiles) throw new Error('Cloudflare static artifact exceeds the file-count limit');
  const sizes = files.map((file) => statSync(file).size);
  const largestFileBytes = Math.max(0, ...sizes);
  if (largestFileBytes > maxFileBytes) {
    throw new Error('Cloudflare static artifact exceeds the 25 MiB-compatible file limit');
  }
  for (const file of files.filter((candidate) => /\.(?:html|js|json)$/i.test(candidate))) {
    const source = readFileSync(file, 'utf8');
    if (/\bAPI_URL\s*:\s*["']https?:\/\//u.test(source)) {
      throw new Error('Cloudflare static artifact must use the same-origin API');
    }
  }
  return {
    fileCount: files.length,
    totalBytes: sizes.reduce((sum, size) => sum + size, 0),
    largestFileBytes
  };
}

export function readCloudflareAssetsConfig(configFile: string): CloudflareAssetsConfig {
  const parsed = JSON.parse(readFileSync(configFile, 'utf8')) as {
    assets?: Record<string, unknown>;
    env?: Record<string, unknown>;
  };
  const assets = parsed.assets;
  const staging = parsed.env?.staging;
  if (!staging || typeof staging !== 'object' || Array.isArray(staging)
    || !assets
    || assets.directory !== '../web/dist'
    || assets.binding !== 'ASSETS'
    || assets.not_found_handling !== 'single-page-application'
    || !Array.isArray(assets.run_worker_first)
    || assets.run_worker_first.length !== 2
    || assets.run_worker_first[0] !== '/api'
    || assets.run_worker_first[1] !== '/api/*') {
    throw new Error('Cloudflare Static Assets configuration is not exact');
  }
  return {
    deploymentEnvironments: ['staging'],
    directory: '../web/dist',
    binding: 'ASSETS',
    notFoundHandling: 'single-page-application',
    runWorkerFirst: ['/api', '/api/*']
  };
}

interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

type CommandRunner = (command: string, args: readonly string[], cwd: string) => CommandResult;

const defaultCommandRunner: CommandRunner = (command, args, cwd) => {
  const pnpmCli = command === 'pnpm' ? process.env.npm_execpath : undefined;
  const executable = pnpmCli ? process.execPath : command;
  const executableArgs = pnpmCli ? [pnpmCli, ...args] : [...args];
  const result = spawnSync(executable, executableArgs, {
    cwd,
    encoding: 'utf8',
    shell: false
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
};

export function verifyCloudflareOwnerHosting(options: {
  readonly rootDir?: string;
  readonly expectedFileCount?: number;
  readonly runCommand?: CommandRunner;
} = {}): StaticArtifactInventory {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const gatewayDir = path.join(rootDir, 'apps/cloudflare-gateway');
  const distDir = path.join(rootDir, 'apps/web/dist');
  const inventory = inspectCloudflareStaticArtifact({
    distDir,
    expectedFileCount: options.expectedFileCount ?? CURRENT_BASELINE_FILE_COUNT
  });
  readCloudflareAssetsConfig(path.join(gatewayDir, 'wrangler.jsonc'));
  const outDir = path.join(rootDir, 'artifacts/cloudflare-dry-run');
  mkdirSync(outDir, { recursive: true });
  const result = (options.runCommand ?? defaultCommandRunner)('pnpm', [
    '--filter', '@miraichi/cloudflare-gateway', 'exec', 'wrangler',
    'deploy', '--dry-run', '--outdir', outDir
  ], rootDir);
  if (result.status !== 0) throw new Error('Wrangler dry-run failed');
  return inventory;
}

function main(): void {
  const result = verifyCloudflareOwnerHosting();
  console.log(JSON.stringify({ status: 'passed', ...result }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
