import { describe, expect, it } from 'vitest';
import {
  COMPETITION_SOURCE_REGISTRY,
  type CompetitionSourceEntry
} from '@miraichi/config';
import {
  planSeasonHydrationBatch,
  resolveCompetitionSeason,
  seasonHydrationTargetKey
} from './season-hydration-plan.js';

describe('provider-neutral season hydration planner', () => {
  it('uses registry season cycles and provider-season bindings without core league branches', () => {
    const premierLeague = COMPETITION_SOURCE_REGISTRY[0]!;
    const brazil = COMPETITION_SOURCE_REGISTRY.find((entry) => (
      entry.competitionId === 'bra-serie-a'
    ))!;
    expect(resolveCompetitionSeason(premierLeague, '2026-08-28', 0).season).toBe('2026-27');
    expect(resolveCompetitionSeason(brazil, '2026-08-28', 0).season).toBe('2026');

    const plan = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-28',
      pastSeasons: 2,
      checkpoints: new Map(),
      blockedKeys: new Set(),
      maxRequests: 50
    });
    expect(plan.targets).toHaveLength(49);
    expect(plan.targets.every((target) => target.seasonOffset === 0)).toBe(true);
    expect(plan.targets[0]).toMatchObject({
      providerSeason: '2026/2027',
      competitionEntry: { competitionId: 'eng-premier-league' }
    });
    expect(plan.targets.find((target) => (
      target.competitionEntry.competitionId === 'uefa-super-cup'
    ))?.providerSeason).toBe('2025/2026');
    expect(plan.targets.find((target) => (
      target.competitionEntry.competitionId === 'mex-liga-mx'
    ))?.providerSeason).toBe('2026/2027 - Apertura');
    expect(resolveCompetitionSeason(
      COMPETITION_SOURCE_REGISTRY.find((entry) => entry.competitionId === 'jpn-j1-league')!,
      '2026-08-28',
      0
    ).season).toBe('2026-27');
  });

  it('does not cross the current-season barrier while one current target is deferred', () => {
    const currentTargets = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-28',
      pastSeasons: 2,
      checkpoints: new Map(),
      blockedKeys: new Set(),
      maxRequests: 50
    }).targets;
    const blocked = currentTargets[0]!;
    const checkpoints = new Map(currentTargets.slice(1).map((target) => [
      target.key,
      { completedAt: '2026-08-28T00:00:00.000Z' }
    ]));

    const plan = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-28',
      pastSeasons: 2,
      checkpoints,
      blockedKeys: new Set([blocked.key]),
      maxRequests: 50
    });
    expect(plan.targets).toEqual([]);
    expect(plan.blockedBySeasonOffset).toBe(0);
  });

  it('prioritizes a newly enabled current source before past seasons', () => {
    const current = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-28',
      pastSeasons: 2,
      checkpoints: new Map(),
      blockedKeys: new Set(),
      maxRequests: 50
    }).targets;
    const checkpoints = new Map(current.map((target) => [
      target.key,
      { completedAt: '2026-08-28T00:00:00.000Z' }
    ]));
    const template = COMPETITION_SOURCE_REGISTRY[0]!;
    const added: CompetitionSourceEntry = {
      ...template,
      competitionId: 'new-competition-51',
      competitionName: 'New Competition 51',
      entryId: 'source-new-competition-51',
      sourceBindings: {
        ...template.sourceBindings,
        fixture: {
          ...template.sourceBindings.fixture!,
          externalCompetitionId: 'new.51.json'
        }
      },
      externalCompetitionId: 'new.51.json'
    };

    const plan = planSeasonHydrationBatch({
      registry: [...COMPETITION_SOURCE_REGISTRY, added],
      referenceDate: '2026-08-28',
      pastSeasons: 2,
      checkpoints,
      blockedKeys: new Set(),
      maxRequests: 1
    });
    expect(plan.targets[0]?.competitionEntry.competitionId).toBe('new-competition-51');
    expect(plan.targets[0]?.seasonOffset).toBe(0);
    expect(plan.targets[0]?.key).toBe(seasonHydrationTargetKey(
      'fotmob-unofficial',
      'new-competition-51',
      '2026-27'
    ));
  });
});
