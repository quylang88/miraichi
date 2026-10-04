import postgres from 'postgres';

export function createPostgresRuntime(databaseUrl: string) {
  if (!databaseUrl.trim()) throw new Error('SUPABASE_DB_URL is required in the Edge runtime');
  return postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10
  });
}
