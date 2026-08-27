import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APPROVAL_SCHEMA_VERSION = 'miraichi.sportscore-openapi-approval.v1' as const;
const APPROVAL_MANIFEST_PATH = 'tests/fixtures/sportscore-openapi.approval.json';
const REQUIRED_PATHS = ['/api/v1/fixtures/', '/api/widget/match/'] as const;

export interface ApprovedSportScoreContractManifest {
  schemaVersion: typeof APPROVAL_SCHEMA_VERSION;
  fixture: string;
  fixturePath: string;
  sha256: string;
  reviewedAt: string;
  sourceUrl: string;
  scope: string;
}

export interface SportScoreContractVerificationResult {
  fixturePath: string;
  sha256: string;
  reviewedAt: string;
  sourceUrl: string;
  requiredPaths: readonly string[];
}

export class SportScoreContractDriftError extends Error {
  readonly code: 'sportscore_openapi_approval_invalid' | 'sportscore_openapi_checksum_mismatch';

  constructor(
    code: SportScoreContractDriftError['code'],
    message: string
  ) {
    super(message);
    this.name = 'SportScoreContractDriftError';
    this.code = code;
  }
}

function workspaceRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function resolveContainedWorkspaceFile(relativePath: string): string {
  const root = workspaceRoot();
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (
    relative === ''
    || relative === '..'
    || relative.startsWith(`..${path.sep}`)
    || path.isAbsolute(relative)
  ) {
    throw new SportScoreContractDriftError(
      'sportscore_openapi_approval_invalid',
      'SportScore approval fixture must stay inside the workspace.'
    );
  }
  return resolved;
}

export async function loadApprovedSportScoreContractManifest(): Promise<ApprovedSportScoreContractManifest> {
  const manifestPath = resolveContainedWorkspaceFile(APPROVAL_MANIFEST_PATH);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new SportScoreContractDriftError(
      'sportscore_openapi_approval_invalid',
      `Unable to read the SportScore OpenAPI approval manifest: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    !isRecord(parsed)
    || parsed.schemaVersion !== APPROVAL_SCHEMA_VERSION
    || typeof parsed.fixture !== 'string'
    || typeof parsed.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/u.test(parsed.sha256)
    || typeof parsed.reviewedAt !== 'string'
    || !/^\d{4}-\d{2}-\d{2}$/u.test(parsed.reviewedAt)
    || typeof parsed.sourceUrl !== 'string'
    || parsed.sourceUrl !== 'https://sportscore.com/developers/openapi.yaml'
    || typeof parsed.scope !== 'string'
    || parsed.scope.trim() === ''
  ) {
    throw new SportScoreContractDriftError(
      'sportscore_openapi_approval_invalid',
      'SportScore OpenAPI approval manifest is invalid.'
    );
  }
  return {
    schemaVersion: APPROVAL_SCHEMA_VERSION,
    fixture: parsed.fixture,
    fixturePath: resolveContainedWorkspaceFile(parsed.fixture),
    sha256: parsed.sha256,
    reviewedAt: parsed.reviewedAt,
    sourceUrl: parsed.sourceUrl,
    scope: parsed.scope
  };
}

function validateApprovedFixture(payload: unknown): void {
  if (!isRecord(payload) || typeof payload.openapi !== 'string' || !isRecord(payload.paths)) {
    throw new SportScoreContractDriftError(
      'sportscore_openapi_approval_invalid',
      'Approved SportScore fixture is not an OpenAPI document.'
    );
  }
  for (const requiredPath of REQUIRED_PATHS) {
    const operation = payload.paths[requiredPath];
    if (!isRecord(operation) || !isRecord(operation.get)) {
      throw new SportScoreContractDriftError(
        'sportscore_openapi_approval_invalid',
        `Approved SportScore fixture is missing GET ${requiredPath}.`
      );
    }
  }
}

export async function verifySportScoreOpenApiContract(options: {
  fixturePath?: string;
  expectedSha256?: string;
} = {}): Promise<SportScoreContractVerificationResult> {
  const manifest = await loadApprovedSportScoreContractManifest();
  const fixturePath = path.resolve(options.fixturePath ?? manifest.fixturePath);
  const expectedSha256 = options.expectedSha256 ?? manifest.sha256;
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256)) {
    throw new SportScoreContractDriftError(
      'sportscore_openapi_approval_invalid',
      'Expected SportScore OpenAPI SHA-256 is invalid.'
    );
  }
  const fixtureBytes = await readFile(fixturePath);
  const actualSha256 = createHash('sha256').update(fixtureBytes).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new SportScoreContractDriftError(
      'sportscore_openapi_checksum_mismatch',
      `SportScore OpenAPI fixture checksum drifted: expected ${expectedSha256}, received ${actualSha256}.`
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fixtureBytes.toString('utf8'));
  } catch {
    throw new SportScoreContractDriftError(
      'sportscore_openapi_approval_invalid',
      'Approved SportScore OpenAPI fixture is not valid JSON.'
    );
  }
  validateApprovedFixture(parsed);
  return {
    fixturePath,
    sha256: actualSha256,
    reviewedAt: manifest.reviewedAt,
    sourceUrl: manifest.sourceUrl,
    requiredPaths: REQUIRED_PATHS
  };
}

async function main(): Promise<void> {
  const result = await verifySportScoreOpenApiContract();
  console.log(JSON.stringify({
    status: 'passed',
    reviewedAt: result.reviewedAt,
    sha256: result.sha256,
    requiredPaths: result.requiredPaths,
    networkUsed: false
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
