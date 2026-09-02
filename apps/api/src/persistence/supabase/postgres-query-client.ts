import pg from 'pg';

export type PostgresSslConfig = false | { rejectUnauthorized: true; ca: string };

export interface PostgresQueryClient {
  query<T extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T>;
}

export function resolvePostgresSslConfig(databaseUrl: string, databaseCa?: string): PostgresSslConfig {
  const parsed = new URL(databaseUrl);
  if (parsed.searchParams.get('sslmode') === 'disable') return false;
  if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) return false;
  if (!databaseCa) throw new Error('SUPABASE_DATABASE_CA_BASE64 is required for remote Supabase connections');
  return { rejectUnauthorized: true, ca: databaseCa };
}

const URI_SSL_PARAMETERS = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat'] as const;

export function normalizePostgresConnectionString(databaseUrl: string): string {
  const parsed = new URL(databaseUrl);
  for (const parameter of URI_SSL_PARAMETERS) parsed.searchParams.delete(parameter);
  return parsed.toString();
}

export function createPostgresQueryClient(databaseUrl: string, databaseCa?: string): PostgresQueryClient {
  const pool = new pg.Pool({
    connectionString: normalizePostgresConnectionString(databaseUrl),
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: resolvePostgresSslConfig(databaseUrl, databaseCa)
  });
  return {
    query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
      const result = await pool.query(text, [...values]);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    },
    transaction: async <T>(operation: (client: PostgresQueryClient) => Promise<T>) => {
      const client = await pool.connect();
      const transactionClient: PostgresQueryClient = {
        query: async <R extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
          const result = await client.query(text, [...values]);
          return { rows: result.rows as R[], rowCount: result.rowCount ?? 0 };
        },
        transaction: async <R>(nested: (nestedClient: PostgresQueryClient) => Promise<R>) => nested(transactionClient)
      };
      try {
        await client.query('begin');
        const result = await operation(transactionClient);
        await client.query('commit');
        return result;
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }
  };
}
