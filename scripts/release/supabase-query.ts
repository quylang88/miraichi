export function releaseDatabaseConnection(config: { projectRef: string; databaseUrl?: string }, env: NodeJS.ProcessEnv): { url: string; password: string } | undefined {
  if (config.databaseUrl === undefined) return undefined;
  try {
    const url = new URL(config.databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)
      || url.username !== `postgres.${config.projectRef}`
      || !/^[a-z0-9-]+\.pooler\.supabase\.com$/u.test(url.hostname)
      || url.port !== '5432' || url.pathname !== '/postgres' || url.hash
      || [...url.searchParams.keys()].some((name) => name !== 'sslmode')
      || url.searchParams.getAll('sslmode').length > 1
      || (url.searchParams.has('sslmode')
        && !['require', 'verify-ca', 'verify-full'].includes(url.searchParams.get('sslmode')!))) {
      throw new Error('invalid');
    }
    const password = url.password ? decodeURIComponent(url.password) : env.SUPABASE_DB_PASSWORD;
    if (!password || password.includes('\0')) throw new Error('invalid');
    url.password = '';
    if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
    return { url: url.toString(), password };
  } catch {
    throw new Error('Invalid release database connection');
  }
}

// Prefer the Dashboard Session pooler for every SQL path, including rollback.
// The pinned CLI's --linked preflight may resolve the IPv6 direct endpoint.
export function remoteQueryCommand(config: { projectRef: string; databaseUrl?: string }, env: NodeJS.ProcessEnv): { args: string[]; env: NodeJS.ProcessEnv } {
  const database = releaseDatabaseConnection(config, env);
  return { args: ['db', 'query', ...(database ? ['--db-url', database.url] : ['--linked']),
    '--output', 'json', '--agent', 'yes'],
    env: database ? { ...env, PGPASSWORD: database.password } : env };
}
