import { existsSync, readFileSync } from 'node:fs';

export const FRANKFURT_STAGING_ORIGIN = 'https://miraichi-owner-gateway-staging.quylang88.workers.dev';

export function readLocalEnv(file = '.env'): Record<string, string> {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/u).flatMap((line) => {
    const match = /^\s*([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (!match) return [];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[match[1], value]];
  }));
}

export function requireStagingConfig(env: Readonly<Record<string, string | undefined>>) {
  if (!env.STAGING_URL) throw new Error('STAGING_URL is required');
  if (env.STAGING_URL.replace(/\/$/u, '') !== FRANKFURT_STAGING_ORIGIN) throw new Error('STAGING_URL must be the exact Frankfurt Cloudflare staging origin');
  if (!env.MIRAICHI_OWNER_PASSWORD) throw new Error('MIRAICHI_OWNER_PASSWORD is required in the gitignored root .env');
  return { origin: FRANKFURT_STAGING_ORIGIN, password: env.MIRAICHI_OWNER_PASSWORD };
}

export function localStagingEnvironment(): Record<string, string | undefined> {
  return { ...readLocalEnv(), ...process.env };
}

/** Assertions deliberately omit actual/expected values, response bodies and credentials. */
export function gate(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`Hosted gate failed: ${label}`);
}
