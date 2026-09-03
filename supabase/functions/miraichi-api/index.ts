import {
  createEdgeRequestHandler,
  createEdgeRuntimeSmokeHandler,
  createPostgresEdgeApiHandler,
  createPostgresJsQueryClient,
} from '../_shared/generated/miraichi-edge-runtime.js';
import { createPostgresRuntime } from '../_shared/postgres-runtime.ts';

const environment = Object.fromEntries([
  'APP_ENV',
  'MIRAICHI_GATEWAY_TOKEN',
  'MIRAICHI_EDGE_RUNTIME_SMOKE',
  'MIRAICHI_OWNER_AUTH_MODE',
  'MIRAICHI_OWNER_PASSWORD_HASH',
  'MIRAICHI_SESSION_SECRET',
  'MIRAICHI_SESSION_TTL_SECONDS',
  'MIRAICHI_OWNER_PROFILE_ID',
  'MIRAICHI_PUBLIC_ORIGIN',
  'MIRAICHI_REFRESH_TOKEN',
  'SPORTSCORE_LIVE_MODE',
  'SPORTSCORE_WIDGET_TIMEOUT_MS',
  'SUPABASE_DB_URL'
].map((name) => [name, Deno.env.get(name)]));

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
