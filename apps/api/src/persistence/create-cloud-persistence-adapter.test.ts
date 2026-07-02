import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCloudPersistenceAdapter } from './create-cloud-persistence-adapter.js';

describe('cloud persistence adapter factory', () => {
  it('creates an honest disabled adapter', async () => {
    const adapter = createCloudPersistenceAdapter({ mode: 'disabled', appEnv: 'local', ownerProfileId: 'owner-primary' });
    await expect(adapter.getStatus()).resolves.toMatchObject({ mode: 'disabled', state: 'unconfigured' });
  });
  it('does not expose cloud secrets in web source', () => {
    const webSource = readFileSync(resolve(process.cwd(), 'apps/web/src/shell-entry.ts'), 'utf8');
    expect(webSource).not.toMatch(/SUPABASE_DATABASE_URL|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_SUPABASE|VITE_SUPABASE/);
  });
});
