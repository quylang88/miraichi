import path from 'node:path';
import { readLiveRefreshServiceAuthConfig } from '../auth/live-refresh-service-auth.js';
import { readOwnerAuthConfig } from '../auth/owner-auth.js';
import { readCloudPersistenceConfig } from '../config/cloud-persistence-config.js';
import { LiveRefreshCoordinator } from '../live/live-refresh-coordinator.js';
import { SportScoreWidgetClient, type SportScoreLiveSource } from '../live/sportscore-widget-client.js';
import { createCloudPersistenceAdapter } from '../persistence/create-cloud-persistence-adapter.js';
import { CloudMatchSnapshotRepository } from '../repositories/cloud-match-snapshot-repository.js';
import { FallbackMatchSnapshotRepository } from '../repositories/fallback-match-snapshot-repository.js';
import { LocalMatchDetailStore } from '../repositories/local-match-detail-store.js';
import { ServingMatchStoreRepository } from '../repositories/serving-match-store-repository.js';
import { TerminalLiveProjectionRepository } from '../repositories/terminal-live-projection-repository.js';
import { defineApiRuntime, type ApiRuntime } from './api-runtime.js';
import { createPostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import { createSupabaseCloudPersistenceAdapter } from '../persistence/supabase/supabase-cloud-persistence-adapter.js';
import { createGuardedProviderClients } from './guarded-provider-clients.js';
import { HostedMatchDetailCoordinator } from '../detail/hosted-match-detail.js';
import { PostgresHostedMatchDetailStore } from '../detail/hosted-match-detail-store.js';
import { fetchSelectedMatchDetail } from '../detail/match-detail-source.js';

export interface NodeRuntimeComposition {
  readonly runtime: ApiRuntime;
  readonly hostedWebMode: 'disabled' | 'required';
  readonly hostedWebRoot: string;
}

export function createNodeRuntimeComposition(options: {
  readonly rootDir: string;
  readonly env?: NodeJS.ProcessEnv;
}): NodeRuntimeComposition {
  const env = options.env ?? process.env;
  const cloudConfig = readCloudPersistenceConfig(env);
  const ownerAuthConfig = readOwnerAuthConfig(env);
  const liveRefreshServiceAuthConfig = readLiveRefreshServiceAuthConfig(env);
  const client = cloudConfig.mode === 'supabase' && cloudConfig.databaseUrl
    ? createPostgresQueryClient(cloudConfig.databaseUrl, cloudConfig.databaseCa) : null;
  const cloudAdapter = client ? createSupabaseCloudPersistenceAdapter({client, ownerProfileId:cloudConfig.ownerProfileId}) : createCloudPersistenceAdapter(cloudConfig);
  const cloudDependencies = { adapter: cloudAdapter, ownerProfileId: cloudConfig.ownerProfileId };

  const hostedWebMode = env.HOSTED_WEB_MODE?.trim() || 'disabled';
  if (hostedWebMode !== 'disabled' && hostedWebMode !== 'required') {
    throw new Error('HOSTED_WEB_MODE must be disabled or required');
  }
  const hostedWebRoot = path.resolve(options.rootDir, env.HOSTED_WEB_ROOT?.trim() || 'apps/web/dist');

  const canonicalRepository = new FallbackMatchSnapshotRepository(
    new ServingMatchStoreRepository(),
    new CloudMatchSnapshotRepository(cloudAdapter, cloudConfig.ownerProfileId)
  );
  const sportScoreLiveMode = env.SPORTSCORE_LIVE_MODE?.trim() || 'disabled';
  if (sportScoreLiveMode !== 'disabled' && sportScoreLiveMode !== 'widget') {
    throw new Error('SPORTSCORE_LIVE_MODE must be disabled or widget');
  }
  const disabledLiveSource: SportScoreLiveSource = {
    listMatches: async () => { throw new Error('SportScore live widget is disabled'); },
    getMatch: async () => { throw new Error('SportScore live widget is disabled'); }
  };
  const widgetTimeoutMs = Number(env.SPORTSCORE_WIDGET_TIMEOUT_MS?.trim() || 8_000);
  const clients = client ? createGuardedProviderClients(client, cloudConfig.ownerProfileId, widgetTimeoutMs) : null;
  const detailCoordinator = client && clients ? new HostedMatchDetailCoordinator(new PostgresHostedMatchDetailStore(client, cloudConfig.ownerProfileId),
    (input) => fetchSelectedMatchDetail({...input,fotmob:clients.detail,sportscore:clients.widget})) : null;
  const liveCoordinator = new LiveRefreshCoordinator({
    ownerProfileId: cloudConfig.ownerProfileId,
    persistence: cloudAdapter,
    repository: canonicalRepository,
    source: sportScoreLiveMode === 'widget'
      ? clients?.widget ?? new SportScoreWidgetClient({ timeoutMs: widgetTimeoutMs })
      : disabledLiveSource
  });
  const matchRepository = new TerminalLiveProjectionRepository(
    canonicalRepository,
    cloudAdapter,
    cloudConfig.ownerProfileId
  );
  const configuredDataRoot = env.PROVIDER_CAPTURE_ROOT?.trim() || 'apps/api/data';
  const dataRoot = path.isAbsolute(configuredDataRoot)
    ? configuredDataRoot
    : path.resolve(options.rootDir, configuredDataRoot);

  const runtime = defineApiRuntime({
    ownerAuthConfig,
    liveRefreshServiceAuthConfig,
    cloudDependencies,
    matchRepository,
    matchDetailDependencies: {
      repository: matchRepository,
      detailStore: new LocalMatchDetailStore({ dataRoot }),
      ...(detailCoordinator ? {coordinator:detailCoordinator} : {})
    },
    liveCoordinator,
    ...(env.CORS_ALLOWED_ORIGIN?.trim() ? { allowedOrigin: env.CORS_ALLOWED_ORIGIN.trim() } : {})
  });

  return { runtime, hostedWebMode, hostedWebRoot };
}
