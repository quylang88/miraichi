import { describe, expect, it, vi } from 'vitest';
import { retryAutomaticSettlementEvidence } from './settlement-evidence-refresh.js';

describe('automatic settlement evidence refresh', () => {
  it('requests only the selected match explicitly and reloads bets after the API retry', async () => {
    const fetchDetail = vi.fn(async () => ({ status: 'ready' as const, detail: {} as never }));
    const reloadBets = vi.fn(async () => undefined);
    await expect(retryAutomaticSettlementEvidence({ matchId: 'match-1', fetchDetail, reloadBets })).resolves.toBe('ready');
    expect(fetchDetail).toHaveBeenCalledExactlyOnceWith('match-1', { refresh: true });
    expect(reloadBets).toHaveBeenCalledTimes(1);
  });

  it('still reloads the authoritative bet state when detail refresh throws', async () => {
    const fetchDetail = vi.fn(async () => { throw new Error('offline'); });
    const reloadBets = vi.fn(async () => undefined);
    await expect(retryAutomaticSettlementEvidence({ matchId: 'match-1', fetchDetail, reloadBets })).rejects.toThrow('offline');
    expect(reloadBets).toHaveBeenCalledTimes(1);
  });
});
