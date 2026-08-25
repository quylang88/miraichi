import type {
  BankrollLedgerEntry,
  BetSettlementEvent,
  CloudBetRecord,
  CreateOngoingBetInput,
  DisciplineChallenge,
  DisciplineConfig,
  SettlementCommand
} from '@miraichi/shared';
import { buildApiUrl } from '../config/client-env.js';
import type { FetchLike } from './cloud-persistence-service.js';

export class ApiRequestError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = 'ApiRequestError';
  }
}

async function requireOk(response: Response): Promise<Response> {
  if (response.ok) return response;
  let code = 'request_failed';
  try {
    const payload = await response.json() as { error?: { code?: string } };
    if (typeof payload.error?.code === 'string') code = payload.error.code;
  } catch {
    // The UI still receives a stable local code when an upstream body is unreadable.
  }
  throw new ApiRequestError(code, response.status);
}

export type DisciplineConfigUpdate = Pick<
  DisciplineConfig,
  'dailyStopLossPoints' | 'weeklyStopLossPoints' | 'bigBetThresholdPoints' | 'timeZone' | 'weekStartDay'
>;
export type DisciplineConfigViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly config: DisciplineConfig | null }
  | { readonly status: 'unavailable'; readonly code: string };

export async function loadDisciplineConfig(fetcher: FetchLike = fetch): Promise<DisciplineConfig | null> {
  const response = await requireOk(await fetcher(buildApiUrl('/api/v1/discipline-config')));
  return response.json() as Promise<DisciplineConfig | null>;
}

export async function updateDisciplineConfig(input: DisciplineConfigUpdate, fetcher: FetchLike = fetch): Promise<DisciplineConfig> {
  const body: DisciplineConfigUpdate = {
    dailyStopLossPoints: input.dailyStopLossPoints,
    weeklyStopLossPoints: input.weeklyStopLossPoints,
    bigBetThresholdPoints: input.bigBetThresholdPoints,
    timeZone: input.timeZone,
    ...(input.weekStartDay ? { weekStartDay: input.weekStartDay } : {})
  };
  const response = await requireOk(await fetcher(buildApiUrl('/api/v1/discipline-config'), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }));
  return response.json() as Promise<DisciplineConfig>;
}

export type DisciplineChallengeResponse =
  | { required: false; evaluation: { triggeredRules: readonly string[] } }
  | { required: true; challenge: DisciplineChallenge };

export async function createDisciplineChallenge(
  input: CreateOngoingBetInput,
  fetcher: FetchLike = fetch
): Promise<DisciplineChallengeResponse> {
  const response = await requireOk(await fetcher(buildApiUrl('/api/v1/discipline-challenges'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
  }));
  return response.json() as Promise<DisciplineChallengeResponse>;
}

export async function createOngoingBet(
  input: CreateOngoingBetInput & { readonly disciplineChallengeId?: string },
  fetcher: FetchLike = fetch
): Promise<CloudBetRecord> {
  const response = await requireOk(await fetcher(buildApiUrl('/api/v1/bets'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
  }));
  return response.json() as Promise<CloudBetRecord>;
}

export interface SettlementResponse {
  readonly event: BetSettlementEvent;
  readonly record: CloudBetRecord;
  readonly account: { readonly currentBalancePoints: number };
  readonly ledgerEntry: BankrollLedgerEntry;
  readonly idempotent: boolean;
}

export async function settleCloudBet(
  betId: string,
  command: SettlementCommand,
  fetcher: FetchLike = fetch
): Promise<SettlementResponse> {
  const response = await requireOk(await fetcher(buildApiUrl(`/api/v1/bets/${encodeURIComponent(betId)}/settlements`), {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command)
  }));
  return response.json() as Promise<SettlementResponse>;
}

export async function loadBetSettlementTimeline(betId: string, fetcher: FetchLike = fetch): Promise<readonly BetSettlementEvent[]> {
  const response = await requireOk(await fetcher(buildApiUrl(`/api/v1/bets/${encodeURIComponent(betId)}/settlements`)));
  return response.json() as Promise<readonly BetSettlementEvent[]>;
}

export type BetReportPeriod = 'week' | 'month' | 'previous_month' | 'all';
export interface BetReport {
  readonly period: { readonly kind: BetReportPeriod; readonly startDate: string | null; readonly endDate: string | null; readonly timeZone: string };
  readonly netProfitLossPoints: number;
  readonly totalSettledBets: number;
  readonly totalStakePoints: number;
  readonly averageStakePoints: number;
  readonly winRatePercent: number;
  readonly outcomes: Readonly<Record<string, number>>;
  readonly daily: readonly { readonly date: string; readonly profitLossPoints: number }[];
  readonly market: Readonly<Record<string, { readonly count: number; readonly profitLossPoints: number }>>;
  readonly psychology: {
    readonly emotion: Readonly<Record<string, { readonly count: number; readonly profitLossPoints: number }>>;
    readonly motivation: Readonly<Record<string, { readonly count: number; readonly profitLossPoints: number }>>;
    readonly planAdherence: Readonly<Record<string, { readonly count: number; readonly profitLossPoints: number }>>;
  };
  readonly disciplineOverrideCount: number;
}
export type BetReportViewState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly report: BetReport }
  | { readonly status: 'empty' }
  | { readonly status: 'unavailable'; readonly code: string };

export async function loadBetReport(
  input: { readonly period: BetReportPeriod; readonly anchor: string; readonly accountId?: string },
  fetcher: FetchLike = fetch
): Promise<BetReport> {
  const query = new URLSearchParams({ period: input.period, anchor: input.anchor });
  if (input.accountId) query.set('accountId', input.accountId);
  const response = await requireOk(await fetcher(buildApiUrl(`/api/v1/bet-reports?${query.toString()}`)));
  return response.json() as Promise<BetReport>;
}
