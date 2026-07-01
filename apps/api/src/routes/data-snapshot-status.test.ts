import { describe, expect, it } from 'vitest';
import { handleDataSnapshotStatus } from './data-snapshot-status.js';
import { LocalMatchSnapshotRepository } from '../repositories/local-match-snapshot-repository.js';
import { LocalDataSnapshotStatus } from '@miraichi/shared';

function responseMock() {
  return {
    statusCode: 0,
    headers: undefined as Record<string, string> | undefined,
    body: '',
    setHeader() {},
    writeHead(statusCode: number, headers?: Record<string, string>) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body?: unknown) {
      this.body = typeof body === 'string' ? body : '';
    }
  };
}

const mockStatus: LocalDataSnapshotStatus = {
  snapshotId: 'test-snapshot',
  generatedAt: '2026-07-01T00:00:00.000Z',
  importedAt: '2026-07-01T00:00:00.000Z',
  matchCount: 2,
  competitions: [
    { id: 'world-cup-2026', name: 'FIFA World Cup', seasons: ['2026'], matchCount: 1 },
    { id: 'euro-2024', name: 'UEFA Euro', seasons: ['2024'], matchCount: 1 }
  ],
  sources: [],
  freshness: 'fresh',
  warnings: []
};

describe('data snapshot status route', () => {
  it('returns snapshot status for fresh snapshot', async () => {
    const response = responseMock();
    const mockRepo = {
      getStatus: async () => mockStatus
    } as unknown as LocalMatchSnapshotRepository;

    await handleDataSnapshotStatus(
      { url: '/api/v1/data-snapshot/status', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as LocalDataSnapshotStatus;
    expect(body.snapshotId).toBe('test-snapshot');
    expect(body.matchCount).toBe(2);
    expect(body.competitions).toHaveLength(2);
  });

  it('returns 503 if snapshot file is missing', async () => {
    const response = responseMock();
    const mockRepo = {
      getStatus: async () => ({
        snapshotId: '',
        generatedAt: '',
        importedAt: '',
        matchCount: 0,
        competitions: [],
        sources: [],
        freshness: 'missing',
        warnings: ['Local snapshot file is missing']
      })
    } as unknown as LocalMatchSnapshotRepository;

    await handleDataSnapshotStatus(
      { url: '/api/v1/data-snapshot/status', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('local_snapshot_missing');
  });

  it('returns 500 if snapshot parsing throws an error', async () => {
    const response = responseMock();
    const mockRepo = {
      getStatus: async () => {
        const error = new Error('Malformed snapshot');
        const errObj = error as unknown as { code: string; statusCode: number };
        errObj.code = 'local_snapshot_invalid';
        errObj.statusCode = 500;
        throw error;
      }
    } as unknown as LocalMatchSnapshotRepository;

    await handleDataSnapshotStatus(
      { url: '/api/v1/data-snapshot/status', method: 'GET' } as import('http').IncomingMessage,
      response as unknown as import('http').ServerResponse,
      { repository: mockRepo }
    );

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('local_snapshot_invalid');
  });
});
