import type { PostgresQueryClient } from './postgres-query-client.js';
import { normalizePostgresJsParameters } from './postgres-parameters.js';

export type PostgresJsResult<T extends Record<string, unknown>> = T[] & {
  readonly count?: number;
};

export interface PostgresJsTransactionDriver {
  unsafe<T extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): PromiseLike<PostgresJsResult<T>>;
}

export interface PostgresJsDriver extends PostgresJsTransactionDriver {
  begin<T>(operation: (driver: PostgresJsTransactionDriver) => Promise<T>): Promise<T>;
  json(value: unknown): unknown;
}

function queryClientFor(
  driver: PostgresJsTransactionDriver,
  encodeJson: (value: unknown) => unknown
): PostgresQueryClient {
  const client: PostgresQueryClient = {
    query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
      const result = await driver.unsafe<T>(text, normalizePostgresJsParameters(values, encodeJson));
      return {
        rows: Array.from(result),
        rowCount: typeof result.count === 'number' ? result.count : result.length
      };
    },
    transaction: async <T>(operation: (nestedClient: PostgresQueryClient) => Promise<T>) => (
      operation(client)
    )
  };
  return client;
}

export function createPostgresJsQueryClient(driver: PostgresJsDriver): PostgresQueryClient {
  const encodeJson = (value: unknown) => driver.json(value);
  const root = queryClientFor(driver, encodeJson);
  return {
    query: root.query,
    transaction: async <T>(operation: (client: PostgresQueryClient) => Promise<T>) => (
      driver.begin(async (transactionDriver) => operation(queryClientFor(transactionDriver, encodeJson)))
    )
  };
}

export interface PostgresRuntimeSmokeResult {
  readonly scope: 'postgres';
  readonly parameterizedQuery: true;
  readonly rollback: true;
  readonly commit: true;
  readonly cleanup: true;
}

export async function runPostgresRuntimeSmoke(
  client: PostgresQueryClient,
  marker: string
): Promise<PostgresRuntimeSmokeResult> {
  if (!/^[a-f0-9-]{36}$/.test(marker)) throw new Error('Runtime smoke marker is invalid');
  const table = 'miraichi_edge_runtime_smoke';
  await client.query(`create temporary table if not exists ${table} (
    marker text primary key
  ) on commit preserve rows`);

  let cleaned = false;
  try {
    await client.query(`delete from ${table} where marker = $1`, [marker]);
    const parameterized = await client.query<{ marker: string }>(
      'select $1::text as marker',
      [marker]
    );
    const parameterizedQuery = parameterized.rows[0]?.marker === marker;

    try {
      await client.transaction(async (transaction) => {
        await transaction.query(`insert into ${table} (marker) values ($1)`, [marker]);
        throw new Error('miraichi_expected_runtime_rollback');
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'miraichi_expected_runtime_rollback') throw error;
    }
    const rolledBack = await client.query<{ count: number }>(
      `select count(*)::int as count from ${table} where marker = $1`,
      [marker]
    );
    const rollback = Number(rolledBack.rows[0]?.count) === 0;

    await client.transaction(async (transaction) => {
      await transaction.query(`insert into ${table} (marker) values ($1)`, [marker]);
    });
    const committed = await client.query<{ count: number }>(
      `select count(*)::int as count from ${table} where marker = $1`,
      [marker]
    );
    const commit = Number(committed.rows[0]?.count) === 1;

    await client.query(`delete from ${table} where marker = $1`, [marker]);
    const remaining = await client.query<{ count: number }>(
      `select count(*)::int as count from ${table} where marker = $1`,
      [marker]
    );
    cleaned = Number(remaining.rows[0]?.count) === 0;

    if (!parameterizedQuery || !rollback || !commit || !cleaned) {
      throw new Error('Edge postgres runtime smoke did not prove all gates');
    }
    return { scope: 'postgres', parameterizedQuery: true, rollback: true, commit: true, cleanup: true };
  } finally {
    if (!cleaned) await client.query(`delete from ${table} where marker = $1`, [marker]).catch(() => undefined);
  }
}
