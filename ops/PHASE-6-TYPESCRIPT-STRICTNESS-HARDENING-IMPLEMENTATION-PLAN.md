# Phase 6 TypeScript Strictness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the repo-wide TypeScript migration into enforced source-level type safety for `apps/`, `packages/`, and `scripts/`.

**Architecture:** Harden from the boundaries inward: first add an audit gate, then replace `any` at shared contracts, ingestion, local-ai, API JSON parsing, service worker, and scripts. Only after source violations are removed should strict compiler flags and the automated type-safety audit enter `verify:local`.

**Tech Stack:** TypeScript, Vitest, Node.js ESM, `tsx`, `tsc`, no new runtime framework.

---

## 1. Source Decisions

This implementation plan is based on:

* `phase:implementation-plan Phase 6 TypeScript Strictness Hardening`
* `ops/PHASE-6-REPO-WIDE-TYPESCRIPT-MIGRATION-REVIEW.md`
* `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`
* `.agent/skills/miraichi-project-guardrails/SKILL.md`
* Current `tsconfig.base.json`

The previous repo-wide migration moved source to `.ts`, but it deliberately did not make the repo fully strict. Current known debt:

* `tsconfig.base.json` still has `noImplicitAny: false`, `useUnknownInCatchVariables: false`, and `allowJs: true`.
* Explicit `any` exists in API JSON body handling, worker adapter/repository, local-ai envelope construction, service worker event handling, and lifecycle script JSON parsing.
* One `@ts-expect-error` exists in the PWA registration test.

This plan does not authorize business logic, prediction algorithms, betting formulas, production database schemas, real provider selection, auth, cloud sync, production deployment, or secrets.

## 2. File Structure

Create:

* `scripts/type-safety-audit.ts` - CLI and helpers that fail on tracked `.js` source, explicit `any`, and TypeScript suppression comments.
* `scripts/type-safety-audit.test.ts` - Vitest coverage for audit detection and ignored generated directories.
* `scripts/typescript-strictness-policy.test.ts` - Vitest policy test for strict compiler flags and `verify:local` wiring.
* `apps/worker/src/adapters/mock-provider-adapter.test.ts` - Behavior coverage for typed raw provider mapping.
* `apps/worker/src/repositories/memory-ingestion-repository.test.ts` - Behavior coverage for typed in-memory repository cloning and listing.
* `apps/local-ai/src/contracts/mock-prediction-contracts.ts` - Typed input candidate, prediction envelope, explanation, validation, and guard helpers.
* `apps/api/src/routes/json-body.ts` - Shared unknown-to-object JSON helper for API routes.
* `apps/api/src/routes/json-body.test.ts` - Vitest coverage for JSON helper behavior.
* `ops/PHASE-6-TYPESCRIPT-STRICTNESS-HARDENING-REVIEW.md` - Final review evidence after code execution.

Modify:

* `package.json`
* `tsconfig.base.json`
* `packages/shared/src/contracts/normalized-match-contract.ts`
* `packages/shared/src/contracts/normalized-market-contract.ts`
* `packages/shared/src/contracts/ingestion-run-contract.ts`
* `packages/config/src/competition-registry.mock.ts`
* `apps/worker/src/adapters/mock-provider-adapter.ts`
* `apps/worker/src/repositories/memory-ingestion-repository.ts`
* `apps/worker/src/jobs/mock-ingestion-job.ts`
* `apps/local-ai/src/input/input-candidate-validator.ts`
* `apps/local-ai/src/input/mock-input-candidate.ts`
* `apps/local-ai/src/engines/mock-prediction-engine.ts`
* `apps/local-ai/src/output/prediction-envelope-builder.ts`
* `apps/local-ai/src/explainability/mock-explanation-refusal.ts`
* `apps/api/src/routes/mock-prediction.ts`
* `apps/api/src/routes/mock-explanation.ts`
* `apps/web/public/service-worker.ts`
* `apps/web/src/pwa/register-service-worker.test.ts`
* `scripts/verify-lifecycle.ts`

Do not create:

* new `.js` source files under `apps/`, `packages/`, or `scripts/`
* type-safety allowlists for application source
* `@ts-ignore`, `@ts-nocheck`, or new `@ts-expect-error`
* production config, database schemas, provider credentials, auth, cloud sync, prediction logic, or betting logic

## 3. Task 1: Type-Safety Audit Gate

**Files:**

* Create: `scripts/type-safety-audit.ts`
* Create: `scripts/type-safety-audit.test.ts`

- [ ] **Step 1: Write the failing audit tests**

Create `scripts/type-safety-audit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { collectTypeSafetyViolations } from './type-safety-audit.js';

async function writeFixture(rootDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

describe('type safety audit', () => {
  it('flags tracked JavaScript source, explicit any, and TypeScript suppression comments', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-type-audit-'));

    try {
      await writeFixture(rootDir, 'apps/api/src/legacy.js', 'export const legacy = true;');
      await writeFixture(rootDir, 'apps/api/src/bad.ts', [
        'const payload: any = {};',
        '// @ts-ignore',
        'export const value = payload;'
      ].join('\n'));

      const violations = await collectTypeSafetyViolations(rootDir);

      expect(violations).toEqual([
        {
          type: 'tracked-js-source',
          file: 'apps/api/src/legacy.js',
          line: 1,
          message: 'Tracked JavaScript source is forbidden under apps/, packages/, and scripts/.'
        },
        {
          type: 'explicit-any',
          file: 'apps/api/src/bad.ts',
          line: 1,
          message: 'Explicit any is forbidden. Use unknown plus a type guard or a concrete contract type.'
        },
        {
          type: 'ts-suppression',
          file: 'apps/api/src/bad.ts',
          line: 2,
          message: 'TypeScript suppression comments are forbidden in source.'
        }
      ]);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it('ignores generated output and does not flag expect.any test matchers', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-type-audit-'));

    try {
      await writeFixture(rootDir, 'apps/web/dist/generated.js', 'export const generated = true;');
      await writeFixture(rootDir, 'apps/web/src/sample.test.ts', [
        "import { expect } from 'vitest';",
        'expect.any(String);'
      ].join('\n'));

      await expect(collectTypeSafetyViolations(rootDir)).resolves.toEqual([]);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
pnpm exec vitest run scripts/type-safety-audit.test.ts
```

