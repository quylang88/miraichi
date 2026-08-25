import {
  type LocalMatch,
  type LocalMatchDetail,
  validateLocalMatch,
  validateLocalMatchDetail
} from '@miraichi/shared';
import { buildApiUrl } from '../config/client-env.js';

export type MatchDetailViewState =
  | { status: 'ready'; detail: LocalMatchDetail }
  | { status: 'pending'; match: LocalMatch; retryAfterSeconds: number }
  | { status: 'unavailable'; match: LocalMatch | null; warnings: string[] };

export interface FetchMatchDetailOptions {
  readonly signal?: AbortSignal;
}

const MAX_RETRY_AFTER_SECONDS = 900;
const FORBIDDEN_NORMALIZED_KEYS = new Set([
  'providerfixtureid',
  'sourceproviderid',
  'providerurl',
  'fixtureid',
  'xg',
  'expectedgoals',
  'predictions',
  'odds',
  'sourcematchid',
  'sourceurl',
  'apikey'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/gu, '');
}

function hasForbiddenKeys(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenKeys);
  }
  if (!isRecord(value)) {
    return false;
  }
  return Object.entries(value).some(([key, nestedValue]) => (
    FORBIDDEN_NORMALIZED_KEYS.has(normalizeKey(key)) || hasForbiddenKeys(nestedValue)
  ));
}

function parsePendingPayload(payload: unknown): MatchDetailViewState {
  if (!isRecord(payload) || payload.status !== 'pending') {
    throw new Error('Malformed pending match detail response.');
  }
  const matchValidation = validateLocalMatch(payload.match);
  const retryAfterSeconds = payload.retryAfterSeconds;
  if (
    !matchValidation.ok ||
    typeof retryAfterSeconds !== 'number' ||
    !Number.isInteger(retryAfterSeconds) ||
    retryAfterSeconds < 1 ||
    retryAfterSeconds > MAX_RETRY_AFTER_SECONDS
  ) {
    throw new Error('Malformed pending match detail response.');
  }
  return {
    status: 'pending',
    match: payload.match as LocalMatch,
    retryAfterSeconds
  };
}

export async function fetchMatchDetail(
  matchId: string,
  options: FetchMatchDetailOptions = {}
): Promise<MatchDetailViewState> {
  try {
    const url = buildApiUrl(`/api/v1/matches/detail?id=${encodeURIComponent(matchId)}`);
    const response = options.signal
      ? await fetch(url, { signal: options.signal })
      : await fetch(url);

    if (response.status === 404) {
      return { status: 'unavailable', match: null, warnings: ['match_not_found'] };
    }
    if (!response.ok && response.status !== 202) {
      return { status: 'unavailable', match: null, warnings: ['detail_request_failed'] };
    }

    const payload: unknown = await response.json();
    if (hasForbiddenKeys(payload)) {
      throw new Error('Response contains forbidden provider fields.');
    }
    if (response.status === 202) {
      return parsePendingPayload(payload);
    }
    if (isRecord(payload) && payload.status === 'pending') {
      throw new Error('Pending detail requires HTTP 202.');
    }

    const validationResult = validateLocalMatchDetail(payload);
    if (!validationResult.ok) {
      throw new Error('Malformed match detail response.');
    }
    return { status: 'ready', detail: payload as LocalMatchDetail };
  } catch {
    return { status: 'unavailable', match: null, warnings: ['detail_request_failed'] };
  }
}
