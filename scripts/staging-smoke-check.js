import { pathToFileURL } from 'url';

export const DEFAULT_PHASE_5_12_CACHE_MARKER = 'miraichi-shell-v5-phase-5-12-quality-up';

export function normalizeBaseUrl(rawBaseUrl) {
  const baseUrl = String(rawBaseUrl || '').trim().replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('Staging URL is required');
  }

  return baseUrl;
}

export function buildStagingSmokeChecks(rawBaseUrl, cacheMarker = DEFAULT_PHASE_5_12_CACHE_MARKER) {
  const baseUrl = normalizeBaseUrl(rawBaseUrl);

  return [
    {
      label: 'root shell',
      url: `${baseUrl}/`,
      markers: ['Miraichi', 'shell-entry', 'app-root']
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
      markers: ['renderAppShell']
    },
    {
      label: 'ui css',
      url: `${baseUrl}/packages/ui/src/index.css`,
      markers: ['main-scroll']
    }
  ];
}

export function resolveCliBaseUrl(argv = process.argv, env = process.env) {
  const args = argv.slice(2).filter((arg) => arg !== '--');
  return args[0] || env.STAGING_URL;
}

function compareJsonField(parsedJson, key, expectedValue) {
  if (parsedJson?.[key] !== expectedValue) {
    return `expected JSON ${key}=${JSON.stringify(expectedValue)}`;
  }

  return null;
}

async function runOneCheck(check, fetchImpl) {
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
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable in this Node.js runtime');
  }

  const checks = buildStagingSmokeChecks(baseUrl, cacheMarker);
  const results = [];

  for (const check of checks) {
    results.push(await runOneCheck(check, fetchImpl));
  }

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
