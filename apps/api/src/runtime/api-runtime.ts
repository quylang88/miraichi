import type { LiveRefreshServiceAuthConfig } from '../auth/live-refresh-service-auth.js';
import type { OwnerAuthConfig } from '../auth/owner-auth.js';
import type { LiveRefreshCoordinator } from '../live/live-refresh-coordinator.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import type { CloudRouteDependencies } from '../routes/cloud-route-types.js';
import type { MatchDetailRouteDependencies } from '../routes/match-detail.js';

export interface ApiRuntime {
  readonly ownerAuthConfig: OwnerAuthConfig;
  readonly liveRefreshServiceAuthConfig: LiveRefreshServiceAuthConfig;
  readonly cloudDependencies: CloudRouteDependencies;
  readonly matchRepository: MatchSnapshotRepository;
  readonly matchDetailDependencies: MatchDetailRouteDependencies;
  readonly liveCoordinator: LiveRefreshCoordinator;
  readonly allowedOrigin?: string;
  readonly now?: () => number;
}

export function defineApiRuntime(runtime: ApiRuntime): ApiRuntime {
  if (!runtime.cloudDependencies.ownerProfileId.trim()) {
    throw new Error('ownerProfileId is required');
  }
  return Object.freeze({ ...runtime });
}