Expected: FAIL because `scripts/type-safety-audit.ts` does not exist.

- [ ] **Step 3: Write the minimal audit implementation**

Create `scripts/type-safety-audit.ts`:

```ts
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

type ViolationType = 'tracked-js-source' | 'explicit-any' | 'ts-suppression';

export type TypeSafetyViolation = {
  type: ViolationType;
  file: string;
  line: number;
  message: string;
};

const SOURCE_ROOTS = ['apps', 'packages', 'scripts'];
const IGNORED_DIRS = new Set(['.git', '.pnpm', 'node_modules', 'dist', 'build', 'coverage']);
const SUPPRESSION_PATTERN = /@(ts-ignore|ts-nocheck|ts-expect-error)/;
const EXPLICIT_ANY_PATTERN =
  /(:\s*any\b|\bas\s+any\b|<any>|\bRecord<[^>]*,\s*any\b|\bPromise<\s*any\b|\bArray<\s*any\b|\bany\[\])/;

function toPosixRelative(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(rootDir: string, currentDir: string, files: string[]): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        await collectFiles(rootDir, fullPath, files);
      }
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      files.push(fullPath);
    }
  }
}

function scanTypeScriptFile(rootDir: string, filePath: string, content: string): TypeSafetyViolation[] {
  const relativeFile = toPosixRelative(rootDir, filePath);
  const violations: TypeSafetyViolation[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (SUPPRESSION_PATTERN.test(line)) {
      violations.push({
        type: 'ts-suppression',
        file: relativeFile,
        line: lineNumber,
        message: 'TypeScript suppression comments are forbidden in source.'
      });
    }

    if (EXPLICIT_ANY_PATTERN.test(line)) {
      violations.push({
        type: 'explicit-any',
        file: relativeFile,
        line: lineNumber,
        message: 'Explicit any is forbidden. Use unknown plus a type guard or a concrete contract type.'
      });
    }
  });

  return violations;
}

export async function collectTypeSafetyViolations(rootDir = process.cwd()): Promise<TypeSafetyViolation[]> {
  const files: string[] = [];
  const violations: TypeSafetyViolation[] = [];

  for (const sourceRoot of SOURCE_ROOTS) {
    const absoluteRoot = path.join(rootDir, sourceRoot);
    if (await pathExists(absoluteRoot)) {
      await collectFiles(rootDir, absoluteRoot, files);
    }
  }

  for (const filePath of files.sort()) {
    const relativeFile = toPosixRelative(rootDir, filePath);

    if (filePath.endsWith('.js')) {
      violations.push({
        type: 'tracked-js-source',
        file: relativeFile,
        line: 1,
        message: 'Tracked JavaScript source is forbidden under apps/, packages/, and scripts/.'
      });
      continue;
    }

    const content = await fs.readFile(filePath, 'utf8');
    violations.push(...scanTypeScriptFile(rootDir, filePath, content));
  }

  return violations;
}

async function main(): Promise<void> {
  const violations = await collectTypeSafetyViolations();

  if (violations.length > 0) {
    console.error('[Type Safety Audit] FAILED.');
    for (const violation of violations) {
      console.error(`  - ${violation.file}:${violation.line} ${violation.message}`);
    }
    process.exit(1);
  }

  console.log('[Type Safety Audit] PASSED.');
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isCli) {
  main().catch((error) => {
    console.error(`[Type Safety Audit] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the audit test to verify it passes**

Run:

```powershell
pnpm exec vitest run scripts/type-safety-audit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the audit against the current repo to confirm the known debt**

Run:

```powershell
pnpm exec tsx scripts/type-safety-audit.ts
```

Expected: FAIL, reporting the existing explicit `any` and `@ts-expect-error` debt. Do not wire this command into `verify:local` until Task 8.

## 4. Task 2: Shared Contracts And Worker Adapter Types

**Files:**

* Modify: `packages/shared/src/contracts/normalized-match-contract.ts`
* Modify: `packages/shared/src/contracts/normalized-market-contract.ts`
* Modify: `packages/shared/src/contracts/ingestion-run-contract.ts`
* Modify: `apps/worker/src/adapters/mock-provider-adapter.ts`
* Create: `apps/worker/src/adapters/mock-provider-adapter.test.ts`

- [ ] **Step 1: Write the failing worker adapter test**

Create `apps/worker/src/adapters/mock-provider-adapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MockProviderAdapter } from './mock-provider-adapter.js';

