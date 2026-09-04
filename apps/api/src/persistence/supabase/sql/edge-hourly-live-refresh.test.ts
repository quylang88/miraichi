import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contractPath = 'apps/api/src/persistence/supabase/sql/edge-hourly-live-refresh.sql';
const migrationPath = 'supabase/migrations/20260903120000_edge_hourly_live_refresh.sql';

describe('Vault-backed Edge hourly live refresh SQL', () => {
  it('keeps the reviewed SQL contract byte-identical to the migration', () => {
    expect(readFileSync(migrationPath, 'utf8')).toBe(readFileSync(contractPath, 'utf8'));
  });

  it('uses exact Vault names, credentials, route, region, and one named minute-17 job', () => {
    const sql = readFileSync(contractPath, 'utf8');
    for (const marker of [
      'miraichi_edge_function_url',
      'miraichi_edge_gateway_token',
      'miraichi_live_refresh_token',
      '/api/v1/live/refresh?reason=hourly',
      "'x-miraichi-gateway-token'",
      "'Authorization'",
      "'x-region', 'eu-central-1'",
      "'miraichi-edge-hourly-live-refresh'",
      "'17 * * * *'",
      'vault.decrypted_secrets',
      'net.http_post'
    ]) expect(sql).toContain(marker);
    expect(sql.match(/cron\.schedule\(/gu)).toHaveLength(1);
  });

  it('does not schedule on migration and rejects absent or duplicate secrets', () => {
    const sql = readFileSync(contractPath, 'utf8');
    expect(sql).toContain("raise exception 'Required Edge scheduler Vault secret is missing or duplicated'");
    expect(sql).not.toMatch(/select\s+miraichi_app\.configure_edge_hourly_live_refresh\s*\(/iu);
    expect(sql).not.toMatch(/https:\/\/[a-z0-9-]+\.supabase\.co/iu);
    expect(sql).not.toMatch(/(?:gateway|refresh)[-_ ]token[-_ ](?:value|secret)/iu);
  });

  it('locks scheduler functions down and contains no hydration/provider call', () => {
    const sql = readFileSync(contractPath, 'utf8');
    expect(sql.match(/security definer/giu)?.length).toBeGreaterThanOrEqual(4);
    expect(sql.match(/set search_path = pg_catalog, vault, net, cron/giu)?.length).toBeGreaterThanOrEqual(4);
    for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
      expect(sql).toContain(`revoke all on function miraichi_app.configure_edge_hourly_live_refresh() from ${role}`);
      expect(sql).toContain(`revoke all on function miraichi_app.unschedule_edge_hourly_live_refresh() from ${role}`);
    }
    expect(sql).not.toMatch(/sportscore|hydrate|season|match_record/iu);
  });
});
