import type {
  LiveMatchOverlay,
  LocalMatch,
  LocalMatchFeedResponse,
  LocalMatchSnapshotQuery
} from '@miraichi/shared';
import type { CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
import type { MatchSnapshotRepository } from './match-snapshot-repository.js';

const OVERLAY_WARNING = 'live_terminal_overlay_applied';

function hasSameCanonicalIdentity(match: LocalMatch, overlay: LiveMatchOverlay): boolean {
  return match.id === overlay.matchId
    && match.competition.id === overlay.competition.id
    && match.kickoffUtc === overlay.kickoffUtc
    && match.homeTeam.id === overlay.homeTeam.id
    && match.awayTeam.id === overlay.awayTeam.id;
}

function projectCompletedOverlay(match: LocalMatch, overlay: LiveMatchOverlay | undefined): LocalMatch {
  if (!overlay
    || overlay.status !== 'completed'
    || !hasSameCanonicalIdentity(match, overlay)
    || Date.parse(overlay.updatedAt) < Date.parse(match.updatedAt)) return match;

  return {
    ...match,
    status: 'completed',
    score: { ...overlay.score },
    sourceRefs: [
      ...match.sourceRefs,
      ...overlay.sourceRefs.map(({ sourceId, observedAt }) => ({ sourceId, importedAt: observedAt }))
    ],
    updatedAt: overlay.updatedAt
  };
}

export class TerminalLiveProjectionRepository implements MatchSnapshotRepository {
  constructor(
    private readonly base: MatchSnapshotRepository,
    private readonly persistence: CloudPersistenceAdapter,
    private readonly ownerProfileId: string
  ) {}

  async listMatches(query: LocalMatchSnapshotQuery = {}): Promise<LocalMatchFeedResponse> {
    const baseResult = await this.base.listMatches({
      ...query,
      status: query.status === 'completed' ? undefined : query.status
    });
    let overlays: LiveMatchOverlay[] = [];
    try {
      overlays = (await this.persistence.getLiveMatchSnapshot(this.ownerProfileId))?.matches ?? [];
    } catch {
      return {
        ...baseResult,
        matches: query.status
          ? baseResult.matches.filter((match) => match.status === query.status)
          : baseResult.matches
      };
    }

    const overlaysByMatchId = new Map(overlays.map((overlay) => [overlay.matchId, overlay]));
    const projected = baseResult.matches.map((match) => projectCompletedOverlay(match, overlaysByMatchId.get(match.id)));
    const applied = projected.some((match, index) => match !== baseResult.matches[index]);

    return {
      matches: query.status ? projected.filter((match) => match.status === query.status) : projected,
      snapshot: applied
        ? {
            ...baseResult.snapshot,
            warnings: [...new Set([...baseResult.snapshot.warnings, OVERLAY_WARNING])]
          }
        : baseResult.snapshot
    };
  }

  async findById(id: string): Promise<LocalMatch | null> {
    const match = await this.base.findById(id);
    if (!match) return null;
    try {
      const snapshot = await this.persistence.getLiveMatchSnapshot(this.ownerProfileId);
      return projectCompletedOverlay(match, snapshot?.matches.find((overlay) => overlay.matchId === id));
    } catch {
      return match;
    }
  }

  getStatus() {
    return this.base.getStatus();
  }
}
