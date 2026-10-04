import type { LiveMatchOverlay, LocalMatch, LiveMatchPeriod, LiveMatchStatus } from '@miraichi/shared';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import type { FotMobDailyPayload } from '../../../worker/src/sources/fotmob/fotmob-daily-client.js';
import type { FotMobRawMatchStatus } from '../../../worker/src/sources/fotmob/fotmob-season-client.js';
import { resolveLeagueRoot } from '../../../worker/src/sources/fotmob/fotmob-daily-adapter.js';

const roots = new Map(COMPETITION_SOURCE_REGISTRY.flatMap(entry => entry.sourceBindings.result?.executionStatus === 'enabled'
  && entry.sourceBindings.result.externalNumericId ? [[entry.sourceBindings.result.externalNumericId, entry] as const] : []));
const identity = (name: string) => name.normalize('NFKD').replace(/[\p{M}\p{Cf}]/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function lifecycle(raw: FotMobRawMatchStatus): Pick<LiveMatchOverlay, 'status' | 'period' | 'elapsedMinute'> {
  if (raw.finished) return { status: 'completed', period: null, elapsedMinute: null };
  const label = (raw.liveTime?.short ?? '').replace(/\p{Cf}/gu, '').trim();
  const reason = typeof raw.reason === 'string' ? raw.reason : Object.values(raw.reason ?? {}).join(' ');
  if (/^(HT|half.?time)$/iu.test(label) || /half.?time/iu.test(reason)) return { status: 'halftime', period: null, elapsedMinute: null };
  const parsed = /^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*['’′]?$/u.exec(label);
  const minute = parsed ? Number(parsed[1]) + Number(parsed[2] ?? 0) : null;
  const base = raw.liveTime?.basePeriod;
  const status: LiveMatchStatus = /suspend|interrupt|abandon/iu.test(reason) ? 'suspended' : 'live';
  const period: LiveMatchPeriod = /pen/iu.test(label) ? 'penalties' : base && base > 90 ? 'extra_time'
    : base === 90 ? 'second_half' : base === 45 ? 'first_half' : 'unknown';
  return { status, period, elapsedMinute: minute !== null && minute <= 200 ? minute : null };
}

export function adaptFotMobDailyLive(input: { payload: FotMobDailyPayload; canonicalMatches: readonly LocalMatch[]; observedAt: string }):
  { matches: LiveMatchOverlay[]; upstreamCount: number; warnings: string[] } {
  const byProviderId = new Map<string, LocalMatch[]>();
  for (const match of input.canonicalMatches) for (const ref of match.sourceRefs) {
    if (ref.sourceId !== 'fotmob-unofficial' || !ref.sourceMatchId) continue;
    const candidates = byProviderId.get(ref.sourceMatchId) ?? [];
    if (!candidates.some(candidate => candidate.id === match.id)) candidates.push(match);
    byProviderId.set(ref.sourceMatchId, candidates);
  }
  const matches: LiveMatchOverlay[] = []; const issues = new Map<string, number>(); let upstreamCount = 0;
  const issue = (code: string) => issues.set(code, (issues.get(code) ?? 0) + 1);
  for (const league of input.payload.leagues) {
    const root = resolveLeagueRoot(league, roots);
    if (!root.valid) { issue('invalid_competition_identity'); continue; }
    if (!root.entry) continue;
    for (const raw of league.matches) {
      const status = raw.status;
      if (!status || status.cancelled || (!status.started && !status.ongoing && !status.finished)) continue;
      upstreamCount++;
      const candidates = (byProviderId.get(String(raw.id)) ?? []).filter(match => match.competition.id === root.entry!.competitionId);
      if (candidates.length !== 1) { issue(candidates.length ? 'ambiguous_matches' : 'unmapped_matches'); continue; }
      const match = candidates[0]!;
      if (!raw.home?.name || !raw.away?.name || identity(raw.home.name) !== identity(match.homeTeam.name)
        || identity(raw.away.name) !== identity(match.awayTeam.name)
        || Date.parse(status.utcTime ?? '') !== Date.parse(match.kickoffUtc)) { issue('identity_mismatch'); continue; }
      const home = raw.home.score; const away = raw.away.score;
      const scoreText = status.scoreStr ? /^(\d+)\s*[-–]\s*(\d+)$/u.exec(status.scoreStr.trim()) : null;
      if (!Number.isInteger(home) || home! < 0 || !Number.isInteger(away) || away! < 0
        || (status.scoreStr && (!scoreText || Number(scoreText[1]) !== home || Number(scoreText[2]) !== away))) { issue('invalid_scores'); continue; }
      if (match.status === 'completed' && !status.finished) { issue('terminal_conflicts'); continue; }
      if (matches.some(overlay => overlay.matchId === match.id)) { issue('duplicate_observations'); continue; }
      matches.push({ matchId: match.id, competition: { id: match.competition.id, name: match.competition.name },
        homeTeam: { ...match.homeTeam }, awayTeam: { ...match.awayTeam }, kickoffUtc: match.kickoffUtc,
        ...lifecycle(status), score: { home: home!, away: away! }, updatedAt: input.observedAt,
        sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: String(raw.id), observedAt: input.observedAt }] });
    }
  }
  return { matches, upstreamCount, warnings: [...issues].map(([code, count]) => `${code}:${count}`) };
}
