import pg from 'pg';

export interface PostgresQueryClient {
  query<T extends Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T>;
}

export function createPostgresQueryClient(databaseUrl: string): PostgresQueryClient {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000, ssl: true });
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
