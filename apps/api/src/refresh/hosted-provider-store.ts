import type { LocalMatch } from '@miraichi/shared';
import type { CanonicalWarehouseSnapshot } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import type { FotMobResultDateCheckpoint, FotMobResultMatchCheckpoint } from '../../../worker/src/sources/fotmob/fotmob-result-ledger-contract.js';

export interface CurrentCheckpoint {
  completedAt?: string;
  etag?: string;
  nextAttemptAt?: string;
  failures: number;
}
export interface ProviderState {
  current: Record<string, CurrentCheckpoint>;
  dates: Record<string, FotMobResultDateCheckpoint>;
  matches: Record<string, FotMobResultMatchCheckpoint>;
  circuits: Record<string, string>;
}
export interface ProviderLease {
  id: string;
  revision: number;
  startedAt: string;
  state: ProviderState;
}
export interface HostedProviderStore {
  acquire(): Promise<ProviderLease | null>;
  readMatches(scope: { competitionIds?: readonly string[]; dueAt?: string }): Promise<LocalMatch[]>;
  finish(lease: ProviderLease, state: ProviderState, deltas: readonly CanonicalWarehouseSnapshot[]): Promise<string | null>;
}
