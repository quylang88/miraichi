import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadApprovedSportScoreContractManifest,
  verifySportScoreOpenApiContract
} from './sportscore-contract-drift.js';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('SportScore approved local OpenAPI contract drift', () => {
  it('matches the reviewed local fixture checksum without network access', async () => {
    const fetchBefore = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = async () => {
      fetchCalled = true;
      throw new Error('Contract verification must not use the network.');
    };
    try {
      const manifest = await loadApprovedSportScoreContractManifest();
      const result = await verifySportScoreOpenApiContract();
      expect(result.sha256).toBe(manifest.sha256);
      expect(result.reviewedAt).toBe('2026-08-26');
      expect(result.fixturePath.endsWith('sportscore-openapi.approved.json')).toBe(true);
      expect(fetchCalled).toBe(false);
    } finally {
      globalThis.fetch = fetchBefore;
    }
  });

  it('fails closed when the approved fixture bytes drift', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'miraichi-sportscore-contract-'));
    roots.push(root);
    const manifest = await loadApprovedSportScoreContractManifest();
    const approved = await readFile(manifest.fixturePath, 'utf8');
    const tamperedPath = path.join(root, 'tampered-openapi.json');
    await writeFile(tamperedPath, `${approved}\n`, 'utf8');

    await expect(verifySportScoreOpenApiContract({
      fixturePath: tamperedPath,
      expectedSha256: manifest.sha256
    })).rejects.toMatchObject({ code: 'sportscore_openapi_checksum_mismatch' });
  });
});
