import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { getReleaseTarget } from '../../packages/config/src/release-targets.js';
import { createReleaseManifest } from './release-manifest.js';
import { createCliReleaseOperations, type CliReleaseConfig } from './deploy-release.js';
import type { CommandRunner } from './command-runner.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const manifest = createReleaseManifest({
  sourceSha: 'a'.repeat(40), treeId: 'b'.repeat(40), migrationHash: hash('migrations'),
  webHash: hash('web'), edgeHash: hash('edge'), workerHash: hash('worker'),
  toolchain: { node: '22.20.0', pnpm: '10.18.3', supabase: '2.109.0', wrangler: '4.128.0' },
  builtAt: '2026-09-28T00:00:00.000Z'
});
const config: CliReleaseConfig = {
  root: 'C:/workspace', target: getReleaseTarget('production'), branch: 'main',
  checkedOutSha: manifest.sourceSha,
  candidateSha: manifest.sourceSha,
  manifest, artifactVersion: 'candidate-a', projectRef: 'abcdefghijklmnopqrst',
  publicOrigin: 'https://miraichi-production.workers.dev',
  edgeFunctionUrl: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/miraichi-api',
  edgeGatewayToken: 'gateway-token-with-at-least-32-bytes',
  priorEdgeArtifactRoot: 'C:/artifacts/edge-old',
  priorVersions: { edgeVersionId: 'edge-old', workerVersionId: 'worker-old' }
};

describe('release CLI adapters', () => {
  it('ships a region-aware compatible scheduler contract for staging and production', () => {
    const file = readdirSync(path.join(process.cwd(), 'supabase', 'migrations'))
      .find((candidate) => candidate.endsWith('_region_aware_hosted_scheduler.sql'));
    expect(file).toBeTruthy();
    const sql = readFileSync(path.join(process.cwd(), 'supabase', 'migrations', file!), 'utf8');
    expect(sql).toContain('miraichi_app.configure_hosted_refresh(edge_region text)');
    expect(sql).toContain("edge_region not in ('eu-central-1','ap-southeast-1')");
    expect(sql).toContain('miraichi_app.invoke_hosted_refresh(refresh_kind text, edge_region text)');
    expect(sql).not.toContain('qpexxwmrnreooxftfucv');
    expect(sql.match(/miraichi_edge_function_url/gu)).toHaveLength(1);
    expect(sql).not.toContain('miraichi_edge_region');
  });

  it('uses pinned argument arrays, exact rollback versions, and region-aware scheduler SQL', async () => {
    const calls: Array<{ command: string; args: readonly string[] }> = [];
    const runner: CommandRunner = {
      run: vi.fn(async (command, args) => {
        calls.push({ command, args });
        return {
          stdout: command === 'git' ? `${manifest.sourceSha}\n${manifest.treeId}\n`
            : args.includes('deploy') && args.includes('wrangler') ? 'Current Version ID: worker-new' : '',
          stderr: '', exitCode: 0 as const
        };
      })
    };
    const operations = createCliReleaseOperations(config, {
      runner,
      backup: async () => ({ receiptId: 'receipt-1', ciphertextSha256: hash('cipher'), storedBytes: 1, recordCounts: { ownerProfiles: 0, betDrafts: 0, bets: 0, bankrollAccounts: 0, bankrollLedgerEntries: 0, disciplineConfigs: 0, settlementEvents: 0 } }),
      smoke: async () => ({ status: 'passed', checks: 10, edgeRegion: 'ap-southeast-1', releaseSha: manifest.sourceSha, schedulerTargetSha256: hash(config.edgeFunctionUrl) }),
      recordEvidence: async () => undefined
    });
    await operations.validate({ ...config, target: config.target } as never);
    await operations.migrationDryRun();
    await operations.applyMigrations();
    expect(await operations.deployEdge()).toEqual({ versionId: manifest.edgeHash });
    await operations.rollbackEdge('edge-old');
    expect(await operations.deployWorker()).toEqual({ versionId: 'worker-new' });
    await operations.rollbackWorker('worker-old');
    await operations.configureScheduler();
    await operations.pauseScheduler();

    const flattened = calls.map((call) => [call.command, ...call.args]);
    expect(flattened).toEqual(expect.arrayContaining([
      expect.arrayContaining(['db', 'push', '--linked', '--dry-run', '--include-all', '--yes']),
      expect.arrayContaining(['db', 'push', '--linked', '--include-all', '--yes']),
      expect.arrayContaining(['functions', 'deploy', 'miraichi-api', '--project-ref', config.projectRef, '--use-api']),
      expect.arrayContaining(['--workdir', config.priorEdgeArtifactRoot]),
      expect.arrayContaining(['wrangler', 'rollback', 'worker-old', '--env', 'production', '--yes']),
      expect.arrayContaining(['db', 'query', '--linked', "select miraichi_app.configure_hosted_refresh('ap-southeast-1');"]),
      expect.arrayContaining(['db', 'query', '--linked', 'select miraichi_app.unschedule_hosted_refresh();'])
    ]));
    expect(JSON.stringify(flattened)).not.toContain('latest');
    expect(JSON.stringify(flattened)).not.toContain(config.edgeGatewayToken);
  });

  it('rejects crossed target bindings and latest rollback inputs before commands run', async () => {
    const runner: CommandRunner = { run: vi.fn(async () => ({ stdout: '', stderr: '', exitCode: 0 as const })) };
    expect(() => createCliReleaseOperations({ ...config, branch: 'staging' }, { runner })).toThrow('approved target');
    expect(() => createCliReleaseOperations({
      ...config, priorVersions: { edgeVersionId: 'latest', workerVersionId: 'worker-old' }
    }, { runner })).toThrow('immutable');
    expect(() => createCliReleaseOperations({ ...config, candidateSha: 'c'.repeat(40) }, { runner }))
      .toThrow('Candidate SHA');
    expect(() => createCliReleaseOperations({ ...config, checkedOutSha: 'c'.repeat(40) }, { runner }))
      .not.toThrow();
    expect(() => createCliReleaseOperations({
      ...config,
      target: getReleaseTarget('staging'),
      branch: 'staging',
      checkedOutSha: 'c'.repeat(40)
    }, { runner })).toThrow('Checked-out SHA');
    expect(runner.run).not.toHaveBeenCalled();
  });
});
