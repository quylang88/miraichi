import { toProviderNeutralLocalMatch, validateLocalMatchDetail, type LocalMatch, type LocalMatchDetail, type LocalMatchEvent,
  type DetailMetric, type DetailStatisticKey, type DetailPeriodStatistics, type DetailShot, type MatchDetailEnrichment } from '@miraichi/shared';

export const FOTMOB_DETAIL_METRICS: Readonly<Record<string, DetailStatisticKey>> = {
  BallPossesion:'possession', total_shots:'totalShots', ShotsOnTarget:'shotsOnTarget', ShotsOffTarget:'shotsOffTarget',
  blocked_shots:'blockedShots', shots_woodwork:'woodwork', shots_inside_box:'shotsInsideBox', shots_outside_box:'shotsOutsideBox',
  corners:'corners', touches_opp_box:'touchesOppositionBox', big_chance:'bigChances', big_chance_missed_title:'bigChancesMissed',
  passes:'passes', accurate_passes:'accuratePasses', own_half_passes:'ownHalfPasses', opposition_half_passes:'oppositionHalfPasses',
  long_balls_accurate:'accurateLongBalls', accurate_crosses:'accurateCrosses', player_throws:'throwIns', Offsides:'offsides',
  'matchstats.headers.tackles':'tackles', interceptions:'interceptions', shot_blocks:'blocks', clearances:'clearances', keeper_saves:'saves',
  duel_won:'duelsWon', duel_lost:'duelsLost', ground_duels_won:'groundDuelsWon', aerials_won:'aerialDuelsWon', dribbles_succeeded:'successfulDribbles',
  yellow_cards:'yellowCards', red_cards:'redCards', fouls:'fouls', minutes_played:'minutesPlayed', goals:'goals', assists:'assists',
  chances_created:'chancesCreated', shot_accuracy:'shotAccuracy', touches:'touches', passes_into_final_third:'passesFinalThird',
  line_breaking_passes:'lineBreakingPasses', dispossessed:'dispossessed', defensive_actions:'defensiveActions', headed_clearance:'headedClearances',
  recoveries:'recoveries', dribbled_past:'dribbledPast', was_fouled:'wasFouled', physical_metrics_distance_covered:'distanceCovered',
  physical_metrics_sprinting:'sprintDistance', physical_metrics_number_of_sprints:'sprints', physical_metrics_topspeed:'topSpeed',
  physical_metrics_running:'runningDistance', physical_metrics_walking:'walkingDistance', penalty_won:'penaltiesWon',
  penalty_conceded:'penaltiesConceded', high_claim:'highClaims', punches:'punches', acted_as_sweeper:'sweeperActions',
  goals_conceded:'goalsConceded', penalty_save:'penaltiesSaved', accurate_keeper_throws:'accurateThrows',
  saves:'saves', conceded_penalties:'penaltiesConceded', penalties_won:'penaltiesWon', keeper_high_claim:'highClaims',
  keeper_sweeper:'sweeperActions', big_chance_created_team_title:'bigChancesCreated', clearance_off_the_line:'clearancesOffLine',
  keeper_diving_save:'divingSaves', saves_inside_box:'savesInsideBox', owngoal:'ownGoals', errors_led_to_goal:'errorsLedToGoal'
};
const rec = (v: unknown): Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
const list = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.slice(0, 200).map(rec) : [];
const name = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null;
const identity = (v: unknown) => name(v)?.normalize('NFKC').replace(/\s+/gu, ' ').toLowerCase();
const num = (v: unknown, max = 1_000_000): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(?:\.\d+)?$/u.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
};
const integer = (v: unknown, max = 200): number | null => { const n = num(v, max); return n !== null && Number.isInteger(n) ? n : null; };
export function parseDetailMetric(v: unknown): DetailMetric {
  if (typeof v === 'string') {
    const fraction = /^(\d+(?:\.\d+)?)\s*\((\d+(?:\.\d+)?)%\)$/u.exec(v);
    if (fraction) return { value: num(fraction[1]), ...(num(fraction[2], 100) === null ? {} : { percentage: Number(fraction[2]) }) };
  }
  return { value: num(v) };
}

