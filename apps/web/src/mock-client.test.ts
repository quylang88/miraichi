import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMockPrediction } from './mock-client.js';

describe('web mock client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a safe offline fallback when the API gateway is unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const fallback = await getMockPrediction({
      inputCandidateId: 'input-candidate-alpha-001',
      matchId: 'match-alpha-001',
      competitionId: 'competition-alpha',
      seasonId: 'season-alpha-2026'
    });

    expect(fallback).toMatchObject({
      predictionId: 'pred-fallback-offline',
      matchId: 'match-alpha-001',
      engineMode: 'mock',
      predictionAvailable: false,
      confidenceLabel: 'not_available',
      warnings: ['api_gateway_offline_fallback']
    });
  });
});
