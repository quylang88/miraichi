import {
  createEdgeRequestHandler,
  createEdgeRuntimeSmokeHandler,
  createPostgresEdgeApiHandler,
  createPostgresJsQueryClient,
} from '../_shared/generated/miraichi-edge-runtime.js';
import { createPostgresRuntime } from '../_shared/postgres-runtime.ts';

const environment = Object.fromEntries([
  'APP_ENV',
  'MIRAICHI_RELEASE_ENVIRONMENT',
  'MIRAICHI_RELEASE_SHA',
  'MIRAICHI_RELEASE_ARTIFACT',
  'MIRAICHI_SCHEMA_COMPAT_VERSION',
  'MIRAICHI_GATEWAY_TOKEN',
  'MIRAICHI_EDGE_RUNTIME_SMOKE',
  'MIRAICHI_OWNER_AUTH_MODE',
  'MIRAICHI_OWNER_PASSWORD_HASH',
  'MIRAICHI_SESSION_SECRET',
  'MIRAICHI_SESSION_TTL_SECONDS',
  'MIRAICHI_OWNER_PROFILE_ID',
  'MIRAICHI_PUBLIC_ORIGIN',
  'MIRAICHI_REFRESH_TOKEN',
  'MIRAICHI_PROVIDER_REFRESH_TOKEN',
  'MIRAICHI_CURRENT_REFRESH_BATCH_SIZE',
  'SPORTSCORE_LIVE_MODE',
  'LIVE_DATA_MODE',
  'SPORTSCORE_WIDGET_TIMEOUT_MS',
  'MIRAICHI_DATABASE_URL',
  'SUPABASE_DB_URL'
].map((name) => [name, Deno.env.get(name)]));

environment.SUPABASE_DB_URL = environment.MIRAICHI_DATABASE_URL?.trim() || environment.SUPABASE_DB_URL;

let queryClient: ReturnType<typeof createPostgresJsQueryClient> | undefined;
const getQueryClient = () => {
  queryClient ??= createPostgresJsQueryClient(createPostgresRuntime(environment.SUPABASE_DB_URL ?? ''));
  return queryClient;
};

Deno.serve(createEdgeRequestHandler({
  env: environment,
  createHandler: () => createPostgresEdgeApiHandler(environment, getQueryClient()),
  createRuntimeSmokeHandler: () => createEdgeRuntimeSmokeHandler(getQueryClient())
}));
