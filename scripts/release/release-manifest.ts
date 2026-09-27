import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

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
