import type {
  CompetitionSourceBinding,
  CompetitionSourceEntry
} from '@miraichi/config';

export interface ResolvedCompetitionSeason {
  competitionEntry: CompetitionSourceEntry;
  season: string;
  startDate: string;
  endDate: string;
  seasonOffset: number;
}

export interface SeasonHydrationCheckpointView {
  completedAt: string;
  etag?: string;
  cursor?: string;
}

export interface SeasonHydrationTarget extends ResolvedCompetitionSeason {
  key: string;
  providerSeason: string;
  sourceBinding: CompetitionSourceBinding;
  intent: 'hydrate' | 'revalidate';
  requestEtag?: string;
}

export type SeasonHydrationPlanMode = 'hydrate' | 'revalidate-current';

const CURRENT_REVALIDATION_TTL_MS = 24 * 60 * 60 * 1_000;

export function seasonHydrationTargetKey(
  sourceId: string,
  competitionId: string,
  season: string
): string {
  return `${sourceId}|${competitionId}|${season}`;
}

export function resolveCompetitionSeason(
  entry: CompetitionSourceEntry,
  referenceDate: string,
  seasonOffset = 0
): ResolvedCompetitionSeason {
  assertCalendarDate(referenceDate);
  if (!Number.isInteger(seasonOffset) || seasonOffset < 0) {
    throw new Error('Season hydration offset must be a non-negative integer.');
  }
  const year = Number(referenceDate.slice(0, 4));
  if (entry.seasonCycle === 'calendar-year') {
    const seasonYear = year - seasonOffset;
    return {
      competitionEntry: entry,
      season: String(seasonYear),
      startDate: `${seasonYear}-01-01`,
      endDate: `${seasonYear}-12-31`,
      seasonOffset
    };
  }
  const referenceMonth = Number(referenceDate.slice(5, 7));
  const currentStartYear = referenceMonth >= 7 ? year : year - 1;
  const startYear = currentStartYear - seasonOffset;
  return {
    competitionEntry: entry,
    season: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startDate: `${startYear}-07-01`,
    endDate: `${startYear + 1}-06-30`,
    seasonOffset
  };
}

export function planSeasonHydrationBatch(options: {
  registry: readonly CompetitionSourceEntry[];
  referenceDate: string;
  pastSeasons: number;
  checkpoints: ReadonlyMap<string, SeasonHydrationCheckpointView>;
  blockedKeys: ReadonlySet<string>;
  maxRequests: number;
  mode?: SeasonHydrationPlanMode;
  observedAt?: Date;
}): {
  targets: SeasonHydrationTarget[];
  blockedBySeasonOffset?: number;
} {
  assertCalendarDate(options.referenceDate);
  if (!Number.isInteger(options.pastSeasons) || options.pastSeasons < 0) {
    throw new Error('Season hydration pastSeasons must be a non-negative integer.');
  }
  if (!Number.isInteger(options.maxRequests) || options.maxRequests < 1) {
    throw new Error('Season hydration maxRequests must be a positive integer.');
  }

  const mode = options.mode ?? 'hydrate';
  if (mode === 'revalidate-current') {
    if (options.pastSeasons !== 0) {
      throw new Error('Current revalidation cannot plan historical seasons.');
    }
    if (!options.observedAt || Number.isNaN(options.observedAt.valueOf())) {
      throw new Error('Current revalidation requires a valid observedAt time.');
    }
    const current = buildTierTargets(options.registry, options.referenceDate, 0);
    const due = current.flatMap((target): SeasonHydrationTarget[] => {
      const checkpoint = options.checkpoints.get(target.key);
      if (!checkpoint) return [target];
      const completedAt = Date.parse(checkpoint.completedAt);
      if (Number.isNaN(completedAt)) {
        throw new Error(`Current revalidation checkpoint is invalid for ${target.key}.`);
      }
      if (completedAt + CURRENT_REVALIDATION_TTL_MS > options.observedAt!.getTime()) return [];
      return [{
        ...target,
        intent: 'revalidate',
        ...(checkpoint.etag === undefined ? {} : { requestEtag: checkpoint.etag })
      }];
    });
    return selectRunnableTier(due, options.blockedKeys, options.maxRequests, 0);
  }

  for (let seasonOffset = 0; seasonOffset <= options.pastSeasons; seasonOffset += 1) {
    const tier = buildTierTargets(options.registry, options.referenceDate, seasonOffset);
    const incomplete = tier.filter((target) => !options.checkpoints.has(target.key));
    if (incomplete.length === 0) continue;
    return selectRunnableTier(
      incomplete,
      options.blockedKeys,
      options.maxRequests,
      seasonOffset
    );
  }
  return { targets: [] };
}

function buildTierTargets(
  registry: readonly CompetitionSourceEntry[],
  referenceDate: string,
  seasonOffset: number
): SeasonHydrationTarget[] {
  const targets: SeasonHydrationTarget[] = [];
  for (const entry of registry) {
    const resolved = resolveCompetitionSeason(entry, referenceDate, seasonOffset);
    const sourceBinding = entry.sourceBindings.fixture;
    const providerSeason = sourceBinding?.providerSeasonByCanonicalSeason?.[resolved.season];
    if (
      !sourceBinding
      || sourceBinding.executionStatus !== 'enabled'
      || !sourceBinding.availableCanonicalSeasons.includes(resolved.season)
      || !providerSeason
    ) {
      continue;
    }
    targets.push({
      ...resolved,
      providerSeason,
      sourceBinding,
      intent: 'hydrate',
      key: seasonHydrationTargetKey(
        sourceBinding.sourceId,
        entry.competitionId,
        resolved.season
      )
    });
  }
  return targets;
}

function selectRunnableTier(
  targets: readonly SeasonHydrationTarget[],
  blockedKeys: ReadonlySet<string>,
  maxRequests: number,
  seasonOffset: number
): { targets: SeasonHydrationTarget[]; blockedBySeasonOffset?: number } {
  const firstBlockedIndex = targets.findIndex((target) => blockedKeys.has(target.key));
  const runnable = firstBlockedIndex < 0 ? targets : targets.slice(0, firstBlockedIndex);
  return {
    targets: runnable.slice(0, maxRequests),
    ...(runnable.length === 0 && firstBlockedIndex === 0
      ? { blockedBySeasonOffset: seasonOffset }
      : {})
  };
}

function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error('Season hydration date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Season hydration date must be a real calendar date.');
  }
}
