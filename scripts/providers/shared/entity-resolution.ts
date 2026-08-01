import { createHash } from 'node:crypto';

/**
 * Provider-neutral entity resolution utilities.
 *
 * Canonical match IDs are derived from stable competition and team identity
 * fields — never from provider-specific IDs or a reschedulable kickoff.
 */

export interface CanonicalMatchIdInput {
  competitionId: string;
  season: string;
  normalizedRound: string;
  homeTeamId: string;
  awayTeamId: string;
}

export interface ProviderMatchCandidateInput {
  canonicalKickoffUtc: string;
  providerKickoffUtc: string;
  canonicalHomeTeamName: string;
  providerHomeTeamName: string;
  canonicalAwayTeamName: string;
  providerAwayTeamName: string;
}

/**
 * Build a stable, provider-neutral canonical match ID from the configured
 * competition, season, round, and canonical team IDs.
 *
 * Format: `match-<first 24 SHA-256 hex chars>`.
 */
export function buildCanonicalMatchId(input: CanonicalMatchIdInput): string {
  const key = [
    input.competitionId,
    input.season,
    input.normalizedRound,
    input.homeTeamId,
    input.awayTeamId
  ].join('|');
  return `match-${createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 24)}`;
}

/**
 * Score how well a provider fixture matches a canonical match record.
 * Returns a value in [0, 1] where 1.0 is a perfect match.
 *
 * Scoring combines:
 *  - Kickoff proximity (within 30 minutes = full score, degrades linearly to 3 hours)
 *  - Home team name exactness (after normalization)
 *  - Away team name exactness (after normalization)
 */
export function scoreProviderMatchCandidate(input: ProviderMatchCandidateInput): number {
  const kickoffScore = scoreKickoffProximity(
    input.canonicalKickoffUtc,
    input.providerKickoffUtc
  );
  const homeScore = normalizeTeamName(input.canonicalHomeTeamName) === normalizeTeamName(input.providerHomeTeamName) ? 1.0 : 0.0;
  const awayScore = normalizeTeamName(input.canonicalAwayTeamName) === normalizeTeamName(input.providerAwayTeamName) ? 1.0 : 0.0;

  // Weights: kickoff 20%, home team 40%, away team 40%
  return kickoffScore * 0.2 + homeScore * 0.4 + awayScore * 0.4;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Normalize a team name to a URL-safe slug for ID construction and comparison:
 * 1. Lowercase
 * 2. Strip non-alphanumeric characters except spaces and hyphens
 * 3. Replace whitespace runs with a single hyphen
 * 4. Remove duplicate hyphens
 * 5. Trim leading/trailing hyphens
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')   // strip punctuation
    .replace(/\s+/g, '-')           // whitespace → hyphen
    .replace(/-{2,}/g, '-')         // deduplicate hyphens
    .replace(/^-+|-+$/g, '');       // trim edge hyphens
}

/**
 * Score kickoff proximity. Returns 1.0 if the difference is ≤30 minutes,
 * then decays linearly to 0.0 at 3 hours (180 minutes).
 */
function scoreKickoffProximity(canonicalUtc: string, providerUtc: string): number {
  const diffMs = Math.abs(new Date(canonicalUtc).getTime() - new Date(providerUtc).getTime());
  const diffMinutes = diffMs / 60_000;
  const FULL_SCORE_MINUTES = 30;
  const ZERO_SCORE_MINUTES = 180;

  if (diffMinutes <= FULL_SCORE_MINUTES) return 1.0;
  if (diffMinutes >= ZERO_SCORE_MINUTES) return 0.0;

  // Linear decay from 1.0 → 0.0 between 30 and 180 minutes
  return 1.0 - (diffMinutes - FULL_SCORE_MINUTES) / (ZERO_SCORE_MINUTES - FULL_SCORE_MINUTES);
}
