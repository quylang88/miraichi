import type { LocalMatchSourceRef } from '@miraichi/shared';
import type { MatchFeedViewState } from '../services/match-feed-service.js';
import type { TranslateFunction } from '../services/i18n-service.js';
import { escapeHtml } from './html.js';

type SourceEvidence = LocalMatchSourceRef;

export function hasSportScoreEvidence(sources: readonly SourceEvidence[]): boolean {
  return sources.some((source) => source.sourceId === 'sportscore');
}

export function sourceEvidenceFromMatchFeed(feed: MatchFeedViewState): SourceEvidence[] {
  if (feed.status === 'loading') return [];
  const snapshotSources = feed.snapshot?.sources ?? [];
  const matchSources = feed.status === 'ready'
    ? feed.matches.flatMap((match) => match.sourceRefs)
    : [];
  return [...snapshotSources, ...matchSources];
}

export function renderSportScoreAttribution(
  sources: readonly SourceEvidence[],
  translate: TranslateFunction
): string {
  if (!hasSportScoreEvidence(sources)) return '';
  return `<p class="source-attribution" data-source-attribution="sportscore"><a href="https://sportscore.com/">${escapeHtml(translate('source.sportscoreAttribution'))}</a></p>`;
}
