import { pathToFileURL } from 'url';

export const DEFAULT_PHASE_5_12_CACHE_MARKER = 'miraichi-shell-v5-phase-5-12-quality-up';

type SmokeFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

type SmokeFetch = (
  url: string,
  init?: {
    headers?: Record<string, string>;
  }
) => Promise<SmokeFetchResponse>;

type StagingSmokeCheck = {
  label: string;
  url: string;
  markers?: string[];
  forbiddenMarkers?: string[];
  json?: Record<string, unknown>;
};

type StagingSmokeResult = {
  label: string;
  url: string;
  ok: boolean;
  status: number;
  message: string;
};

export function normalizeBaseUrl(rawBaseUrl: string | undefined | null) {
  const baseUrl = String(rawBaseUrl || '').trim().replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('Staging URL is required');
  }

  return baseUrl;
}

export function buildStagingSmokeChecks(
  rawBaseUrl: string | undefined | null,
  cacheMarker = DEFAULT_PHASE_5_12_CACHE_MARKER
): StagingSmokeCheck[] {
  const baseUrl = normalizeBaseUrl(rawBaseUrl);

  return [
    {
      label: 'root shell',
      url: `${baseUrl}/`,
      markers: ['Miraichi', 'shell-entry', 'app-root', 'type="importmap"', 'window.MIRAICHI_ENV', 'API_URL'],
      forbiddenMarkers: ['API_URL: "http://localhost', 'API_URL: "http://127.0.0.1']
    },
    {
      label: 'manifest',
      url: `${baseUrl}/manifest.webmanifest`,
      json: {
        name: 'Miraichi'
      }
    },
    {
      label: 'service worker',
      url: `${baseUrl}/service-worker.js`,
      markers: [cacheMarker]
    },
    {
      label: 'shell entry',
      url: `${baseUrl}/apps/web/src/shell-entry.js`,
      markers: ['renderAppShell'],
      forbiddenMarkers: ['<!DOCTYPE html>']
    },
    {
      label: 'client environment',
      url: `${baseUrl}/apps/web/src/config/client-env.js`,
      markers: ['getApiBaseUrl'],
      forbiddenMarkers: ['<!DOCTYPE html>']
    },
    {
      label: 'match feed service',
      url: `${baseUrl}/apps/web/src/services/match-feed-service.js`,
      markers: ['/api/v1/matches'],
      forbiddenMarkers: ['<!DOCTYPE html>']
    },
    {
      label: 'ui css',
      url: `${baseUrl}/packages/ui/src/index.css`,
      markers: ['main-scroll'],
      forbiddenMarkers: ['<!DOCTYPE html>']
    }
  ];
}

export function resolveCliBaseUrl(
  argv: string[] = process.argv,
  env: Record<string, string | undefined> = process.env
) {
  const args = argv.slice(2).filter((arg) => arg !== '--');
  return args[0] || env.STAGING_URL;
}

