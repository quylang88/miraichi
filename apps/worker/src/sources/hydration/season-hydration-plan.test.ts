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
    expect(plan.targets).toHaveLength(45);
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

  it('does not skip a blocked competition to hydrate later registry entries', () => {
    const currentTargets = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-28',
      pastSeasons: 0,
      checkpoints: new Map(),
      blockedKeys: new Set(),
      maxRequests: 50
    }).targets;

    const plan = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-28',
      pastSeasons: 0,
      checkpoints: new Map(),
      blockedKeys: new Set([currentTargets[0]!.key]),
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

  it('plans only explicitly verified provider seasons after the current tier', () => {
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

    const past = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-28',
      pastSeasons: 2,
      checkpoints,
      blockedKeys: new Set(),
      maxRequests: 50
    }).targets;

    expect(past.map((target) => [
      target.competitionEntry.competitionId,
      target.season,
      target.providerSeason
    ])).toEqual([
      ['fifa-club-world-cup', '2025', '2025'],
      ['eng-fa-cup', '2025-26', '2025/2026'],
      ['esp-copa-del-rey', '2025-26', '2025/2026'],
      ['fra-coupe-de-france', '2025-26', '2025/2026'],
      ['ned-knvb-beker', '2025-26', '2025/2026']
    ]);
  });

  it('revalidates only current checkpoints after 24 hours in registry order', () => {
    const initial = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      checkpoints: new Map(),
      blockedKeys: new Set(),
      maxRequests: 50
    }).targets;
    const checkpoints = new Map(initial.map((target, index) => [
      target.key,
      {
        completedAt: index < 12
          ? '2026-08-30T12:00:00.000Z'
          : '2026-08-31T11:59:59.000Z',
        etag: `"etag-${index}"`
      }
    ]));

    const plan = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      checkpoints,
      blockedKeys: new Set(),
      maxRequests: 9,
      mode: 'revalidate-current',
      observedAt: new Date('2026-08-31T12:00:00.000Z')
    });

    expect(plan.targets).toHaveLength(9);
    expect(plan.targets.map((target) => target.competitionEntry.competitionId))
      .toEqual(initial.slice(0, 9).map((target) => target.competitionEntry.competitionId));
    expect(plan.targets.every((target) => (
      target.seasonOffset === 0 && target.intent === 'revalidate'
    ))).toBe(true);
    expect(plan.targets[0]).toMatchObject({ requestEtag: '"etag-0"' });
  });

  it('does not revalidate current checkpoints before their 24-hour TTL', () => {
    const initial = planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY.slice(0, 2),
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      checkpoints: new Map(),
      blockedKeys: new Set(),
      maxRequests: 2
    }).targets;
    const checkpoints = new Map(initial.map((target) => [
      target.key,
      { completedAt: '2026-08-30T12:00:01.000Z', etag: '"fresh"' }
    ]));

    expect(planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY.slice(0, 2),
      referenceDate: '2026-08-31',
      pastSeasons: 0,
      checkpoints,
      blockedKeys: new Set(),
      maxRequests: 2,
      mode: 'revalidate-current',
      observedAt: new Date('2026-08-31T12:00:00.000Z')
    }).targets).toEqual([]);
  });

  it('rejects historical eligibility in current revalidation mode', () => {
    expect(() => planSeasonHydrationBatch({
      registry: COMPETITION_SOURCE_REGISTRY,
      referenceDate: '2026-08-31',
      pastSeasons: 1,
      checkpoints: new Map(),
      blockedKeys: new Set(),
      maxRequests: 9,
      mode: 'revalidate-current',
      observedAt: new Date('2026-08-31T12:00:00.000Z')
    })).toThrow(/current revalidation cannot plan historical seasons/iu);
  });
});
