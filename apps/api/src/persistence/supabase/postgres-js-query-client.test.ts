import { describe, expect, it, vi } from 'vitest';
import {
  createPostgresJsQueryClient,
  type PostgresJsDriver,
  type PostgresJsResult
} from './postgres-js-query-client.js';
import { postgresJson } from './postgres-parameters.js';

function result<T extends Record<string, unknown>>(rows: T[], count = rows.length): PostgresJsResult<T> {
  return Object.assign(rows, { count });
}

describe('postgres.js query client', () => {
  it('uses the driver JSON encoder for branded JSON parameters', async () => {
    const payload = { status: 'ready', tags: ['edge'] };
    const encoded = { driverJson: payload };
    const unsafe = vi.fn(async () => result([]));
    const json = vi.fn(() => encoded);
    const driver = { unsafe, json, begin: vi.fn() } as unknown as PostgresJsDriver;
    const client = createPostgresJsQueryClient(driver);

    await client.query('select $1::jsonb', [postgresJson(payload), 'plain']);

    expect(json).toHaveBeenCalledWith(payload);
    expect(unsafe).toHaveBeenCalledWith('select $1::jsonb', [encoded, 'plain']);
  });

  it('passes numbered parameters to the driver without interpolating them', async () => {
    const unsafe = vi.fn(async () => result([{ echoed: 'owner-primary' }], 1));
    const driver = { unsafe, begin: vi.fn() } as unknown as PostgresJsDriver;
    const client = createPostgresJsQueryClient(driver);

    await expect(client.query<{ echoed: string }>(
      'select $1::text as echoed where $2::int = 7',
      ['owner-primary', 7]
    )).resolves.toEqual({ rows: [{ echoed: 'owner-primary' }], rowCount: 1 });
    expect(unsafe).toHaveBeenCalledWith(
      'select $1::text as echoed where $2::int = 7',
      ['owner-primary', 7]
    );
  });

  it('uses the transaction driver and commits a successful operation', async () => {
    const transactionUnsafe = vi.fn(async () => result([{ marker: 'committed' }]));
    let commits = 0;
    const driver: PostgresJsDriver = {
      unsafe: vi.fn(),
      json: vi.fn((value) => value),
      begin: async (operation) => {
        const value = await operation({
          unsafe: transactionUnsafe as unknown as PostgresJsDriver['unsafe']
        });
        commits += 1;
        return value;
      }
    };
    const client = createPostgresJsQueryClient(driver);

    await expect(client.transaction(async (tx) => (
      await tx.query<{ marker: string }>('select $1::text as marker', ['committed'])
    ).rows[0]!.marker)).resolves.toBe('committed');
    expect(commits).toBe(1);
    expect(driver.unsafe).not.toHaveBeenCalled();
  });

  it('propagates failures so the driver rolls the transaction back', async () => {
    let rollbacks = 0;
    const driver: PostgresJsDriver = {
      unsafe: vi.fn(),
      json: vi.fn((value) => value),
      begin: async (operation) => {
        try {
          return await operation({ unsafe: vi.fn(async () => result([])) });
        } catch (error) {
          rollbacks += 1;
          throw error;
        }
      }
    };
    const client = createPostgresJsQueryClient(driver);

    await expect(client.transaction(async (tx) => {
      await tx.query('insert into smoke(marker) values ($1)', ['rolled-back']);
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');
    expect(rollbacks).toBe(1);
  });
});
