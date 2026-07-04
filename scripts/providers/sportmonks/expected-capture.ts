import {
  runSportmonksRawCapture,
  type SportmonksCaptureClient,
  type SportmonksRawCaptureResult
} from './capture.js';
import {
  buildSportmonksEndpointCatalog,
  type SportmonksEndpointEntry
} from './endpoint-catalog.js';

export type SportmonksExpectedEndpointKey = 'expected.fixtures' | 'expected.lineups';

export interface SportmonksExpectedCaptureOptions {
  captureRoot: string;
  client: SportmonksCaptureClient;
  endpointKeys?: SportmonksExpectedEndpointKey[];
  includeRelations?: boolean;
  maxPagesPerEndpoint?: number;
  now?: () => string;
  log?: (message: string) => void;
}

const EXPECTED_ENDPOINT_KEYS: SportmonksExpectedEndpointKey[] = [
  'expected.fixtures',
  'expected.lineups'
];

const EXPECTED_ENDPOINT_DEFAULT_QUERIES: Record<SportmonksExpectedEndpointKey, Record<string, string>> = {
  'expected.fixtures': { include: 'type;fixture;participant' },
  'expected.lineups': { include: 'type;fixture;player;team' }
};

export function buildSportmonksExpectedCaptureCatalog(options: {
  endpointKeys?: SportmonksExpectedEndpointKey[];
  includeRelations?: boolean;
} = {}): SportmonksEndpointEntry[] {
  const requestedKeys = new Set(options.endpointKeys ?? EXPECTED_ENDPOINT_KEYS);
  const includeRelations = options.includeRelations ?? true;

  return buildSportmonksEndpointCatalog()
    .filter((entry): entry is SportmonksEndpointEntry & { endpointKey: SportmonksExpectedEndpointKey } =>
      isSportmonksExpectedEndpointKey(entry.endpointKey) && requestedKeys.has(entry.endpointKey)
    )
    .map((entry) => ({
      ...entry,
      ...(includeRelations ? { defaultQuery: EXPECTED_ENDPOINT_DEFAULT_QUERIES[entry.endpointKey] } : {})
    }));
}

export async function runSportmonksExpectedCapture(
  options: SportmonksExpectedCaptureOptions
): Promise<SportmonksRawCaptureResult> {
  const catalogOptions: {
    endpointKeys?: SportmonksExpectedEndpointKey[];
    includeRelations?: boolean;
  } = {};
  if (options.endpointKeys !== undefined) {
    catalogOptions.endpointKeys = options.endpointKeys;
  }
  if (options.includeRelations !== undefined) {
    catalogOptions.includeRelations = options.includeRelations;
  }

  return runSportmonksRawCapture({
    captureRoot: options.captureRoot,
    catalog: buildSportmonksExpectedCaptureCatalog(catalogOptions),
    client: options.client,
    allowLiveEndpoints: false,
    ...(options.maxPagesPerEndpoint === undefined ? {} : { maxPagesPerEndpoint: options.maxPagesPerEndpoint }),
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.log === undefined ? {} : { log: options.log })
  });
}

export function isSportmonksExpectedEndpointKey(value: string): value is SportmonksExpectedEndpointKey {
  return (EXPECTED_ENDPOINT_KEYS as string[]).includes(value);
}
