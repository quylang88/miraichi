const MIN_GATEWAY_TOKEN_BYTES = 32;
const FUNCTION_PATH = '/functions/v1/miraichi-api';
const FORBIDDEN_BINDING = /(DATABASE|DB_URL|SPORTSCORE|OWNER_PASSWORD|SESSION_SECRET|REFRESH_TOKEN)/i;

export interface CloudflareGatewayConfig {
  readonly deploymentEnv: 'staging';
  readonly functionUrl: string;
  readonly gatewayToken: string;
  readonly publicOrigin: string;
  readonly region: 'eu-central-1';
}

function requiredString(env: Readonly<Record<string, unknown>>, name: string): string {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

export function readCloudflareGatewayConfig(
  env: Readonly<Record<string, unknown>>
): CloudflareGatewayConfig {
  for (const name of Object.keys(env)) {
    if (FORBIDDEN_BINDING.test(name)) throw new Error(`Cloudflare has forbidden secret binding: ${name}`);
  }
  const deploymentEnv = requiredString(env, 'DEPLOYMENT_ENV');
  if (deploymentEnv !== 'staging') throw new Error('DEPLOYMENT_ENV must be staging');

  const functionUrl = requiredString(env, 'MIRAICHI_EDGE_FUNCTION_URL');
  const parsedFunctionUrl = new URL(functionUrl);
  if (parsedFunctionUrl.protocol !== 'https:') throw new Error('Edge function URL must use HTTPS');
  if (parsedFunctionUrl.pathname !== FUNCTION_PATH
    || parsedFunctionUrl.search
    || parsedFunctionUrl.hash) {
    throw new Error(`Edge function URL must end with ${FUNCTION_PATH}`);
  }

  const publicOrigin = requiredString(env, 'MIRAICHI_PUBLIC_ORIGIN');
  const parsedOrigin = new URL(publicOrigin);
  if (parsedOrigin.protocol !== 'https:' || publicOrigin !== parsedOrigin.origin) {
    throw new Error('MIRAICHI_PUBLIC_ORIGIN must be an exact HTTPS origin');
  }

  const region = requiredString(env, 'MIRAICHI_EDGE_REGION');
  if (region !== 'eu-central-1') throw new Error('Staging MIRAICHI_EDGE_REGION must be eu-central-1');

  const gatewayToken = requiredString(env, 'MIRAICHI_GATEWAY_TOKEN');
  if (new TextEncoder().encode(gatewayToken).byteLength < MIN_GATEWAY_TOKEN_BYTES) {
    throw new Error(`MIRAICHI_GATEWAY_TOKEN must be at least ${MIN_GATEWAY_TOKEN_BYTES} bytes`);
  }
  return { deploymentEnv, functionUrl, gatewayToken, publicOrigin, region };
}
