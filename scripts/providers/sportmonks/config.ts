/**
 * Sportmonks provider configuration.
 *
 * This module is Sportmonks-specific and lives under scripts/providers/sportmonks/.
 * Deleting this directory must not break the app or any provider-neutral artifacts.
 *
 * The `provider` field is typed as the literal `'sportmonks'` so callers can
 * confirm at compile-time that the config came from the Sportmonks adapter and
 * not from any other provider.
 */

export interface SportmonksCaptureConfig {
  provider: 'sportmonks';
  apiToken: string;
  apiBaseUrl: string;
  captureRoot: string;
  maxRequestsPerMinute: number;
  allowGatedEndpoints: boolean;
}

/** Shape of a raw environment variable record accepted by readSportmonksCaptureConfig. */
export type EnvRecord = Record<string, string | undefined>;

const DEFAULT_API_BASE_URL = 'https://api.sportmonks.com/v3/football';
const DEFAULT_CAPTURE_ROOT = 'apps/api/data';
const DEFAULT_MAX_RPM = 120;

/**
 * Read and validate Sportmonks capture configuration from an environment record.
 *
 * Throws if SPORTMONKS_API_TOKEN is missing or empty — the token is required
 * for every trial capture request.
 *
 * All other fields fall back to safe defaults so the caller never has to set
 * anything beyond the token to start capturing.
 */
export function readSportmonksCaptureConfig(env: EnvRecord): SportmonksCaptureConfig {
  const apiToken = env['SPORTMONKS_API_TOKEN'];
  if (!apiToken || apiToken.trim() === '') {
    throw new Error('SPORTMONKS_API_TOKEN is required');
  }

  const apiBaseUrl = env['SPORTMONKS_API_BASE_URL'] ?? DEFAULT_API_BASE_URL;
  const captureRoot = env['PROVIDER_CAPTURE_ROOT'] ?? DEFAULT_CAPTURE_ROOT;
  const maxRequestsPerMinute = parseIntDefault(env['SPORTMONKS_MAX_REQUESTS_PER_MINUTE'], DEFAULT_MAX_RPM);
  const allowGatedEndpoints = env['SPORTMONKS_ALLOW_GATED_ENDPOINTS'] === 'true';

  return {
    provider: 'sportmonks',
    apiToken: apiToken.trim(),
    apiBaseUrl,
    captureRoot,
    maxRequestsPerMinute,
    allowGatedEndpoints
  };
}

function parseIntDefault(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
