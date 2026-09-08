import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('hosted refresh scheduler contract', () => {
  it('defines three jobs and four exact Vault names without scheduling on migration', () => {
    const path = 'supabase/migrations/20260909130000_hosted_refresh_scheduler.sql';
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const sql = readFileSync(path, 'utf8');
    expect(sql.match(/cron\.schedule\(/gu)).toHaveLength(3);
    for (const name of ['miraichi_edge_function_url', 'miraichi_edge_gateway_token', 'miraichi_live_refresh_token', 'miraichi_provider_refresh_token']) expect(sql).toContain(name);
    expect(sql).toContain("'*/5 * * * *'");
    expect(sql).toContain("'* * * * *'");
    expect(sql).toContain("'x-region', 'eu-central-1'");
    expect(sql).toContain('unschedule_edge_hourly_live_refresh');
    expect(sql).not.toMatch(/^select miraichi_app.configure_hosted_refresh/mu);
    expect(sql).toContain('from public, anon, authenticated, service_role');
  });
});
