import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildSupabaseEdgeFunction } from './build-supabase-edge-function.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true
  })));
});

describe('Supabase Edge function bundle', () => {
  it('builds one deterministic ESM runtime and metadata below the requested output root', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-edge-build-'));
    temporaryDirectories.push(outputRoot);

    const result = await buildSupabaseEdgeFunction({ rootDir: process.cwd(), outputRoot });
    expect(result.outputFile).toBe(path.join(outputRoot, 'miraichi-edge-runtime.js'));
    expect(result.metadataFile).toBe(path.join(outputRoot, 'miraichi-edge-runtime.meta.json'));
    expect(await readFile(result.outputFile, 'utf8')).toContain('createEdgeRequestHandler');
    const metadata = JSON.parse(await readFile(result.metadataFile, 'utf8')) as { inputs: object };
    expect(Object.keys(metadata.inputs)).toContain('apps/api/src/runtime/edge-runtime-composition.ts');
  });
});
