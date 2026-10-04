import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationSetHash, type MigrationFile } from './migration-policy.js';

export interface ReleaseToolchain {
  readonly node: string;
  readonly pnpm: string;
  readonly supabase: string;
  readonly wrangler: string;
}

export interface ReleaseManifest {
  readonly schemaVersion: 'miraichi.release.v1';
  readonly sourceSha: string;
  readonly treeId: string;
  readonly migrationHash: string;
  readonly webHash: string;
  readonly edgeHash: string;
  readonly workerHash: string;
  readonly toolchain: ReleaseToolchain;
  readonly builtAt: string;
}

export type CreateReleaseManifestInput = Omit<ReleaseManifest, 'schemaVersion'>;

export interface CreateWorkspaceReleaseManifestInput {
  readonly root: string;
  readonly sourceSha: string;
  readonly treeId: string;
  readonly toolchain: ReleaseToolchain;
  readonly builtAt: string;
}

const GIT_ID = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function requireGitId(value: string, label: string): void {
  if (!GIT_ID.test(value)) throw new Error(`${label} must be a lowercase 40-character Git ID`);
}

function requireSha256(value: string, label: string): void {
  if (!SHA256.test(value)) throw new Error(`${label} must be a lowercase SHA-256`);
}

export function createReleaseManifest(input: CreateReleaseManifestInput): ReleaseManifest {
  requireGitId(input.sourceSha, 'Release source SHA');
  requireGitId(input.treeId, 'Release tree ID');
  requireSha256(input.migrationHash, 'Migration hash');
  requireSha256(input.webHash, 'Web hash');
  requireSha256(input.edgeHash, 'Edge hash');
  requireSha256(input.workerHash, 'Worker hash');
  if (!Number.isFinite(Date.parse(input.builtAt))) throw new Error('Release build timestamp must be ISO datetime');
  for (const [name, version] of Object.entries(input.toolchain)) {
    if (!version.trim()) throw new Error(`Release toolchain ${name} version is required`);
  }
  return { schemaVersion: 'miraichi.release.v1', ...input };
}

export function canonicalReleaseManifest(manifest: ReleaseManifest): string {
  return JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    sourceSha: manifest.sourceSha,
    treeId: manifest.treeId,
    migrationHash: manifest.migrationHash,
    webHash: manifest.webHash,
    edgeHash: manifest.edgeHash,
    workerHash: manifest.workerHash,
    toolchain: {
      node: manifest.toolchain.node,
      pnpm: manifest.toolchain.pnpm,
      supabase: manifest.toolchain.supabase,
      wrangler: manifest.toolchain.wrangler
    },
    builtAt: manifest.builtAt
  });
}

async function filesBelow(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Release artifact tree must not contain symbolic links');
    if (entry.isDirectory()) files.push(...await filesBelow(root, absolute));
    else if (entry.isFile()) files.push(path.relative(root, absolute).replace(/\\/gu, '/'));
  }
  return files;
}

export async function sha256FileTree(
  root: string,
  options: { readonly exclude?: readonly string[] } = {}
): Promise<string> {
  const excluded = new Set((options.exclude ?? []).map((item) => item.replace(/\\/gu, '/')));
  const files = (await filesBelow(root)).filter((file) => !excluded.has(file)).sort();
  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(file, 'utf8');
    digest.update('\0');
    digest.update(await readFile(path.join(root, file)));
    digest.update('\0');
  }
  return digest.digest('hex');
}

async function sha256File(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function workspaceMigrations(root: string): Promise<MigrationFile[]> {
  const directory = path.join(root, 'supabase', 'migrations');
  const files = (await readdir(directory))
    .filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(file))
    .sort();
  return Promise.all(files.map(async (file) => ({
    path: `supabase/migrations/${file}`,
    sql: await readFile(path.join(directory, file), 'utf8'),
    change: 'unchanged' as const
  })));
}

export async function createWorkspaceReleaseManifest(
  input: CreateWorkspaceReleaseManifestInput
): Promise<ReleaseManifest> {
  const root = path.resolve(input.root);
  const serviceWorker = await readFile(path.join(root, 'apps', 'web', 'dist', 'service-worker.js'), 'utf8');
  const webHashes = [...serviceWorker.matchAll(/miraichi-shell-([a-f0-9]{64})/gu)].map((match) => match[1]!);
  if (new Set(webHashes).size !== 1) throw new Error('Built web artifact identity is missing or ambiguous');
  const webHash = webHashes[0]!;
  const edgeHash = await sha256File(path.join(
    root, 'supabase', 'functions', '_shared', 'generated', 'miraichi-edge-runtime.js'
  ));
  const gatewayRoot = path.join(root, 'apps', 'cloudflare-gateway');
  const gatewaySourceHash = await sha256FileTree(path.join(gatewayRoot, 'src'));
  const gatewayConfigHash = await sha256File(path.join(gatewayRoot, 'wrangler.jsonc'));
  const gatewayPackageHash = await sha256File(path.join(gatewayRoot, 'package.json'));
  const workerHash = createHash('sha256').update(JSON.stringify({
    gatewaySourceHash, gatewayConfigHash, gatewayPackageHash, webHash
  }), 'utf8').digest('hex');
  return createReleaseManifest({
    sourceSha: input.sourceSha,
    treeId: input.treeId,
    migrationHash: migrationSetHash(await workspaceMigrations(root)),
    webHash,
    edgeHash,
    workerHash,
    toolchain: { ...input.toolchain },
    builtAt: input.builtAt
  });
}

interface RootPackageJson {
  readonly packageManager?: string;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

async function createWorkspaceManifestCli(outputFile: string): Promise<void> {
  const root = path.resolve(process.env.GITHUB_WORKSPACE?.trim() || process.cwd());
  const git = (args: readonly string[]) => execFileSync('git', [...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']
  }).trim();
  const headSha = git(['rev-parse', 'HEAD']);
  const sourceSha = process.env.GITHUB_SHA?.trim() || headSha;
  if (sourceSha !== headSha) throw new Error('Workspace SHA does not match GITHUB_SHA');
  const rootPackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as RootPackageJson;
  const gatewayPackage = JSON.parse(
    await readFile(path.join(root, 'apps', 'cloudflare-gateway', 'package.json'), 'utf8')
  ) as RootPackageJson;
  const pnpm = /^pnpm@(.+)$/u.exec(rootPackage.packageManager ?? '')?.[1];
  const supabase = rootPackage.devDependencies?.supabase;
  const wrangler = gatewayPackage.devDependencies?.wrangler;
  if (!pnpm || !supabase || !wrangler) throw new Error('Pinned release toolchain versions are missing');
  const manifest = await createWorkspaceReleaseManifest({
    root,
    sourceSha,
    treeId: git(['rev-parse', 'HEAD^{tree}']),
    toolchain: { node: process.versions.node, pnpm, supabase, wrangler },
    builtAt: new Date().toISOString()
  });
  const destination = path.resolve(root, outputFile);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${canonicalReleaseManifest(manifest)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ status: 'created', sourceSha: manifest.sourceSha, treeId: manifest.treeId }));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  void (async () => {
    if (process.argv[2] !== 'create-workspace' || !process.argv[3] || process.argv.length !== 4) {
      throw new Error('Usage: release-manifest.ts create-workspace <output-file>');
    }
    await createWorkspaceManifestCli(process.argv[3]);
  })().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'release_manifest_creation_failed' }));
    process.exitCode = 1;
  });
}
