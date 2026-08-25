import { describe, it, expect } from 'vitest';
import {
  validateLocalMatch,
  validateLocalDataSnapshotStatus,
  validateLocalMatchFeedResponse,
  validateLocalMatchDetail,
  toProviderNeutralLocalMatch,
  LocalMatch,
  LocalDataSnapshotStatus,
  LocalMatchFeedResponse,
  LocalMatchDetail,
  LocalScoreBreakdown,
  LocalMatchTeamStats,
  LocalMatchEvent
} from './local-match-contracts.js';

describe('Local Match Contracts Validation', () => {
  const validScheduledMatch: LocalMatch = {
    id: 'match-world-cup-2026-group-a-mexico-south-africa-2026-06-11',
    competition: {
      id: 'world-cup-2026',
      name: 'FIFA World Cup',
      type: 'national-team',
      season: '2026'
    },
    kickoffUtc: '2026-06-11T19:00:00.000Z',
    status: 'scheduled',
    homeTeam: {
      id: 'national-team-mexico',
      name: 'Mexico',
      countryCode: 'MEX'
    },
    awayTeam: {
      id: 'national-team-south-africa',
      name: 'South Africa',
      countryCode: 'RSA'
    },
    score: {
      home: null,
      away: null
    },
    venue: 'Estadio Azteca',
    round: 'Group A',
    stage: 'group',
    neutralVenue: false,
    sourceRefs: [
      {
        sourceId: 'openfootball',
        sourceMatchId: '2026/group-a/mexico-south-africa',
        sourceUrl: 'https://github.com/openfootball/worldcup',
        importedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  const validCompletedMatch: LocalMatch = {
    id: 'match-euro-2024-final-spain-england-2024-07-14',
    competition: {
      id: 'euro-2024',
      name: 'UEFA Euro',
      type: 'national-team',
      season: '2024'
    },
    kickoffUtc: '2024-07-14T19:00:00.000Z',
    status: 'completed',
    homeTeam: {
      id: 'national-team-spain',
      name: 'Spain',
      countryCode: 'ESP'
    },
    awayTeam: {
      id: 'national-team-england',
      name: 'England',
      countryCode: 'ENG'
    },
    score: {
      home: 2,
      away: 1
    },
    venue: 'Olympiastadion Berlin',
    round: 'Final',
    stage: 'final',
    neutralVenue: true,
    sourceRefs: [
      {
        sourceId: 'openfootball',
        sourceMatchId: '2024/final/spain-england',
        sourceUrl: 'https://github.com/openfootball/euro',
        importedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  const validSnapshotStatus: LocalDataSnapshotStatus = {
    snapshotId: 'national-team-seed-2026-07-01',
    generatedAt: '2026-07-01T00:00:00.000Z',
    importedAt: '2026-07-01T00:00:00.000Z',
    matchCount: 2,
    competitions: [
      {
        id: 'world-cup-2026',
        name: 'FIFA World Cup',
        seasons: ['2026'],
        matchCount: 1
      },
      {
        id: 'euro-2024',
        name: 'UEFA Euro',
        seasons: ['2024'],
        matchCount: 1
      }
    ],
    sources: [
      {
        sourceId: 'openfootball',
        sourceUrl: 'https://github.com/openfootball/worldcup',
        importedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    freshness: 'fresh',
    warnings: []
  };

  it('passes a valid scheduled World Cup 2026 match', () => {
    const result = validateLocalMatch(validScheduledMatch);
    expect(result.ok).toBe(true);
  });

  it('passes a valid completed Euro match with score', () => {
    const result = validateLocalMatch(validCompletedMatch);
    expect(result.ok).toBe(true);
  });

  it('rejects custom/mock fields like sourceProviderId or providerFixtureId', () => {
    const invalidMatch1 = {
      ...validScheduledMatch,
      sourceProviderId: 'legacy-provider'
    };
    const result1 = validateLocalMatch(invalidMatch1);
    expect(result1.ok).toBe(false);
    expect(result1.ok ? [] : result1.errors).toContain('Forbidden field "sourceProviderId" is present');

    const invalidMatch2 = {
      ...validScheduledMatch,
      providerFixtureId: 'legacy-provider-123'
    };
    const result2 = validateLocalMatch(invalidMatch2);
    expect(result2.ok).toBe(false);
    expect(result2.ok ? [] : result2.errors).toContain('Forbidden field "providerFixtureId" is present');
  });

  it('rejects status "in_play" because the serving store publishes terminal updates only', () => {
    const invalidMatch = {
      ...validScheduledMatch,
      status: 'in_play'
    };
    const result = validateLocalMatch(invalidMatch);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Field "status" cannot be "in_play" in the terminal-only match feed');
  });

  it('accepts club competitions', () => {
    const clubMatch = {
      ...validScheduledMatch,
      competition: {
        ...validScheduledMatch.competition,
        type: 'club' as const
      }
    };
    expect(validateLocalMatch(clubMatch)).toEqual({ ok: true });
  });

  it('rejects stale source identifiers outside OpenFootball and manual snapshots', () => {
    const result = validateLocalMatch({
      ...validScheduledMatch,
      sourceRefs: [{
        ...validScheduledMatch.sourceRefs[0]!,
        sourceId: 'football-data-org'
      }]
    });
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('sourceRefs[0].sourceId')
    ]));
  });

  it('rejects completed match with null score values', () => {
    const invalidMatch = {
      ...validCompletedMatch,
      score: {
        home: null,
        away: null
      }
    };
    const result = validateLocalMatch(invalidMatch);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Completed match cannot have null score values');
  });

  it('rejects invalid ISO datetime strings', () => {
    const invalidMatch = {
      ...validScheduledMatch,
      kickoffUtc: '2026-06-11 19:00:00'
    };
    const result = validateLocalMatch(invalidMatch);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toContain('Field "kickoffUtc" must be a valid ISO datetime string');
  });

  it('validates snapshot status correctly', () => {
    const result = validateLocalDataSnapshotStatus(validSnapshotStatus);
    expect(result.ok).toBe(true);

    const invalidStatus = {
      ...validSnapshotStatus,
      generatedAt: 'invalid-date'
    };
    const result2 = validateLocalDataSnapshotStatus(invalidStatus);
    expect(result2.ok).toBe(false);
    expect(result2.ok ? [] : result2.errors).toContain('Field "generatedAt" must be a valid ISO datetime string');
  });

  it('validates local match feed response correctly', () => {
    const response: LocalMatchFeedResponse = {
      matches: [validScheduledMatch, validCompletedMatch],
      snapshot: validSnapshotStatus
    };
    const result = validateLocalMatchFeedResponse(response);
    expect(result.ok).toBe(true);
  });

  describe('validateLocalMatchDetail', () => {
    const providerNeutralScheduledMatch: LocalMatch = {
      ...validScheduledMatch,
      sourceRefs: validScheduledMatch.sourceRefs.map(({ sourceId, importedAt }) => ({ sourceId, importedAt }))
    };
    const providerNeutralCompletedMatch: LocalMatch = {
      ...validCompletedMatch,
      sourceRefs: validCompletedMatch.sourceRefs.map(({ sourceId, importedAt }) => ({ sourceId, importedAt }))
    };
    const validScoreBreakdown: LocalScoreBreakdown = {
      halftime: { home: 1, away: 0 },
      fulltime: { home: 2, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    };

    const validEvents: LocalMatchEvent[] = [
      {
        minute: 45,
        extraMinute: 2,
        teamId: 'national-team-spain',
        type: 'goal',
        detail: 'Normal Goal',
        player: 'Nico Williams',
        assist: 'Lamine Yamal',
        label: '45+2\' Goal - Nico Williams (Assist: Lamine Yamal)'
      },
      {
        minute: 73,
        teamId: 'national-team-england',
        type: 'goal',
        detail: 'Normal Goal',
        player: 'Cole Palmer',
        assist: 'Jude Bellingham',
        label: '73\' Goal - Cole Palmer (Assist: Jude Bellingham)'
      },
      {
        minute: 86,
        teamId: 'national-team-spain',
        type: 'goal',
        detail: 'Normal Goal',
        player: 'Mikel Oyarzabal',
        assist: 'Marc Cucurella',
        label: '86\' Goal - Mikel Oyarzabal (Assist: Marc Cucurella)'
      },
      {
        minute: 90,
        extraMinute: 1,
        teamId: 'national-team-england',
        type: 'card',
        detail: 'Yellow Card',
        player: 'Harry Kane',
        label: '90+1\' Yellow Card - Harry Kane'
      }
    ];

    const validTeamStats: LocalMatchTeamStats[] = [
      {
        teamId: 'national-team-spain',
        teamName: 'Spain',
        cornerKicks: 10,
        yellowCards: 1,
        redCards: 0,
        totalShots: 15,
        shotsOnGoal: 6,
        possessionPercentage: 65.5
      },
      {
        teamId: 'national-team-england',
        teamName: 'England',
        cornerKicks: 3,
        yellowCards: 2,
        redCards: 0,
        totalShots: 9,
        shotsOnGoal: 4,
        possessionPercentage: 34.5
      }
    ];

    const validRichDetail: LocalMatchDetail = {
      match: providerNeutralCompletedMatch,
      status: 'completed',
      elapsedMinute: 90,
      referee: 'François Letexier',
      scoreBreakdown: validScoreBreakdown,
      events: validEvents,
      teamStats: validTeamStats,
      warnings: ['No extra time required'],
      notes: ['Final match of Euro 2024'],
      updatedAt: '2026-07-01T00:00:00.000Z'
    };

    it('constructs a provider-neutral match from an allowlist of factual fields', () => {
      const dirtyMatch = {
        ...validCompletedMatch,
        providerFixtureId: 123456,
        predictions: { winner: 'home' },
        competition: {
          ...validCompletedMatch.competition,
          odds: { home: 1.5 }
        }
      } as unknown as LocalMatch;

      const neutral = toProviderNeutralLocalMatch(dirtyMatch);
      expect(neutral.sourceRefs).toEqual([{
        sourceId: 'openfootball',
        importedAt: '2026-07-01T00:00:00.000Z'
      }]);
      expect(JSON.stringify(neutral)).not.toContain('providerFixtureId');
      expect(JSON.stringify(neutral)).not.toContain('predictions');
      expect(JSON.stringify(neutral)).not.toContain('odds');
    });

    it('accepts rich valid match detail with all fields populated', () => {
      const result = validateLocalMatchDetail(validRichDetail);
      expect(result.ok).toBe(true);
    });

    it('accepts minimal valid match detail', () => {
      const minimalDetail: LocalMatchDetail = {
        match: providerNeutralScheduledMatch,
        status: 'scheduled',
        elapsedMinute: null,
        events: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      };
      const result = validateLocalMatchDetail(minimalDetail);
      expect(result.ok).toBe(true);
    });

    it('accepts detail where team statistics or events have null values without converting null to 0', () => {
      const nullStatsDetail: LocalMatchDetail = {
        match: providerNeutralScheduledMatch,
        status: 'scheduled',
        elapsedMinute: null,
        referee: null,
        scoreBreakdown: {
          halftime: { home: null, away: null },
          fulltime: { home: null, away: null },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        },
        events: [
          {
            minute: null,
            extraMinute: null,
            teamId: 'national-team-mexico',
            type: 'other',
            detail: null,
            player: null,
            assist: null,
            label: 'Match scheduled'
          }
        ],
        teamStats: [
          {
            teamId: 'national-team-mexico',
            cornerKicks: null,
            yellowCards: null,
            redCards: null,
            totalShots: null,
            shotsOnGoal: null,
            possessionPercentage: null
          },
          {
            teamId: 'national-team-south-africa',
            cornerKicks: null,
            yellowCards: null,
            redCards: null,
            totalShots: null,
            shotsOnGoal: null,
            possessionPercentage: null
          }
        ],
        warnings: [],
        notes: [],
        updatedAt: '2026-07-01T00:00:00.000Z'
      };
      const result = validateLocalMatchDetail(nullStatsDetail);
      expect(result.ok).toBe(true);
      expect(nullStatsDetail.teamStats?.[0]?.cornerKicks).toBeNull();
      expect(nullStatsDetail.teamStats?.[0]?.possessionPercentage).toBeNull();
      expect(nullStatsDetail.events[0]?.minute).toBeNull();
    });

    it('rejects detail containing provider fixture IDs, sourceProviderId, fixtureId, or provider URLs', () => {
      const forbiddenTopFields = [
        'providerFixtureId',
        'sourceProviderId',
        'providerUrl',
        'fixtureId'
      ];

      for (const field of forbiddenTopFields) {
        const invalidDetail = {
          ...validRichDetail,
          [field]: 'provider-123'
        };
        const result = validateLocalMatchDetail(invalidDetail);
        expect(result.ok).toBe(false);
        expect(result.ok ? [] : result.errors).toContain(`Forbidden field "${field}" is present`);
      }

      const sourceRefLeak = {
        ...validRichDetail,
        match: validCompletedMatch
      };
      const sourceRefResult = validateLocalMatchDetail(sourceRefLeak);
      expect(sourceRefResult.ok).toBe(false);
      expect(sourceRefResult.ok ? [] : sourceRefResult.errors).toEqual(expect.arrayContaining([
        expect.stringContaining('sourceMatchId'),
        expect.stringContaining('sourceUrl')
      ]));
    });

    it('rejects detail containing xG, expectedGoals, expected_goals, predictions, or odds at top level or nested', () => {
      const analyticalFields = [
        'xG',
        'expectedGoals',
        'expected_goals',
        'predictions',
        'odds'
      ];

      for (const field of analyticalFields) {
        const invalidTop = {
          ...validRichDetail,
          [field]: 1.5
        };
        const resTop = validateLocalMatchDetail(invalidTop);
        expect(resTop.ok).toBe(false);
        expect(resTop.ok ? [] : resTop.errors).toContain(`Forbidden field "${field}" is present`);

        const invalidStats = {
          ...validRichDetail,
          teamStats: [
            {
              ...validTeamStats[0]!,
              [field]: 1.5
            }
          ]
        };
        const resStats = validateLocalMatchDetail(invalidStats);
        expect(resStats.ok).toBe(false);
        expect(resStats.ok ? [] : resStats.errors).toEqual(expect.arrayContaining([
          expect.stringContaining(`Forbidden field "${field}" is present`)
        ]));
      }


      const deeplyNestedOdds = {
        ...validRichDetail,
        match: {
          ...validRichDetail.match,
          competition: {
            ...validRichDetail.match.competition,
            odds: { home: 1.5 }
          }
        }
      };
      expect(validateLocalMatchDetail(deeplyNestedOdds).ok).toBe(false);
    });

    it('requires detail status and canonical team references to match the embedded match', () => {
      expect(validateLocalMatchDetail({
        ...validRichDetail,
        status: 'scheduled'
      }).ok).toBe(false);

      expect(validateLocalMatchDetail({
        ...validRichDetail,
        events: [{ ...validEvents[0]!, teamId: 'provider-team-33' }]
      }).ok).toBe(false);

      expect(validateLocalMatchDetail({
        ...validRichDetail,
        teamStats: [{ ...validTeamStats[0]!, teamId: 'provider-team-33' }]
      }).ok).toBe(false);
    });

    it('rejects detail with in_play status', () => {
      const inPlayDetail = {
        ...validRichDetail,
        status: 'in_play'
      };
      const result = validateLocalMatchDetail(inPlayDetail);
      expect(result.ok).toBe(false);
      expect(result.ok ? [] : result.errors).toContain('Field "status" cannot be "in_play" in the terminal-only match feed');
    });

    it('rejects detail with invalid status', () => {
      const invalidStatusDetail = {
        ...validRichDetail,
        status: 'live'
      };
      const result = validateLocalMatchDetail(invalidStatusDetail);
      expect(result.ok).toBe(false);
      expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining('Field "status" must be one of')
      ]));
    });

    it('rejects detail with invalid elapsedMinute', () => {
      const negativeElapsed = {
        ...validRichDetail,
        elapsedMinute: -5
      };
      expect(validateLocalMatchDetail(negativeElapsed).ok).toBe(false);

      const floatElapsed = {
        ...validRichDetail,
        elapsedMinute: 45.5
      };
      expect(validateLocalMatchDetail(floatElapsed).ok).toBe(false);
    });

    it('rejects invalid score breakdown', () => {
      const missingPeriod = {
        ...validRichDetail,
        scoreBreakdown: {
          halftime: { home: 1, away: 0 }
        }
      };
      const res1 = validateLocalMatchDetail(missingPeriod);
      expect(res1.ok).toBe(false);

      const negativeScore = {
        ...validRichDetail,
        scoreBreakdown: {
          ...validScoreBreakdown,
          fulltime: { home: -1, away: 2 }
        }
      };
      const res2 = validateLocalMatchDetail(negativeScore);
      expect(res2.ok).toBe(false);
    });

    it('rejects invalid events or event fields', () => {
      const invalidType = {
        ...validRichDetail,
        events: [
          {
            minute: 10,
            type: 'foul',
            label: 'Foul committed'
          }
        ]
      };
      expect(validateLocalMatchDetail(invalidType).ok).toBe(false);

      const emptyLabel = {
        ...validRichDetail,
        events: [
          {
            minute: 10,
            type: 'goal',
            label: '  '
          }
        ]
      };
      expect(validateLocalMatchDetail(emptyLabel).ok).toBe(false);
    });

    it('rejects invalid team statistics', () => {
      const invalidPossession = {
        ...validRichDetail,
        teamStats: [
          {
            ...validTeamStats[0]!,
            possessionPercentage: 105
          }
        ]
      };
      expect(validateLocalMatchDetail(invalidPossession).ok).toBe(false);

      const emptyTeamId = {
        ...validRichDetail,
        teamStats: [
          {
            ...validTeamStats[0]!,
            teamId: ''
          }
        ]
      };
      expect(validateLocalMatchDetail(emptyTeamId).ok).toBe(false);
    });

    it('rejects invalid updatedAt timestamp', () => {
      const invalidUpdatedAt = {
        ...validRichDetail,
        updatedAt: 'invalid-iso-date'
      };
      const result = validateLocalMatchDetail(invalidUpdatedAt);
      expect(result.ok).toBe(false);
      expect(result.ok ? [] : result.errors).toContain('Field "updatedAt" must be a valid ISO datetime string');
    });

    it('rejects when input is not an object or match is invalid', () => {
      expect(validateLocalMatchDetail(null).ok).toBe(false);
      expect(validateLocalMatchDetail('string').ok).toBe(false);

      const invalidMatchDetail = {
        ...validRichDetail,
        match: {
          ...validCompletedMatch,
          id: ''
        }
      };
      expect(validateLocalMatchDetail(invalidMatchDetail).ok).toBe(false);
    });
  });
});