export function adaptFotMobDetail(input: { match: LocalMatch; payload: unknown; providerMatchId: string; leagueId: number; observedAt: string }): LocalMatchDetail {
  const { match } = input; const raw = rec(input.payload); const general = rec(raw.general); const header = rec(raw.header);
  const home = rec(general.homeTeam); const away = rec(general.awayTeam); const teams = list(header.teams);
  const homeId = integer(home.id, Number.MAX_SAFE_INTEGER); const awayId = integer(away.id, Number.MAX_SAFE_INTEGER);
  if (String(general.matchId) !== input.providerMatchId || (general.leagueId !== input.leagueId && general.parentLeagueId !== input.leagueId)
    || identity(home.name) !== identity(match.homeTeam.name) || identity(away.name) !== identity(match.awayTeam.name)
    || Date.parse(String(general.matchTimeUTCDate)) !== Date.parse(match.kickoffUtc)
    || !homeId || !awayId || homeId === awayId || teams.length !== 2
    || integer(teams[0].id, Number.MAX_SAFE_INTEGER) !== homeId || integer(teams[1].id, Number.MAX_SAFE_INTEGER) !== awayId) throw new Error('Detail identity mismatch');
  const content = rec(raw.content); const facts = rec(content.matchFacts); const info = rec(facts.infoBox);
  const teamId = (id: unknown) => integer(id, Number.MAX_SAFE_INTEGER) === homeId ? match.homeTeam.id
    : integer(id, Number.MAX_SAFE_INTEGER) === awayId ? match.awayTeam.id : null;
  const status = rec(header.status); const reason = String(rec(status.reason).short ?? '').toLowerCase();
  const observedStatus: MatchDetailEnrichment['observedStatus'] = general.finished === true ? 'completed'
    : status.cancelled === true ? 'cancelled' : reason === 'ht' ? 'halftime' : ['susp','int'].includes(reason) ? 'suspended'
    : reason === 'pp' ? 'postponed' : general.started === true ? 'live' : 'scheduled';
  if (match.status === 'completed' && observedStatus !== 'completed') throw new Error('Detail identity/status regression');
  const events: LocalMatchEvent[] = [];
  const nullScore = () => ({ home: null, away: null });
  const score = { home: integer(teams[0].score,100), away: integer(teams[1].score,100) };
  if (observedStatus === 'completed' && (score.home === null || score.away === null)) throw new Error('Invalid completed detail score');
  const breakdown = { halftime: nullScore() as typeof score,
    fulltime: observedStatus === 'completed' && reason === 'ft' ? score : nullScore(), extratime: nullScore(), penalty: nullScore() };
  for (const event of list(rec(facts.events).events)) {
    if (event.type === 'Half' && event.halfStrShort === 'HT') breakdown.halftime = { home: integer(event.homeScore,100), away: integer(event.awayScore,100) };
    const kind = String(event.type).toLowerCase();
    if (!['goal','card','substitution','penalty','var'].includes(kind)) continue;
    const side = typeof event.isHome === 'boolean' ? event.isHome ? match.homeTeam.id : match.awayTeam.id : undefined;
    const swap = list(event.swap);
    const detail = kind === 'goal' ? event.ownGoal === true ? 'own goal' : String(event.goalDescriptionKey ?? '') === 'penalty' ? 'penalty goal' : null
      : kind === 'card' ? name(event.card)?.toLowerCase() ?? null : kind === 'penalty' ? 'missed penalty' : null;
    events.push({ minute: integer(event.time), extraMinute: integer(event.overloadTime,40), ...(side ? { teamId: side } : {}),
      type: kind === 'var' ? 'other' : kind as LocalMatchEvent['type'], detail,
      player: kind === 'substitution' ? name(swap[1]?.name) : name(rec(event.player).name),
      assist: kind === 'substitution' ? name(swap[0]?.name) : name(event.assistInput), label: kind === 'var' ? 'VAR' : kind });
  }
  const statistics: DetailPeriodStatistics[] = [];
  const periods = rec(rec(content.stats).Periods);
  for (const [upstream, period] of [['All','all'],['FirstHalf','firstHalf'],['SecondHalf','secondHalf'],['ExtraTime','extraTime']] as const) {
    const rows = new Map<DetailStatisticKey, DetailPeriodStatistics['rows'][number]>();
    for (const group of list(rec(periods[upstream]).stats)) {
      for (const stat of list(group.stats)) {
        const key = FOTMOB_DETAIL_METRICS[String(stat.key)]; if (!key || stat.type === 'title' || !Array.isArray(stat.stats)) continue;
        const homeMetric = parseDetailMetric(stat.stats[0]); const awayMetric = parseDetailMetric(stat.stats[1]);
        if (homeMetric.value === null && awayMetric.value === null) continue;
        rows.set(key, { key, home: homeMetric, away: awayMetric });
      }
    }
    if (rows.size) statistics.push({ period, rows: [...rows.values()] });
  }
  const players: MatchDetailEnrichment['players'] = [];
  for (const player of Object.values(rec(content.playerStats)).slice(0,80).map(rec)) {
    const id = teamId(player.teamId); const playerName = name(player.name); if (!id || !playerName) continue;
    const metrics = new Map<DetailStatisticKey, DetailMetric>();
    for (const group of list(player.stats)) for (const stat of Object.values(rec(group.stats)).map(rec)) {
      const key = FOTMOB_DETAIL_METRICS[String(stat.key)]; if (!key) continue;
      const value = rec(stat.stat); const metric = parseDetailMetric(value.value); if (metric.value === null) continue;
      const total = num(value.total); if (total !== null && total >= metric.value) metric.total = total;
      metrics.set(key, metric);
    }
    if (metrics.size) players.push({ teamId: id, name: playerName, shirtNumber: integer(player.shirtNumber,999), metrics: [...metrics].map(([key,value]) => ({ key,value })) });
  }
  const lineup = rec(content.lineup); const lineups: NonNullable<LocalMatchDetail['lineups']> = []; const coaches: MatchDetailEnrichment['coaches'] = [];
  // Projected lineups are not confirmed factual starters.
  if (lineup.lineupType === 'standard') for (const side of ['homeTeam','awayTeam']) {
    const team = rec(lineup[side]); const id = teamId(team.id); if (!id) continue;
    const mapPlayers = (value: unknown) => list(value).flatMap((p) => {
      const playerName = name(p.name); if (!playerName) return [];
      const positionIndex = integer(p.usualPlayingPositionId,3);
      const position = positionIndex === null ? null : ['G','D','M','F'][positionIndex];
      return [{ name: playerName, shirtNumber: integer(p.shirtNumber,999), position }];
    });
    const starters = mapPlayers(team.starters); const substitutes = mapPlayers(team.subs);
    if (starters.length || substitutes.length) lineups.push({ teamId: id, teamName: id === match.homeTeam.id ? match.homeTeam.name : match.awayTeam.name,
      formation: name(team.formation), starters, substitutes });
    const coachName = name(rec(team.coach).name); if (coachName) coaches.push({ teamId: id, name: coachName });
  }
  const partialLineups = lineups.length === 1;
  if (partialLineups) {
    const missing = lineups[0].teamId === match.homeTeam.id ? match.awayTeam : match.homeTeam;
    lineups.push({ teamId:missing.id, teamName:missing.name, formation:null, starters:[], substitutes:[] });
    lineups.sort((a) => a.teamId === match.homeTeam.id ? -1 : 1);
  }
  const shots: DetailShot[] = [];
  const shotResults: Readonly<Record<string, DetailShot['result']>> = { Goal:'goal', AttemptSaved:'saved', Miss:'miss', Post:'post' };
  const bodyParts: Readonly<Record<string, DetailShot['bodyPart']>> = { LeftFoot:'leftFoot', RightFoot:'rightFoot', Header:'head' };
  for (const shot of list(rec(content.shotmap).shots)) {
    const id = teamId(shot.teamId); const x = num(shot.x,105); const y = num(shot.y,68);
    const result: DetailShot['result'] | null = shot.isBlocked === true ? 'blocked'
      : shotResults[String(shot.eventType)] ?? null;
    if (!id || x === null || y === null || !result) continue;
    shots.push({ teamId: id, player: name(shot.playerName), minute: integer(shot.min), extraMinute: integer(shot.minAdded,40), x,y,result,
      ownGoal: shot.isOwnGoal === true, bodyPart: bodyParts[String(shot.shotType)] ?? 'other' });
  }
  const stadium = rec(info.Stadium); const attendance = integer(info.Attendance, 1_000_000);
  const detail: LocalMatchDetail = { match: { ...toProviderNeutralLocalMatch(match), ...(name(stadium.name) ? { venue: name(stadium.name)! } : {}) },
    status: match.status, elapsedMinute: observedStatus === 'completed' ? null : integer(/^\s*(\d{1,3})/u.exec(String(rec(status.liveTime).short ?? ''))?.[1]),
    events, updatedAt: input.observedAt,
    ...(name(rec(info.Referee).text) ? { referee: name(rec(info.Referee).text) } : {}), scoreBreakdown: breakdown,
    ...(lineups.length ? { lineups } : {}), ...(partialLineups ? { warnings:['partial_lineups'] } : {}),
    enrichment: { observedStatus, score, statistics, players, shots, coaches,
      ...(Object.keys(stadium).length ? { venue: { city: name(stadium.city), country: name(stadium.country), capacity: integer(stadium.capacity,1_000_000), surface: name(stadium.surface) } } : {}),
      ...(attendance !== null ? { attendance } : {}) }
  };
  if (!validateLocalMatchDetail(detail).ok) throw new Error('Invalid normalized detail');
  return detail;
}
