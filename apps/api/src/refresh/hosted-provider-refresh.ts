import { COMPETITION_SOURCE_REGISTRY, type CompetitionSourceEntry } from '@miraichi/config';
import type { CanonicalWarehouseSnapshot } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import { FotMobSeasonClient, FotMobAccessBlockedError } from '../../../worker/src/sources/fotmob/fotmob-season-client.js';
import { FotMobDailyClient } from '../../../worker/src/sources/fotmob/fotmob-daily-client.js';
import { OpenFootballClient } from '../../../worker/src/sources/openfootball/openfootball-client.js';
import { adaptFotMobSeason } from '../../../worker/src/sources/fotmob/fotmob-season-adapter.js';
import { adaptOpenFootballSeason } from '../../../worker/src/sources/openfootball/openfootball-adapter.js';
import { adaptFotMobDailyTerminalResults } from '../../../worker/src/sources/fotmob/fotmob-daily-adapter.js';
import { planSeasonHydrationBatch, type SeasonHydrationTarget } from '../../../worker/src/sources/hydration/season-hydration-plan.js';
import { buildFotMobTerminalPlan } from '../../../worker/src/sources/fotmob/fotmob-terminal-plan.js';
import { fotMobDateKey, fotMobMatchKey, FOTMOB_RESULT_LEDGER_SCHEMA_VERSION } from '../../../worker/src/sources/fotmob/fotmob-result-ledger-contract.js';
import { toCanonicalWarehouse } from '../../../worker/src/sources/shared/hosted-canonical.js';
import type { HostedProviderStore, ProviderLease, ProviderState } from './hosted-provider-store.js';

export type ProviderRefreshKind = 'current' | 'terminal';
export interface ProviderRefreshResult {
  outcome: 'refreshed' | 'fresh' | 'leased' | 'failed';
  requests: number;
  publications: number;
  snapshotId: string | null;
}
interface Options {
  store: HostedProviderStore;
  registry?: readonly CompetitionSourceEntry[];
  currentClient?: Pick<FotMobSeasonClient, 'getSeasonMatches'>;
  dailyClient?: Pick<FotMobDailyClient, 'getDailyMatches'>;
  openFootballClient?: Pick<OpenFootballClient, 'getSeasonMatches'>;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  maxCurrentRequests?: number;
}

