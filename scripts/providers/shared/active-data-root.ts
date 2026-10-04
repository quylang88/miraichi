import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readServingMatchStoreSnapshot } from '../../../apps/api/src/repositories/serving-match-store.js';

export function defaultOwnerActiveDataRoot(): string {
  return path.join(workspaceRoot(), 'apps', 'api', 'data');
}

export async function assertBootstrappedOwnerActiveDataRoot(options: {
  dataRoot: string;
  activeDataRoot?: string;
}): Promise<string> {
  const dataRoot = assertNarrowDataRoot(options.dataRoot, 'Owner active data root');
  const activeDataRoot = assertNarrowDataRoot(
    options.activeDataRoot ?? defaultOwnerActiveDataRoot(),
    'Configured owner active data root'
  );
  if (dataRoot !== activeDataRoot) {
    throw new Error('Owner-local runtime may target only the configured apps/api/data root.');
  }
  try {
    const snapshot = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    if (snapshot.matches.length === 0) throw new Error('empty');
  } catch {
    throw new Error('Active data root must contain a validated non-empty serving snapshot.');
  }
  return dataRoot;
}

function assertNarrowDataRoot(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty path.`);
  }
  const resolved = path.resolve(value);
  const volumeRoot = path.parse(resolved).root;
  const depth = path.relative(volumeRoot, resolved).split(path.sep).filter(Boolean).length;
  if (resolved === volumeRoot || resolved === workspaceRoot() || depth < 2) {
    throw new Error(`${label} must not be a filesystem or workspace root.`);
  }
  return resolved;
}

function workspaceRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}