export function resolveStagingApiBaseUrl(rootHtml: string, rawPageBaseUrl: string): string {
  const match = rootHtml.match(/\bAPI_URL\s*:\s*(["'])(.*?)\1/u);
  if (!match) {
    throw new Error('root shell does not expose API_URL');
  }

  const pageBaseUrl = normalizeBaseUrl(rawPageBaseUrl);
  const rawApiBaseUrl = String(match[2] || '').trim() || pageBaseUrl;
  let apiUrl: URL;

  try {
    apiUrl = new URL(rawApiBaseUrl);
  } catch {
    throw new Error('API_URL is not an absolute URL');
  }

  if (apiUrl.protocol !== 'http:' && apiUrl.protocol !== 'https:') {
    throw new Error('API_URL must use HTTP or HTTPS');
  }

  const hostname = apiUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '::1') {
    throw new Error('API_URL points to a loopback host');
  }

  return apiUrl.toString().replace(/\/+$/, '');
}

function compareJsonField(parsedJson: Record<string, unknown> | null | undefined, key: string, expectedValue: unknown) {
  if (parsedJson?.[key] !== expectedValue) {
    return `expected JSON ${key}=${JSON.stringify(expectedValue)}`;
  }

  return null;
}

async function runOneCheck(check: StagingSmokeCheck, fetchImpl: SmokeFetch): Promise<StagingSmokeResult> {
  let response;

  try {
    response = await fetchImpl(check.url, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    return {
      label: check.label,
      url: check.url,
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : 'request failed'
    };
  }

  const body = await response.text();

  if (!response.ok) {
    return {
      label: check.label,
      url: check.url,
      ok: false,
      status: response.status,
      message: `HTTP ${response.status}`
    };
  }

  for (const marker of check.markers || []) {
    if (!body.includes(marker)) {
      return {
        label: check.label,
        url: check.url,
        ok: false,
        status: response.status,
        message: `missing marker: ${marker}`
      };
    }
  }

  for (const marker of check.forbiddenMarkers || []) {
    if (body.includes(marker)) {
      return {
        label: check.label,
        url: check.url,
        ok: false,
        status: response.status,
        message: `forbidden marker: ${marker}`
      };
    }
  }

  if (check.json) {
    let parsedJson;

    try {
      parsedJson = JSON.parse(body);
    } catch {
      return {
        label: check.label,
        url: check.url,
        ok: false,
        status: response.status,
        message: 'invalid JSON response'
      };
    }

    for (const [key, expectedValue] of Object.entries(check.json)) {
      const mismatch = compareJsonField(parsedJson, key, expectedValue);

      if (mismatch) {
        return {
          label: check.label,
          url: check.url,
          ok: false,
          status: response.status,
          message: mismatch
        };
      }
    }
  }

  return {
    label: check.label,
    url: check.url,
    ok: true,
    status: response.status,
    message: 'ok'
  };
}

export async function runStagingSmokeCheck({
  baseUrl,
  fetchImpl = globalThis.fetch,
  cacheMarker = DEFAULT_PHASE_5_12_CACHE_MARKER
}: {
  baseUrl: string | undefined | null;
  fetchImpl?: SmokeFetch;
  cacheMarker?: string;
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable in this Node.js runtime');
  }

  const checks = buildStagingSmokeChecks(baseUrl, cacheMarker);
  const results: StagingSmokeResult[] = [];

  for (const check of checks) {
    results.push(await runOneCheck(check, fetchImpl));
  }

  let rootHtml = '';
  try {
    const rootResponse = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/`, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    rootHtml = await rootResponse.text();
  } catch (error) {
    results.push({
      label: 'runtime API config',
      url: `${normalizeBaseUrl(baseUrl)}/`,
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : 'request failed'
    });
    return { ok: false, results };
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = resolveStagingApiBaseUrl(rootHtml, normalizeBaseUrl(baseUrl));
    results.push({
      label: 'runtime API config',
      url: apiBaseUrl,
      ok: true,
      status: 200,
      message: 'ok'
    });
  } catch (error) {
    results.push({
      label: 'runtime API config',
      url: `${normalizeBaseUrl(baseUrl)}/`,
      ok: false,
      status: 200,
      message: error instanceof Error ? error.message : 'invalid API_URL'
    });
    return { ok: false, results };
  }

  results.push(await runOneCheck({
    label: 'API health',
    url: `${apiBaseUrl}/api/v1/health`,
    json: { status: 'ok' },
    forbiddenMarkers: ['<!DOCTYPE html>']
  }, fetchImpl));

  return {
    ok: results.every((result) => result.ok),
    results
  };
}

async function main() {
  const baseUrl = resolveCliBaseUrl();
  const result = await runStagingSmokeCheck({ baseUrl });

  for (const entry of result.results) {
    const status = entry.ok ? 'PASS' : 'FAIL';
    console.log(`${status} ${entry.label} ${entry.url} ${entry.message}`);
  }

  if (!result.ok) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[Staging Smoke] ${error.message}`);
    process.exit(1);
  });
}