const isoAfter = (now: Date, minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
const blocked = (until: string | undefined, now: Date) => Boolean(until && Date.parse(until) > now.getTime());

export class HostedProviderRefresh {
  private readonly registry: readonly CompetitionSourceEntry[];
  private readonly currentClient: Pick<FotMobSeasonClient, 'getSeasonMatches'>;
  private readonly dailyClient: Pick<FotMobDailyClient, 'getDailyMatches'>;
  private readonly openFootballClient: Pick<OpenFootballClient, 'getSeasonMatches'>;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly cap: number;
  constructor(private readonly options: Options) {
    this.registry = options.registry ?? COMPETITION_SOURCE_REGISTRY;
    this.currentClient = options.currentClient ?? new FotMobSeasonClient({ timeoutMs: 8_000 });
    this.dailyClient = options.dailyClient ?? new FotMobDailyClient({ timeoutMs: 8_000 });
    this.openFootballClient = options.openFootballClient ?? new OpenFootballClient({ timeoutMs: 8_000 });
    this.now = options.now ?? (() => new Date());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.cap = options.maxCurrentRequests ?? 9;
    if (!Number.isInteger(this.cap) || this.cap < 1 || this.cap > 9) throw new Error('Current request cap must be 1–9');
  }

  async run(kind: ProviderRefreshKind): Promise<ProviderRefreshResult> {
    const lease = await this.options.store.acquire();
    if (!lease) return { outcome: 'leased', requests: 0, publications: 0, snapshotId: null };
    const result = { outcome: 'fresh' as ProviderRefreshResult['outcome'], requests: 0, publications: 0, snapshotId: null as string | null };
    const deltas: CanonicalWarehouseSnapshot[] = [];
    try {
      if (kind === 'current') await this.current(lease, deltas, result);
      else await this.terminal(lease, deltas, result);
      result.snapshotId = await this.options.store.finish(lease, lease.state, deltas);
      result.publications = result.snapshotId ? 1 : 0;
    } catch {
      // The lease expires naturally if DB publication fails. No checkpoint can commit alone.
      result.outcome = 'failed';
    }
    return result;
  }

  private async current(lease: ProviderLease, deltas: CanonicalWarehouseSnapshot[], result: ProviderRefreshResult): Promise<void> {
    const now = this.now();
    const state = lease.state;
    const checkpoints = new Map(Object.entries(state.current).flatMap(([key, value]) => value.completedAt
      ? [[key, { completedAt: value.completedAt, ...(value.etag ? { etag: value.etag } : {}) }] as const] : []));
    const blockedKeys = new Set(Object.entries(state.current).filter(([, value]) => blocked(value.nextAttemptAt, now)).map(([key]) => key));
    const plan = planSeasonHydrationBatch({ registry: this.registry, referenceDate: now.toISOString().slice(0, 10),
      pastSeasons: 0, checkpoints, blockedKeys, maxRequests: this.cap, mode: 'revalidate-current', observedAt: now });
    if (plan.blockedBySeasonOffset !== undefined && plan.targets.length === 0) {
      result.outcome = 'failed';
      return;
    }
    const deadline = now.getTime() + 95_000;
    for (const target of plan.targets) {
      const sourceId = target.sourceBinding.sourceId;
      if (blocked(state.circuits[sourceId], now)) { result.outcome = 'failed'; break; }
      if (this.now().getTime() > deadline) break;
      if (result.requests > 0) await this.sleep(1_000);
      try {
        result.requests++;
        const response = await this.fetchCurrent(target, now.toISOString());
        if (response.delta?.matches.length) deltas.push(response.delta);
        state.current[target.key] = { completedAt: now.toISOString(), failures: 0,
          ...(response.etag ?? target.requestEtag ? { etag: response.etag ?? target.requestEtag } : {}) };
        result.outcome = 'refreshed';
      } catch (error) {
        const previous = state.current[target.key];
        const failures = (previous?.failures ?? 0) + 1;
        state.current[target.key] = { ...previous, failures, nextAttemptAt: isoAfter(now, Math.min(360, 15 * 2 ** Math.min(failures - 1, 5))) };
        if (error instanceof FotMobAccessBlockedError) state.circuits[sourceId] = isoAfter(now, 360);
        result.outcome = 'failed';
        break;
      }
    }
  }

  private async fetchCurrent(target: SeasonHydrationTarget, observedAt: string): Promise<{ etag?: string; delta?: CanonicalWarehouseSnapshot }> {
    const binding = target.sourceBinding;
    if (binding.sourceId === 'fotmob-unofficial') {
      if (binding.endpointKind !== 'season-api' || !binding.externalNumericId || !binding.externalCountryCode) throw new Error('Invalid current source binding');
      const response = await this.currentClient.getSeasonMatches({ externalCompetitionId: binding.externalNumericId,
        externalCountryCode: binding.externalCountryCode, providerSeason: target.providerSeason,
        ...(target.requestEtag ? { etag: target.requestEtag } : {}) });
      if (response.status === 'not_modified') {
        if (target.intent !== 'revalidate') throw new Error('Unexpected initial 304');
        return response.etag ? { etag: response.etag } : {};
      }
      const delta = adaptFotMobSeason({ competitionEntry: target.competitionEntry, canonicalSeason: target.season,
        expectedProviderSeason: target.providerSeason, externalCompetitionId: binding.externalNumericId, rawPayload: response.payload, observedAt });
      if (delta.issues.some((issue) => issue.severity === 'invalid')) throw new Error('Invalid current response');
      return { delta, ...(response.etag ? { etag: response.etag } : {}) };
    }
    if (binding.sourceId !== 'openfootball' || binding.endpointKind !== 'season-file') throw new Error('Unsupported current source binding');
    const file = binding.externalCompetitionId;
    const response = await this.openFootballClient.getSeasonMatches({ season: target.providerSeason, file,
      ...(target.requestEtag ? { etag: target.requestEtag } : {}) });
    if (response.status === 'not_modified') {
      if (target.intent !== 'revalidate') throw new Error('Unexpected initial 304');
      return response.etag ? { etag: response.etag } : {};
    }
    const delta = adaptOpenFootballSeason({ competitionEntry: target.competitionEntry, season: target.season,
      openFootballFile: file, rawPayload: response.payload, observedAt });
    if (delta.issues.some((issue) => issue.severity === 'invalid')) throw new Error('Invalid current response');
    return { delta, ...(response.etag ? { etag: response.etag } : {}) };
  }

  private async terminal(lease: ProviderLease, deltas: CanonicalWarehouseSnapshot[], result: ProviderRefreshResult): Promise<void> {
    const now = this.now();
    const state = lease.state;
    if (blocked(state.circuits['fotmob-unofficial'], now)) { result.outcome = 'failed'; return; }
    const base = toCanonicalWarehouse(await this.options.store.readMatches({ dueAt: now.toISOString() }));
    const plan = buildFotMobTerminalPlan({ base, ledger: { schemaVersion: FOTMOB_RESULT_LEDGER_SCHEMA_VERSION,
      revision: lease.revision, updatedAt: now.toISOString(), dates: state.dates, matches: state.matches }, now, timeZone: 'UTC', maxDates: 2 });
    for (const group of plan.groups) {
      result.requests++;
      const dateKey = fotMobDateKey(group.date);
      try {
        const response = await this.dailyClient.getDailyMatches({ date: group.date, timeZone: 'UTC', ownerCountryCode: 'JPN', ...(group.etag ? { etag: group.etag } : {}) });
        const adapted = response.status === 'modified'
          ? adaptFotMobDailyTerminalResults({ registry: this.registry, base, rawPayload: response.payload, observedAt: now.toISOString() }) : null;
        const dueIds = new Set(group.matches.map((match) => match.matchId));
        if (adapted) {
          const matches = adapted.delta.matches.filter((match) => dueIds.has(match.matchId));
          if (matches.length) deltas.push({ ...adapted.delta, matches });
        }
        const terminalIds = new Set(adapted?.delta.matches.map((match) => match.matchId) ?? []);
        for (const match of group.matches) {
          const key = fotMobMatchKey(match.matchId);
          const attemptCount = (state.matches[key]?.attemptCount ?? 0) + 1;
          state.matches[key] = terminalIds.has(match.matchId)
            ? { attemptCount, terminalAt: now.toISOString() }
            : { attemptCount, nextCheckAt: isoAfter(now, 2) };
        }
        state.dates[dateKey] = { failureCount: 0, lastCheckedAt: now.toISOString(), nextAttemptAt: isoAfter(now, 2),
          ...(response.etag ?? group.etag ? { etag: response.etag ?? group.etag } : {}) };
        result.outcome = 'refreshed';
      } catch (error) {
        const failureCount = (state.dates[dateKey]?.failureCount ?? 0) + 1;
        state.dates[dateKey] = { ...state.dates[dateKey], failureCount,
          nextAttemptAt: isoAfter(now, Math.min(360, 15 * 2 ** Math.min(failureCount - 1, 5))) };
        if (error instanceof FotMobAccessBlockedError) state.circuits['fotmob-unofficial'] = isoAfter(now, 360);
        result.outcome = 'failed';
        break;
      }
    }
    this.pruneTerminal(state, now);
  }

  private pruneTerminal(state: ProviderState, now: Date): void {
    const cutoff = now.getTime() - 86_400_000;
    for (const [key, value] of Object.entries(state.matches)) {
      if (Date.parse(value.terminalAt ?? value.exhaustedAt ?? value.nextCheckAt ?? '') < cutoff) delete state.matches[key];
    }
    for (const [key, value] of Object.entries(state.dates)) {
      if (Date.parse(value.nextAttemptAt ?? value.lastCheckedAt ?? '') < cutoff) delete state.dates[key];
    }
  }
}