describe('MockProviderAdapter', () => {
  it('maps raw provider matches into normalized match contracts', () => {
    const adapter = new MockProviderAdapter();

    expect(adapter.parseMatches([
      {
        fixture_id: 'match-alpha-001',
        comp_name: 'competition-alpha',
        season_year: 'season-alpha-2026',
        home_team_tag: 'team-alpha',
        away_team_tag: 'team-beta',
        match_status: 'scheduled',
        start_utc: '2026-06-23T23:00:00Z',
        venue: 'venue-alpha',
        score_result: { home: 1, away: 0 }
      }
    ])).toEqual([
      {
        id: 'match-alpha-001',
        competitionId: 'competition-alpha',
        seasonId: 'season-alpha-2026',
        homeTeamId: 'team-alpha',
        awayTeamId: 'team-beta',
        status: 'scheduled',
        kickoffTime: '2026-06-23T23:00:00Z',
        venueName: 'venue-alpha',
        scores: { homeScore: 1, awayScore: 0 }
      }
    ]);
  });

  it('maps raw provider markets into normalized market contracts', () => {
    const adapter = new MockProviderAdapter();

    expect(adapter.parseMarkets([
      {
        market_id: 'market-alpha-001',
        fixture_ref: 'match-alpha-001',
        name_type: '1X2',
        timestamp_utc: '2026-06-23T23:01:00Z',
        selections: [
          { id: 'outcome-alpha-home', label: 'home', odds_value: 2.1 }
        ]
      }
    ])).toEqual([
      {
        id: 'market-alpha-001',
        matchId: 'match-alpha-001',
        marketName: '1X2',
        providerId: 'provider-mock-alpha',
        updatedAt: '2026-06-23T23:01:00Z',
        outcomes: [
          { outcomeId: 'outcome-alpha-home', name: 'home', odds: 2.1 }
        ]
      }
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify current behavior before type changes**

Run:

```powershell
pnpm exec vitest run apps/worker/src/adapters/mock-provider-adapter.test.ts
```

Expected: PASS. This is a characterization test; it protects behavior while types are tightened.

- [ ] **Step 3: Add shared contract types**

Modify `packages/shared/src/contracts/normalized-match-contract.ts` to export these types above the existing contract constant:

```ts
export type NormalizedMatchStatus = 'scheduled' | 'in_play' | 'completed';

export type NormalizedScore = {
  homeScore: number;
  awayScore: number;
};

export type NormalizedMatch = {
  id: string;
  competitionId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  status: NormalizedMatchStatus;
  kickoffTime: string;
  scores?: NormalizedScore;
  venueName?: string;
};
```

Modify `packages/shared/src/contracts/normalized-market-contract.ts` to export:

```ts
export type NormalizedMarketOutcome = {
  outcomeId: string;
  name: string;
  odds: number;
};

export type NormalizedMarket = {
  id: string;
  matchId: string;
  marketName: string;
  providerId: string;
  updatedAt: string;
  outcomes: NormalizedMarketOutcome[];
};
```

Modify `packages/shared/src/contracts/ingestion-run-contract.ts` to export:

```ts
export type IngestionRunStatus = 'success' | 'partial_failure' | 'failed';

export type IngestionRunMetrics = {
  processedCount: number;
  successCount: number;
  skippedCount: number;
};

export type IngestionRun = {
  id: string;
  providerId: string;
  status: IngestionRunStatus;
  startTime: string;
  endTime: string;
  metrics: IngestionRunMetrics;
  errorMessage?: string;
};
```

- [ ] **Step 4: Replace worker adapter `any` with raw and normalized types**

Modify `apps/worker/src/adapters/mock-provider-adapter.ts`:

```ts
import type { NormalizedMarket, NormalizedMatch, NormalizedMatchStatus } from '../../../../packages/shared/src/contracts/index.js';

type RawProviderMatch = {
  fixture_id: string;
  comp_name: string;
  season_year: string;
  home_team_tag: string;
  away_team_tag: string;
  match_status: NormalizedMatchStatus;
  start_utc: string;
  venue?: string;
  score_result?: {
    home: number;
    away: number;
  };
};

type RawProviderMarketSelection = {
  id: string;
  label: string;
  odds_value: number;
};

type RawProviderMarket = {
  market_id: string;
  fixture_ref: string;
  name_type: string;
  timestamp_utc: string;
  selections: RawProviderMarketSelection[];
};

export class MockProviderAdapter {
  providerId = 'provider-mock-alpha';

  parseMatches(rawMatches: RawProviderMatch[]): NormalizedMatch[] {
    if (!Array.isArray(rawMatches)) {
      throw new Error('Raw matches must be an array');
    }

    return rawMatches.map((raw) => {
      const normalized: NormalizedMatch = {
        id: raw.fixture_id,
        competitionId: raw.comp_name,
        seasonId: raw.season_year,
        homeTeamId: raw.home_team_tag,
        awayTeamId: raw.away_team_tag,
        status: raw.match_status,
        kickoffTime: raw.start_utc
      };

      if (raw.venue) {
        normalized.venueName = raw.venue;
      }

      if (raw.score_result) {
        normalized.scores = {
          homeScore: raw.score_result.home,
          awayScore: raw.score_result.away
        };
      }

      return normalized;
    });
  }

  parseMarkets(rawMarkets: RawProviderMarket[]): NormalizedMarket[] {
    if (!Array.isArray(rawMarkets)) {
      throw new Error('Raw markets must be an array');
    }

    return rawMarkets.map((raw) => ({
      id: raw.market_id,
      matchId: raw.fixture_ref,
      marketName: raw.name_type,
      providerId: this.providerId,
      updatedAt: raw.timestamp_utc,
      outcomes: raw.selections.map((selection) => ({
        outcomeId: selection.id,
        name: selection.label,
        odds: selection.odds_value
      }))
    }));
  }
}
```

- [ ] **Step 5: Run focused worker checks**

Run:

```powershell
pnpm exec vitest run apps/worker/src/adapters/mock-provider-adapter.test.ts
pnpm run typecheck
```

Expected: PASS.

## 5. Task 3: Typed Memory Ingestion Repository

**Files:**

* Modify: `apps/worker/src/repositories/memory-ingestion-repository.ts`
* Create: `apps/worker/src/repositories/memory-ingestion-repository.test.ts`
* Modify: `apps/worker/src/jobs/mock-ingestion-job.ts`

- [ ] **Step 1: Write the failing repository behavior test**

Create `apps/worker/src/repositories/memory-ingestion-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { IngestionRun, NormalizedMarket, NormalizedMatch } from '../../../../packages/shared/src/contracts/index.js';
import { memoryIngestionRepository } from './memory-ingestion-repository.js';

describe('memoryIngestionRepository', () => {
  it('stores cloned typed matches, markets, and run reports', () => {
    memoryIngestionRepository.clear();

    const match: NormalizedMatch = {
      id: 'match-alpha-001',
      competitionId: 'competition-alpha',
      seasonId: 'season-alpha-2026',
      homeTeamId: 'team-alpha',
      awayTeamId: 'team-beta',
      status: 'scheduled',
      kickoffTime: '2026-06-23T23:00:00Z'
    };
    const market: NormalizedMarket = {
      id: 'market-alpha-001',
      matchId: 'match-alpha-001',
      marketName: '1X2',
      providerId: 'provider-mock-alpha',
      updatedAt: '2026-06-23T23:01:00Z',
      outcomes: [{ outcomeId: 'outcome-alpha-home', name: 'home', odds: 2.1 }]
    };
    const run: IngestionRun = {
      id: 'run-alpha-001',
      providerId: 'provider-mock-alpha',
      status: 'success',
      startTime: '2026-06-23T23:00:00Z',
      endTime: '2026-06-23T23:02:00Z',
      metrics: { processedCount: 2, successCount: 2, skippedCount: 0 }
    };

    memoryIngestionRepository.saveMatch(match);
    memoryIngestionRepository.saveMarket(market);
    memoryIngestionRepository.saveRun(run);

    match.status = 'completed';

    expect(memoryIngestionRepository.getMatch('match-alpha-001')?.status).toBe('scheduled');
    expect(memoryIngestionRepository.getMarket('market-alpha-001')?.outcomes[0]?.odds).toBe(2.1);
    expect(memoryIngestionRepository.listRuns()).toEqual([run]);
  });
});
```

- [ ] **Step 2: Run the test to verify current behavior before type changes**

Run:

```powershell
pnpm exec vitest run apps/worker/src/repositories/memory-ingestion-repository.test.ts
```

Expected: PASS as a characterization test.

- [ ] **Step 3: Replace repository `any` with shared contract types**

Modify `apps/worker/src/repositories/memory-ingestion-repository.ts`:

```ts
import type { IngestionRun, NormalizedMarket, NormalizedMatch } from '../../../../packages/shared/src/contracts/index.js';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class MemoryIngestionRepository {
  private matches = new Map<string, NormalizedMatch>();
  private markets = new Map<string, NormalizedMarket>();
  private runs: IngestionRun[] = [];

  saveMatch(match: NormalizedMatch): void {
    this.matches.set(match.id, cloneValue(match));
  }

  saveMarket(market: NormalizedMarket): void {
    this.markets.set(market.id, cloneValue(market));
  }

  saveRun(run: IngestionRun): void {
    this.runs.push(cloneValue(run));
  }

  getMatch(id: string): NormalizedMatch | undefined {
    return this.matches.get(id);
  }

  getMarket(id: string): NormalizedMarket | undefined {
    return this.markets.get(id);
  }

  listMatches(): NormalizedMatch[] {
    return Array.from(this.matches.values());
  }

  listMarkets(): NormalizedMarket[] {
    return Array.from(this.markets.values());
  }

  listRuns(): IngestionRun[] {
    return [...this.runs];
  }

  clear(): void {
    this.matches.clear();
    this.markets.clear();
    this.runs = [];
  }
}

export const memoryIngestionRepository = new MemoryIngestionRepository();
export default memoryIngestionRepository;
```

Modify `apps/worker/src/jobs/mock-ingestion-job.ts` only where needed so the run report object satisfies `IngestionRun`.

- [ ] **Step 4: Run focused worker checks**

Run:

```powershell
pnpm exec vitest run apps/worker/src/adapters/mock-provider-adapter.test.ts apps/worker/src/repositories/memory-ingestion-repository.test.ts apps/worker/src/validators/ingestion-validator.test.ts
pnpm run phase3:verify
pnpm run typecheck
```

Expected: PASS.

## 6. Task 4: Local AI Prediction Contracts

**Files:**

* Create: `apps/local-ai/src/contracts/mock-prediction-contracts.ts`
* Modify: `apps/local-ai/src/input/input-candidate-validator.ts`
* Modify: `apps/local-ai/src/input/mock-input-candidate.ts`
* Modify: `apps/local-ai/src/engines/mock-prediction-engine.ts`
* Modify: `apps/local-ai/src/output/prediction-envelope-builder.ts`
* Modify: `apps/local-ai/src/explainability/mock-explanation-refusal.ts`

- [ ] **Step 1: Write the failing contract-focused test additions**

Extend `apps/local-ai/src/engines/mock-prediction-engine.test.ts` with this case:

```ts
it('rejects non-object input candidates without using loose any payloads', () => {
  expect(() => runMockPrediction(null)).toThrow('Input candidate must be a non-null object.');
});
```

- [ ] **Step 2: Run the focused tests**

Run:

```powershell
pnpm exec vitest run apps/local-ai/src/engines/mock-prediction-engine.test.ts apps/local-ai/src/input/input-candidate-validator.test.ts
```

Expected: PASS or FAIL only if the current error message differs. If it fails because the error message differs, update the implementation in Step 4 to produce the exact message above.

- [ ] **Step 3: Create local-ai contract types and guards**

Create `apps/local-ai/src/contracts/mock-prediction-contracts.ts`:

```ts
export type InputCandidateTrace = {
  workerRunId: string;
  adapterVersion?: string;
};

export type InputCandidate = {
  inputCandidateId: string;
  matchId: string;
  competitionId: string;
  seasonId: string;
  sourceProviderId: string;
  ingestedAt: string;
  freshnessStatus: string;
  validationStatus: 'passed' | 'warning' | 'failed';
  availableMarkets?: string[];
  dataQualityIssues?: string[];
  trace: InputCandidateTrace;
};

export type InputCandidateValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  candidate?: InputCandidate;
};

export type PredictionEnvelopeTrace = {
  inputCandidateId: string;
  workerRunId: string;
  sourceProviderId: string;
  engineVersion: string;
};

export type PredictionEnvelope = {
  predictionId: string;
  matchId: string;
  competitionId: string;
  seasonId: string;
  generatedAt: string;
  engineMode: 'mock';
  predictionAvailable: false;
  confidenceLabel: 'not_available';
  outputSummary: string;
  trace: PredictionEnvelopeTrace;
  warnings: string[];
};

export type PredictionEnvelopeBuildInput = {
  matchId: string;
  competitionId: string;
  seasonId: string;
  engineMode?: 'mock';
  predictionAvailable?: false;
  confidenceLabel?: 'not_available';
  outputSummary?: string;
  traceInput?: Partial<PredictionEnvelopeTrace>;
  warnings?: string[];
};

export type MockExplanationRefusal = {
  explanationAvailable: false;
  reason: string;
  references: {
    predictionId?: string;
    traceId?: string;
  };
  text?: string;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

export function readStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    ? value
    : undefined;
}
```

- [ ] **Step 4: Replace local-ai `any` with contract types**

Modify `apps/local-ai/src/input/input-candidate-validator.ts`:

```ts
import type { InputCandidateValidation } from '../contracts/mock-prediction-contracts.js';
import { isRecord, readString, readStringArray } from '../contracts/mock-prediction-contracts.js';

export function validateInputCandidate(candidate: unknown): InputCandidateValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(candidate)) {
    return {
      valid: false,
      errors: ['Input candidate must be a non-null object.'],
      warnings
    };
  }

  const traceValue = candidate.trace;
  const trace = isRecord(traceValue) ? traceValue : null;

  const requiredFields = [
    'inputCandidateId',
    'matchId',
    'competitionId',
    'seasonId',
    'sourceProviderId',
    'ingestedAt',
    'freshnessStatus',
    'validationStatus'
  ];

  for (const field of requiredFields) {
    if (!readString(candidate, field)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (!trace) {
    errors.push('Missing required field: trace');
  } else if (!readString(trace, 'workerRunId')) {
    errors.push('Missing required trace field: workerRunId');
  }

  if (readString(candidate, 'validationStatus') === 'failed') {
    warnings.push('Input candidate had failed validationStatus at ingestion.');
  }

  const dataQualityIssues = readStringArray(candidate, 'dataQualityIssues');
  if (dataQualityIssues) {
    for (const issue of dataQualityIssues) {
      warnings.push(`Ingestion Quality Warning: ${issue}`);
    }
  }

  if (errors.length > 0 || !trace) {
    return { valid: false, errors, warnings };
  }

  return {
    valid: true,
    errors,
    warnings,
    candidate: {
      inputCandidateId: readString(candidate, 'inputCandidateId')!,
      matchId: readString(candidate, 'matchId')!,
      competitionId: readString(candidate, 'competitionId')!,
      seasonId: readString(candidate, 'seasonId')!,
      sourceProviderId: readString(candidate, 'sourceProviderId')!,
      ingestedAt: readString(candidate, 'ingestedAt')!,
      freshnessStatus: readString(candidate, 'freshnessStatus')!,
      validationStatus: readString(candidate, 'validationStatus') as 'passed' | 'warning' | 'failed',
      availableMarkets: readStringArray(candidate, 'availableMarkets'),
      dataQualityIssues,
      trace: {
        workerRunId: readString(trace, 'workerRunId')!,
        adapterVersion: readString(trace, 'adapterVersion')
      }
    }
  };
}
```

Modify `apps/local-ai/src/input/mock-input-candidate.ts`:

```ts
import type { InputCandidate } from '../contracts/mock-prediction-contracts.js';

export const mockInputCandidate: InputCandidate = {
  inputCandidateId: 'input-candidate-alpha-001',
  matchId: 'match-alpha-001',
  competitionId: 'competition-alpha',
  seasonId: 'season-alpha-2026',
  sourceProviderId: 'provider-mock-alpha',
  ingestedAt: '2026-06-23T23:00:00Z',
  freshnessStatus: 'fresh',
  validationStatus: 'passed',
  availableMarkets: ['1X2'],
  dataQualityIssues: [],
  trace: {
    workerRunId: 'run-alpha-001',
    adapterVersion: '1.0.0-mock'
  }
};
```

Modify `apps/local-ai/src/output/prediction-envelope-builder.ts` so its parameter type is `PredictionEnvelopeBuildInput` and return type is `PredictionEnvelope`.

Modify `apps/local-ai/src/engines/mock-prediction-engine.ts` so `runMockPrediction(inputCandidate: unknown)` validates first, then uses `validation.candidate`.

Modify `apps/local-ai/src/explainability/mock-explanation-refusal.ts` so it accepts `PredictionEnvelope | null | undefined` and returns `MockExplanationRefusal`.

- [ ] **Step 5: Run focused local-ai checks**

Run:

```powershell
pnpm exec vitest run apps/local-ai/src/engines/mock-prediction-engine.test.ts apps/local-ai/src/input/input-candidate-validator.test.ts
pnpm run phase4:verify
pnpm run typecheck
```

Expected: PASS.

## 7. Task 5: API JSON Boundary Types

**Files:**

* Create: `apps/api/src/routes/json-body.ts`
* Create: `apps/api/src/routes/json-body.test.ts`
* Modify: `apps/api/src/routes/mock-prediction.ts`
* Modify: `apps/api/src/routes/mock-explanation.ts`

- [ ] **Step 1: Write the failing JSON helper tests**

Create `apps/api/src/routes/json-body.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseJsonObjectBody, readNestedStringField, readStringField } from './json-body.js';

describe('json-body helpers', () => {
  it('parses empty request bodies as empty objects', () => {
    expect(parseJsonObjectBody('   ')).toEqual({});
  });

  it('rejects malformed JSON and non-object payloads', () => {
    expect(() => parseJsonObjectBody('{bad-json')).toThrow('Invalid JSON request body');
    expect(() => parseJsonObjectBody('[]')).toThrow('JSON request body must be an object');
  });

  it('reads string fields through unknown-safe helpers', () => {
    const payload = parseJsonObjectBody(JSON.stringify({
      matchId: 'match-alpha-001',
      trace: { workerRunId: 'run-alpha-001' }
    }));

    expect(readStringField(payload, 'matchId', 'unknown-match')).toBe('match-alpha-001');
    expect(readStringField(payload, 'missing', 'fallback')).toBe('fallback');
    expect(readNestedStringField(payload, 'trace', 'workerRunId', 'unknown-run')).toBe('run-alpha-001');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
pnpm exec vitest run apps/api/src/routes/json-body.test.ts
```

Expected: FAIL because `apps/api/src/routes/json-body.ts` does not exist.

- [ ] **Step 3: Implement unknown-safe JSON helpers**

Create `apps/api/src/routes/json-body.ts`:

```ts
export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJsonObjectBody(rawBody: string): JsonObject {
  if (!rawBody.trim()) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new Error('Invalid JSON request body');
  }

  if (!isJsonObject(parsed)) {
    throw new Error('JSON request body must be an object');
  }

  return parsed;
}

export function readStringField(payload: JsonObject, key: string, fallback: string): string {
  const value = payload[key];
  return typeof value === 'string' ? value : fallback;
}

export function readNestedStringField(
  payload: JsonObject,
  parentKey: string,
  childKey: string,
  fallback: string
): string {
  const parent = payload[parentKey];
  if (!isJsonObject(parent)) {
    return fallback;
  }

  const value = parent[childKey];
  return typeof value === 'string' ? value : fallback;
}
```

- [ ] **Step 4: Replace route `any` with JSON helper types**

Modify both `apps/api/src/routes/mock-prediction.ts` and `apps/api/src/routes/mock-explanation.ts`:

* Import `IncomingMessage` and `ServerResponse` from `http`.
* Type route handlers as `(req: IncomingMessage, res: ServerResponse) => void`.
* Replace `Record<string, any>` payloads with `JsonObject`.
* Replace `JSON.parse(body)` with `parseJsonObjectBody(body)`.
* Replace `err.message` with `err instanceof Error ? err.message : String(err)`.
* Use `readStringField` and `readNestedStringField` for fallback envelope fields.

- [ ] **Step 5: Run focused API checks**

Run:

```powershell
pnpm exec vitest run apps/api/src/routes/json-body.test.ts apps/api/src/routes/health.test.ts
pnpm run typecheck
pnpm run phase4:integration
```

Expected: PASS.

## 8. Task 6: Service Worker And Test Suppression Removal

**Files:**

* Modify: `apps/web/public/service-worker.ts`
* Modify: `apps/web/src/pwa/register-service-worker.test.ts`

- [ ] **Step 1: Run existing PWA tests before edits**

Run:

```powershell
pnpm exec vitest run apps/web/src/pwa/register-service-worker.test.ts
pnpm run pwa:verify
```

Expected: PASS. This protects current browser compatibility behavior.

- [ ] **Step 2: Remove the PWA test suppression**

Modify `apps/web/src/pwa/register-service-worker.test.ts`:

```ts
async function importFreshRegisterModule() {
  const testImportPath = './register-service-worker.js?test-localhost-cleanup';
  await import(testImportPath);
}
```

Remove the `@ts-expect-error` comment.

- [ ] **Step 3: Replace service worker `any` with WebWorker types**

Modify `apps/web/public/service-worker.ts`:

```ts
/// <reference lib="webworker" />

export {};

const CACHE_NAME = 'miraichi-shell-v5-phase-5-12-quality-up';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/packages/ui/src/index.css',
  '/apps/web/src/shell-entry.js',
  '/apps/web/src/config/navigation-tabs.js',
  '/apps/web/src/components/app-shell.js',
  '/apps/web/src/components/bottom-navigation.js',
  '/apps/web/src/components/html.js',
  '/apps/web/src/services/settings-service.js',
  '/apps/web/src/services/i18n-service.js'
] as const;

const serviceWorkerScope = self as unknown as ServiceWorkerGlobalScope;

serviceWorkerScope.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([...ASSETS_TO_CACHE]))
  );
  serviceWorkerScope.skipWaiting();
});

serviceWorkerScope.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheName === CACHE_NAME) {
          return Promise.resolve(false);
        }
        return caches.delete(cacheName);
      })
    ))
  );
  serviceWorkerScope.clients.claim();
});

serviceWorkerScope.addEventListener('fetch', (event: FetchEvent) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ai/')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  const isShellAsset = ASSETS_TO_CACHE.some((asset) => {
    if (asset === '/') {
      return url.pathname === '/' || url.pathname === '/index.html';
    }
    return url.pathname === asset;
  });

  if (isShellAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 4: Run PWA checks**

Run:

```powershell
pnpm exec vitest run apps/web/src/pwa/register-service-worker.test.ts
pnpm run pwa:verify
pnpm run typecheck
```

Expected: PASS.

## 9. Task 7: Script And Config Residual `any` Removal

**Files:**

* Modify: `scripts/verify-lifecycle.ts`
* Modify: `packages/config/src/competition-registry.mock.ts`

- [ ] **Step 1: Run existing tests before edits**

Run:

```powershell
pnpm exec vitest run scripts/verify-lifecycle.test.ts packages/config/src/competition-registry.mock.test.ts
```

Expected: PASS.

- [ ] **Step 2: Replace script JSON `any` with JSON value types**

Modify `scripts/verify-lifecycle.ts`:

```ts
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = {
  [key: string]: JsonValue;
};

type PackageManifest = {
  path: string;
  json: JsonObject;
};

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
```

Then replace:

* `Record<string, any>` with `JsonObject`
* `Promise<any>` with `Promise<JsonObject>`
* direct `manifest.json.name` reads with `readString(manifest.json.name, '(unnamed package)')`
* script map reads with `const scripts = isJsonObject(manifest.json.scripts) ? manifest.json.scripts : {};`

- [ ] **Step 3: Replace config `any` with unknown**

Modify `packages/config/src/competition-registry.mock.ts`:

```ts
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateConfig(config: unknown): boolean {
  if (!isRecord(config)) return true;

  const serialized = JSON.stringify(config);

  if (/world\s*cup/i.test(serialized) || /premier\s*league/i.test(serialized)) {
    throw new Error("[Config Violation] Hardcoded competition names like 'World Cup' or 'Premier League' are strictly forbidden.");
  }

  const allowedKeys = [
    'competitionId',
    'seasonId',
    'matchId',
    'teamId',
    'port',
    'host',
    'env',
    'name',
    'sport',
    'status'
  ];

  for (const key of Object.keys(config)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`[Config Error] Invalid configuration key: '${key}'`);
    }
  }

  return true;
}
```

- [ ] **Step 4: Run focused checks**

Run:

```powershell
pnpm exec vitest run scripts/verify-lifecycle.test.ts packages/config/src/competition-registry.mock.test.ts
pnpm run verify:lifecycle
pnpm run typecheck
```

Expected: PASS.

## 10. Task 8: Strict Compiler Flags And Local Verification Wiring

**Files:**

* Create: `scripts/typescript-strictness-policy.test.ts`
* Modify: `tsconfig.base.json`
* Modify: `package.json`

- [ ] **Step 1: Write the failing strictness policy test**

Create `scripts/typescript-strictness-policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

describe('TypeScript strictness policy', () => {
  it('enables strict source-level compiler flags', () => {
    const tsconfig = readJson('tsconfig.base.json');

    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.allowJs).toBe(false);
    expect(tsconfig.compilerOptions.noImplicitAny).toBe(true);
    expect(tsconfig.compilerOptions.useUnknownInCatchVariables).toBe(true);
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(tsconfig.compilerOptions.exactOptionalPropertyTypes).toBe(true);
    expect(tsconfig.compilerOptions.noPropertyAccessFromIndexSignature).toBe(true);
    expect(tsconfig.compilerOptions.skipLibCheck).toBe(false);
  });

  it('wires type-safety audit into local verification', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.scripts['audit:type-safety']).toBe('tsx scripts/type-safety-audit.ts');
    expect(packageJson.scripts['verify:local']).toContain('pnpm run audit:type-safety');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
pnpm exec vitest run scripts/typescript-strictness-policy.test.ts
```

Expected: FAIL because the strict flags and package script wiring are not active yet.

- [ ] **Step 3: Enable strict flags**

Modify `tsconfig.base.json` compiler options:

```json
{
  "strict": true,
  "allowJs": false,
  "checkJs": false,
  "noImplicitAny": true,
  "useUnknownInCatchVariables": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noPropertyAccessFromIndexSignature": true,
  "skipLibCheck": false
}
```

Keep existing module, target, `resolveJsonModule`, `isolatedModules`, `esModuleInterop`, and include paths.

- [ ] **Step 4: Wire type-safety audit into package scripts**

Modify `package.json`:

```json
"audit:type-safety": "tsx scripts/type-safety-audit.ts",
"verify:local": "pnpm run verify:lifecycle && pnpm run test:unit && pnpm run lint && pnpm run typecheck && pnpm run audit && pnpm run audit:type-safety"
```

- [ ] **Step 5: Run strictness checks**

Run:

```powershell
pnpm exec vitest run scripts/type-safety-audit.test.ts scripts/typescript-strictness-policy.test.ts
pnpm run audit:type-safety
pnpm run typecheck
pnpm run verify:local
```

Expected: PASS. If `skipLibCheck: false` fails only inside third-party declaration files, stop and report the exact third-party error before deciding whether to keep `skipLibCheck: true` with a documented exception. Do not silently weaken source strictness flags.

## 11. Task 9: Boundary Verification And Review Evidence

**Files:**

* Create: `ops/PHASE-6-TYPESCRIPT-STRICTNESS-HARDENING-REVIEW.md`
* Modify: `CHANGELOG.md`
* Modify: `PROJECT_PLAN.md`
* Modify: `ROADMAP.md`
* Modify: `docs/README.md`
* Modify: `ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md`

- [ ] **Step 1: Run full verification**

Run:

```powershell
pnpm run verify:local
pnpm run test:integration
pnpm run build:web-static
git diff --check
git ls-files apps packages scripts | rg "\.js$"
rg -n "\bany\b|@ts-ignore|@ts-nocheck|@ts-expect-error" apps packages scripts -g "*.ts"
```

Expected:

* `verify:local`: PASS
* `test:integration`: PASS
* `build:web-static`: PASS
* `git diff --check`: exit 0
* `git ls-files ... | rg "\.js$"`: no output, exit 1
* final `rg`: no source violations except natural-language words such as `expect.any` only if the audit script does not flag them

- [ ] **Step 2: Create the review document**

Create `ops/PHASE-6-TYPESCRIPT-STRICTNESS-HARDENING-REVIEW.md` with:

```markdown
# Phase 6 TypeScript Strictness Hardening Review

## Purpose
Record the completed `phase:code-slice Phase 6 TypeScript strictness hardening` result.

## Status
- **Status**: Completed - Verified

## Scope
This review covers TypeScript source-level strictness for `apps/`, `packages/`, and `scripts/`.

This slice does not add business logic, prediction algorithms, betting formulas, production schemas, secrets, real provider selection, auth, cloud sync, production promotion, or CI deployment.

## Gate Result

| Requirement | Result | Evidence |
| :--- | :---: | :--- |
| Strict source flags enabled | PASS | `tsconfig.base.json` has `noImplicitAny`, `useUnknownInCatchVariables`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `noPropertyAccessFromIndexSignature` enabled. |
| Tracked JS source blocked | PASS | `git ls-files apps packages scripts | rg "\.js$"` returned no source hits. |
| Explicit `any` blocked | PASS | `pnpm run audit:type-safety` passed. |
| Type suppressions blocked | PASS | `pnpm run audit:type-safety` passed. |
| Local verification passed | PASS | `pnpm run verify:local` passed. |
| Integration verification passed | PASS | `pnpm run test:integration` passed. |
| Static artifact build passed | PASS | `pnpm run build:web-static` passed. |

## Known Risks
- Browser-facing `.js` URLs remain compatibility surfaces backed by TypeScript source.
- This is source-level type safety; runtime data from HTTP, JSON, and provider feeds still requires validation at boundaries.

## Recommended Next Phase

```text
phase:staging Phase 6 hardened staging process
```
```

- [ ] **Step 3: Update status docs**

Update:

* `docs/README.md` - add link to `ops/PHASE-6-TYPESCRIPT-STRICTNESS-HARDENING-IMPLEMENTATION-PLAN.md` and review doc.
* `PROJECT_PLAN.md` and `ROADMAP.md` - mark the implementation plan and strictness hardening slice completed after verification.
* `CHANGELOG.md` - add strictness hardening entry.
* `ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md` - insert strictness hardening before Phase 6 staging.

- [ ] **Step 4: Final verification after docs**

Run:

```powershell
pnpm run verify:lifecycle
git diff --check
```

Expected: PASS.

## 12. Execution Gate

Do not start code until the owner explicitly runs a `phase:code-slice` command for the first strictness slice.

Recommended first code slice:

```text
phase:code-slice Phase 6 type-safety audit gate
```

After that, execute in order:

1. `phase:code-slice Phase 6 type-safety audit gate`
2. `phase:code-slice Phase 6 shared and worker contract strict types`
3. `phase:code-slice Phase 6 local-ai prediction contract strict types`
4. `phase:code-slice Phase 6 API JSON boundary strict types`
5. `phase:code-slice Phase 6 service-worker strict types`
6. `phase:code-slice Phase 6 scripts and config residual any removal`
7. `phase:code-slice Phase 6 strict compiler flags and audit wiring`
8. `phase:integration-test Phase 6 TypeScript strictness hardening`
9. `phase:staging Phase 6 hardened staging process`

## 13. Self-Review

Spec coverage:

* Full TypeScript-only source forward path: Task 1 and Task 8.
* Remove `noImplicitAny: false`: Task 8.
* Remove explicit source `any`: Tasks 2 through 7.
* Replace unsafe runtime boundaries with `unknown` and guards: Tasks 4, 5, and 7.
* Preserve browser `.js` URLs: Task 6 keeps service worker and shell URL compatibility.
* Keep forbidden scope out: Source Decisions and every task boundary explicitly block production, provider, prediction, betting, schema, auth, and secrets.

Placeholder scan:

* No unresolved placeholder markers are used.
* Every code-changing task names exact files, focused tests, commands, and expected results.

Type consistency:

* Shared ingestion types flow from `packages/shared/src/contracts/*` into worker adapter and repository.
* Local AI input and envelope types live in `apps/local-ai/src/contracts/mock-prediction-contracts.ts`.
* API JSON helpers use `Record<string, unknown>`, not `Record<string, any>`.
* The audit script blocks future `.js` source, explicit `any`, and TypeScript suppression comments.
