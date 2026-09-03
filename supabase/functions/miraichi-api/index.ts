import { createEdgeRequestHandler } from '../_shared/generated/miraichi-edge-runtime.js';

const environment = Object.fromEntries([
  'APP_ENV',
  'MIRAICHI_GATEWAY_TOKEN',
  'MIRAICHI_OWNER_PASSWORD_HASH',
  'MIRAICHI_SESSION_SECRET',
  'MIRAICHI_SESSION_TTL_SECONDS',
  'MIRAICHI_OWNER_PROFILE_ID',
  'MIRAICHI_PUBLIC_ORIGIN',
  'MIRAICHI_REFRESH_TOKEN',
  'SPORTSCORE_LIVE_MODE'
].map((name) => [name, Deno.env.get(name)]));

Deno.serve(createEdgeRequestHandler({ env: environment }));
