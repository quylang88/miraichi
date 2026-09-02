import {
  validateLiveMatchSnapshot,
  type LiveRefreshReason,
  type PublicLiveMatchSnapshot
} from '@miraichi/shared';
import { buildApiUrl } from '../config/client-env.js';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type LiveMatchViewState =
  | { status: 'loading' }
  | {
      status: 'ready';
      snapshot: PublicLiveMatchSnapshot;
      stale: boolean;
      partial: boolean;
      warningCode: string | null;
    }
  | { status: 'unavailable'; reason: 'live_data_unavailable' | 'invalid_live_payload' };

interface LiveApiEnvelope {
  readonly snapshot?: unknown;
  readonly refresh?: {
    readonly outcome?: unknown;
    readonly lastErrorCode?: unknown;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function containsPrivateLocator(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPrivateLocator);
  if (!isRecord(value)) return false;
  if (['sourceMatchId', 'sourceUrl', 'leaseId', 'externalCompetitionId', 'providerFixtureId']
    .some((key) => key in value)) return true;
  return Object.values(value).some(containsPrivateLocator);
}

function parseSnapshot(value: unknown): PublicLiveMatchSnapshot | null {
  if (containsPrivateLocator(value)) return null;
  const validation = validateLiveMatchSnapshot(value);
  return validation.ok ? value as PublicLiveMatchSnapshot : null;
}

export async function refreshLiveMatches(
  reason: Extract<LiveRefreshReason, 'visible' | 'manual'>,
  fetcher: FetchLike = fetch
): Promise<LiveMatchViewState> {
  try {
    const response = await fetcher(buildApiUrl(`/api/v1/live/refresh?reason=${reason}`), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return { status: 'unavailable', reason: 'live_data_unavailable' };
    const envelope = await response.json() as LiveApiEnvelope;
    const snapshot = parseSnapshot(envelope.snapshot);
    if (!snapshot) return { status: 'unavailable', reason: 'invalid_live_payload' };
    const stale = envelope.refresh?.outcome === 'failed';
    const warningCode = typeof envelope.refresh?.lastErrorCode === 'string'
      ? envelope.refresh.lastErrorCode
      : null;
    return {
      status: 'ready',
      snapshot,
      stale,
      partial: snapshot.warnings.length > 0
        || snapshot.coverage.mappedCount < snapshot.coverage.upstreamCount,
      warningCode
    };
  } catch {
    return { status: 'unavailable', reason: 'live_data_unavailable' };
  }
}
