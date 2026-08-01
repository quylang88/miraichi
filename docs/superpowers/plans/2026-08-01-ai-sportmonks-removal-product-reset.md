# AI And Sportmonks Removal Product Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove local AI and Sportmonks from the active Miraichi tree while preserving the owner-only four-tab match, bet, odds, bankroll, serving-store, and cloud-persistence product.

**Architecture:** Use a controlled purge. First make the product boundary executable as a verifier, then detach AI runtime surfaces, remove provider-specific source/data, delete AI applications and phase artifacts, and finally rewrite the active lifecycle documents. The retained runtime is `apps/web -> apps/api -> serving repository/Supabase`; `apps/worker` remains available for a later approved website crawler.

**Tech Stack:** TypeScript 6, Node.js 18+, pnpm workspaces, Vitest, vanilla TypeScript web shell, Supabase/Postgres adapter, filesystem JSON/JSONL serving store.

## Global Constraints

- Keep Git history; do not rewrite existing commits.
- Delete untracked `apps/local-ai/.venv` and Sportmonks raw/manifests/reports permanently.
- Keep only factual fixtures, schedules, results, statuses, teams, competitions, events, lineups, and odds.
- Do not retain prediction, recommendation, value-bet, expected-goals, model-training, or explanation/chat behavior.
- Do not select or implement a replacement website source in this plan.
- Keep the application owner-only; do not add auth or multi-tenancy.
- Keep source and serving contracts competition-agnostic and allow both `national-team` and `club` competition types.
- New or modified implementation files remain TypeScript-first.
- Do not add production schemas, secrets, automatic betting calculations, stake sizing, Kelly, ROI, CLV, or risk formulas.
- Preserve manual bet, odds, bankroll, backup/import/export, and Supabase persistence behavior.

---

## File Structure

- `scripts/product-boundary-verify.ts`: reusable repository audit for forbidden runtime paths, scripts, API routes, and navigation tabs.
- `scripts/product-boundary-verify.test.ts`: isolated temporary-repository tests for the audit.
- `packages/shared/src/contracts/*`: factual match, competition, provider-neutral ingestion, manual bet, and persistence contracts.
- `apps/api/src/index.ts`: retained API routes only.
- `apps/web/src/config/navigation-tabs.ts` and `apps/web/src/components/app-shell.ts`: exactly four primary tabs.
- `scripts/providers/shared/*`: retained provider-neutral cache/manifest/provenance/warehouse primitives.
- `docs/decisions/ADR-0044-ai-sportmonks-removal-product-reset.md`: accepted decision record preventing reintroduction.
- Root lifecycle documents: current non-AI sources of truth.

---

### Task 1: Product Boundary Verifier

**Files:**
- Create: `scripts/product-boundary-verify.test.ts`
- Create: `scripts/product-boundary-verify.ts`

**Interfaces:**
- Produces: `auditProductBoundary(rootDir: string): Promise<string[]>`.
- Produces: CLI output `[Product Boundary] PASSED` or one error per violation.
- Consumes: filesystem tree plus root `package.json`, API entry source, and navigation source.

- [ ] **Step 1: Write the failing verifier unit tests**

Create a temporary fixture with forbidden paths and scripts, then a clean fixture:

```ts
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { auditProductBoundary } from './product-boundary-verify.js';

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'miraichi-product-boundary-'));
  await mkdir(join(root, 'apps/api/src'), { recursive: true });
  await mkdir(join(root, 'apps/web/src/config'), { recursive: true });
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: {} }));
  await writeFile(join(root, 'apps/api/src/index.ts'), "const route = '/api/v1/health';\n");
  await writeFile(join(root, 'apps/web/src/config/navigation-tabs.ts'), "['today','matches','bets','bankroll']\n");
  return root;
}

describe('product boundary verifier', () => {
  it('reports forbidden product paths and commands', async () => {
    const root = await fixture();
    await mkdir(join(root, 'apps/local-ai'), { recursive: true });
    await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { 'dev:local-ai': 'tsx app.ts' } }));
    expect(await auditProductBoundary(root)).toEqual(expect.arrayContaining([
      'Forbidden path exists: apps/local-ai',
      'Forbidden package script: dev:local-ai'
    ]));
  });

  it('accepts the four-tab non-AI product boundary', async () => {
    expect(await auditProductBoundary(await fixture())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and observe failure**

Run:

```text
pnpm exec vitest run scripts/product-boundary-verify.test.ts
```

Expected: FAIL because `./product-boundary-verify.js` does not exist.

- [ ] **Step 3: Implement the verifier**

Implement these exact boundaries:

```ts
export const FORBIDDEN_PRODUCT_PATHS = [
  'apps/local-ai',
  'scripts/providers/sportmonks',
  'apps/api/data/providers/sportmonks'
] as const;

const forbiddenScript = /(^dev:local-ai$|^phase4:|^phase8:|sportmonks)/i;
const forbiddenApiRoute = /\/api\/v1\/(predictions|chat|mock\/predict|mock\/explain)/;

export async function auditProductBoundary(rootDir: string): Promise<string[]> {
  // Check forbidden paths, package script names, API route source, and exact
  // navigation IDs ['today', 'matches', 'bets', 'bankroll'].
}
```

The CLI must call `auditProductBoundary(process.cwd())`, print every error, and set exit code `1`; otherwise print `[Product Boundary] PASSED`.

- [ ] **Step 4: Run focused verification**

Run:

```text
pnpm exec vitest run scripts/product-boundary-verify.test.ts
pnpm exec tsx scripts/product-boundary-verify.ts
```

Expected: unit tests PASS; CLI FAILS against the current repository and lists the existing AI/Sportmonks boundary violations.

- [ ] **Step 5: Commit**

```text
git add scripts/product-boundary-verify.ts scripts/product-boundary-verify.test.ts
git commit -m "test: define non-ai product boundary"
```

---

### Task 2: Competition-Agnostic Factual Data Contracts

**Files:**
- Modify: `packages/shared/src/contracts/local-match-contracts.ts`
- Modify: `packages/shared/src/contracts/local-match-contracts.test.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.test.ts`
- Modify: `apps/api/src/repositories/serving-match-store.ts`
- Modify: `apps/api/src/repositories/serving-match-store.test.ts`
- Modify: `apps/api/src/repositories/serving-match-store-repository.test.ts`
- Modify: `apps/api/src/services/cloud-match-snapshot-sync.ts`
- Modify: `apps/api/src/services/cloud-match-snapshot-sync.test.ts`
- Modify: `scripts/build-serving-match-store.ts`
- Modify: `scripts/build-serving-match-store.test.ts`
- Modify: `scripts/providers/shared/raw-cache.test.ts`
- Modify: `scripts/providers/shared/manifest.test.ts`
- Modify: `scripts/providers/shared/entity-resolution.test.ts`
- Modify: `scripts/providers/shared/provenance.test.ts`
- Modify: `scripts/providers/shared/canonical-warehouse.ts`

**Interfaces:**
- Produces: `LocalCompetitionType = 'national-team' | 'club'`.
- Produces: `ServingMatchScope = 'configured-competitions'`.
- Preserves: `LocalDataSourceId`, `ProviderId`, `LocalMatch`, `CanonicalCompetition`, and serving-store public functions.

- [ ] **Step 1: Change tests to the new boundary**

Add a valid club match case and replace all Sportmonks fixtures with `manual-snapshot`:

```ts
expect(validateLocalMatch({
  ...validMatch,
  competition: { ...validMatch.competition, type: 'club' }
})).toEqual({ ok: true });
```

Update serving-store expectations to:

```ts
expect(manifest.scopes[0].scope).toBe('configured-competitions');
expect(snapshot.sources[0].sourceId).toBe('manual-snapshot');
```

Update cloud-sync tests so club matches are accepted and only invalid statuses/contracts are rejected.

- [ ] **Step 2: Run tests and observe failure**

Run:

```text
pnpm exec vitest run packages/shared/src/contracts/local-match-contracts.test.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts apps/api/src/repositories/serving-match-store.test.ts apps/api/src/repositories/serving-match-store-repository.test.ts apps/api/src/services/cloud-match-snapshot-sync.test.ts scripts/build-serving-match-store.test.ts scripts/providers/shared/raw-cache.test.ts scripts/providers/shared/manifest.test.ts scripts/providers/shared/entity-resolution.test.ts scripts/providers/shared/provenance.test.ts
```

Expected: FAIL because club matches are rejected and Sportmonks is still hardcoded.

- [ ] **Step 3: Implement factual, configurable competition contracts**

Use these exact shapes:

```ts
export type LocalCompetitionType = 'national-team' | 'club';

export interface LocalCompetitionRef {
  id: string;
  name: string;
  type: LocalCompetitionType;
  season: string;
}

export type ServingMatchScope = 'configured-competitions';
```

Remove `'sportmonks'` from `LocalDataSourceId`, `ProviderId`, and validation arrays. Change `CanonicalCompetition.type` to `LocalCompetitionType`. Remove validation that rejects `club`. Change serving-store and build-script defaults from `national-team` to `configured-competitions`. Remove the cloud-sync club rejection. Replace the Sportmonks-specific comment in `canonical-warehouse.ts` with `Provider-specific adapters may write to it; the warehouse survives adapter replacement.`

- [ ] **Step 4: Run focused tests and typecheck**

Run the Step 2 command, then:

```text
pnpm run typecheck
```

Expected: all focused tests and typecheck PASS.

- [ ] **Step 5: Commit**

```text
git add packages/shared/src/contracts apps/api/src/repositories apps/api/src/services scripts/build-serving-match-store.ts scripts/build-serving-match-store.test.ts scripts/providers/shared
git commit -m "refactor: generalize factual match data boundary"
```

---

### Task 3: Detach AI API And Web Runtime

**Files:**
- Modify: `apps/api/src/index.ts`
- Delete: `apps/api/src/routes/predictions.mock.ts`
- Delete: `apps/api/src/routes/explanations.mock.ts`
- Delete: `apps/api/src/routes/mock-prediction.ts`
- Delete: `apps/api/src/routes/mock-explanation.ts`
- Modify: `apps/web/src/config/navigation-tabs.ts`
- Modify: `apps/web/src/components/app-shell.ts`
- Modify: `apps/web/src/services/i18n-service.ts`
- Modify: `apps/web/src/production-shell.test.ts`
- Delete: `apps/web/src/mock-client.ts`
- Delete: `apps/web/src/mock-client.test.ts`
- Delete directory: `apps/web/src/views/`
- Modify: `packages/shared/src/index.ts`
- Delete: `packages/shared/src/mock-contracts.ts`
- Delete: `packages/shared/src/mock-contracts.test.ts`
- Modify: `packages/shared/src/contracts/betting-domain-contracts.ts`
- Modify: `packages/shared/src/contracts/betting-domain-contracts.typecheck.ts`
- Modify: `packages/shared/src/contracts/cloud-persistence-contracts.test.ts`
- Modify: `scripts/check-files.ts`
- Modify: `scripts/test-endpoints.ts`
- Modify: `scripts/phase2-verify.ts`
- Modify: `scripts/phase9-cloud-persistence-verify.ts`

**Interfaces:**
- Produces exactly four `ProductionNavigationTabId` values.
- Removes four API routes and all compatibility fallbacks.
- Preserves retained API endpoints and manual bet/bankroll contracts.

- [ ] **Step 1: Update tests first**

Change navigation expectations to:

```ts
expect(PRODUCTION_NAVIGATION_TAB_IDS).toEqual([
  'today', 'matches', 'bets', 'bankroll'
]);
expect(renderAppShell()).not.toContain('data-shell-tab-panel="miraichi"');
```

Change the source boundary assertion to:

```ts
type _SourceBoundary = Assert<Extends<BetRecordSource, 'manual'>>;
```

Change endpoint integration so the four removed routes expect `404` and remove all local-AI process startup and health checks.

- [ ] **Step 2: Run focused tests and observe failure**

Run:

```text
pnpm exec vitest run apps/web/src/production-shell.test.ts packages/shared/src/contracts/cloud-persistence-contracts.test.ts
```

Expected: FAIL because the fifth tab and assistant panel still render.

- [ ] **Step 3: Remove runtime surfaces**

Set the navigation IDs to:

```ts
export const PRODUCTION_NAVIGATION_TAB_IDS = Object.freeze([
  'today', 'matches', 'bets', 'bankroll'
] as const);
```

Delete `renderMiraichiPanel`, `renderAssistantRow`, its renderer-map entry, translations, and AI-only web files. Remove AI route imports/branches from `apps/api/src/index.ts` and delete the route files. Remove prediction/recommendation types and optional fields from `BetRecordEnvelope`; set `BetRecordSource = 'manual'`. Remove the mock-contract export and files. Replace visible text `No odds or prediction loaded.` with `No odds loaded.`

Update `scripts/test-endpoints.ts` to spawn only the API, use `manual-snapshot`, use scope `configured-competitions`, and assert the removed route status codes are `404`.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```text
pnpm exec vitest run apps/web/src/production-shell.test.ts packages/shared/src/contracts/cloud-persistence-contracts.test.ts
pnpm run check
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add apps/api/src apps/web/src packages/shared/src scripts/check-files.ts scripts/test-endpoints.ts scripts/phase2-verify.ts scripts/phase9-cloud-persistence-verify.ts
git commit -m "refactor: remove AI runtime surfaces"
```

---

### Task 4: Remove Sportmonks Code, Configuration, And Data

**Files:**
- Delete directory: `scripts/providers/sportmonks/`
- Delete: `scripts/capture-sportmonks-expected-data.ts`
- Delete: `scripts/capture-sportmonks-expected-data.test.ts`
- Delete: `scripts/capture-sportmonks-league-data.ts`
- Delete: `scripts/capture-sportmonks-league-data.test.ts`
- Delete: `scripts/capture-sportmonks-season-scoped-data.ts`
- Delete: `scripts/capture-sportmonks-season-scoped-data.test.ts`
- Delete: `scripts/capture-sportmonks-trial-data.ts`
- Delete: `scripts/enrich-sportmonks-fixtures.ts`
- Delete: `scripts/probe-sportmonks-fixture-enrichment.ts`
- Delete directory: `apps/api/data/providers/sportmonks/`
- Purge files: `apps/api/data/warehouse/*.jsonl` when any record has `provider: "sportmonks"`
- Purge directory: `apps/api/data/serving/versions/` and generated `apps/api/data/serving/manifest.json` when their sources contain Sportmonks
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.gitignore`
- Modify: `apps/api/data/serving/README.md`

**Interfaces:**
- Preserves `scripts/providers/shared/*` and generic data-build commands.
- Removes every Sportmonks command and environment variable.

- [ ] **Step 1: Confirm generic tests no longer use Sportmonks**

Run:

```text
rg -n -i "sportmonks" scripts/providers/shared packages/shared/src/contracts apps/api/src scripts/build-serving-match-store.test.ts
```

Expected before implementation: matches remain only where Task 2 did not fully remove them; replace those fixtures with `manual-snapshot` before deletion.

- [ ] **Step 2: Remove code and package/environment wiring**

Delete the listed TypeScript files/directories. Remove all root package script keys containing `sportmonks`. Remove `SPORTMONKS_*` entries from `.env.example`. Remove provider-specific generated-data scaffolding and rewrite the serving README command examples to the generic commands:

```text
pnpm run data:build:serving:matches
pnpm run data:validate:serving:matches
```

- [ ] **Step 3: Delete raw and derived data safely**

Resolve and verify each absolute target is inside `C:\CODE\miraichi\apps\api\data` before recursive deletion. Delete untracked `raw`, `manifests`, and `reports`. Delete generated warehouse/serving artifacts carrying Sportmonks provenance; retain `.gitkeep` and the generic README only.

- [ ] **Step 4: Run focused verification**

Run:

```text
pnpm exec vitest run scripts/providers/shared packages/shared/src/contracts/provider-ingestion-contracts.test.ts scripts/build-serving-match-store.test.ts
pnpm run typecheck
rg -n -i "sportmonks" package.json .env.example apps/api/src apps/web/src packages/shared/src scripts -g '!product-boundary-verify*'
```

Expected: tests/typecheck PASS; final `rg` has no result.

- [ ] **Step 5: Commit**

```text
git add -A scripts apps/api/data package.json .env.example .gitignore packages/shared/src
git commit -m "refactor: remove Sportmonks integration and data"
```

---

### Task 5: Remove Local AI Application And Phase Verification

**Files:**
- Delete directory: `apps/local-ai/`
- Delete: `scripts/phase4-verify.ts`
- Delete: `scripts/phase4-integration-verify.ts`
- Delete all tracked: `scripts/phase8-*.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `scripts/audit-rules.ts`
- Modify: `scripts/verify-lifecycle.ts`
- Modify: `scripts/verify-lifecycle.test.ts`
- Modify: `docs/README.md`

**Interfaces:**
- Produces root script `verify:product-boundary`.
- Changes `test:integration` to `pnpm run phase3:verify && pnpm run test:e2e && pnpm run pwa:verify`.
- Changes `verify:local` to include `pnpm run verify:product-boundary`.

- [ ] **Step 1: Update lifecycle tests first**

Remove `apps/local-ai/docs/ai-architecture.md` from `REQUIRED_DOC_INDEX_REFERENCES` expectations. Add a root-script expectation for `verify:product-boundary`.

- [ ] **Step 2: Run lifecycle tests and observe failure**

Run:

```text
pnpm exec vitest run scripts/verify-lifecycle.test.ts
```

Expected: FAIL because package scripts and lifecycle requirements still describe local AI.

- [ ] **Step 3: Delete local AI and update automation**

Delete `apps/local-ai/`, including its untracked `.venv`, caches, raw/processed data, and reports. Delete Phase 4/8 scripts. Remove `dev:local-ai`, `phase4:*`, and `phase8:*` package commands. Add:

```json
"verify:product-boundary": "tsx scripts/product-boundary-verify.ts"
```

Wire it into `verify:local`. Remove local-AI integration from `test:integration`. Remove local-AI allowlists from `scripts/audit-rules.ts`. Update `scripts/verify-lifecycle.ts` and docs index requirements. Run `pnpm install --lockfile-only` to remove the `apps/local-ai` importer.

- [ ] **Step 4: Run focused verification**

Run:

```text
pnpm exec vitest run scripts/verify-lifecycle.test.ts scripts/audit-rules.test.ts scripts/product-boundary-verify.test.ts
pnpm run verify:product-boundary
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```text
git add -A apps/local-ai scripts package.json pnpm-lock.yaml docs/README.md
git commit -m "refactor: remove local AI application and phase gates"
```

---

### Task 6: Active Documentation And Guardrail Reset

**Files:**
- Create: `docs/decisions/ADR-0044-ai-sportmonks-removal-product-reset.md`
- Rewrite: `PROJECT_PLAN.md`
- Rewrite: `README.md`
- Rewrite: `ARCHITECTURE.md`
- Rewrite: `ROADMAP.md`
- Rewrite: `WORKFLOW.md`
- Rewrite: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `docs/decisions/README.md`
- Modify: `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`
- Modify: `.agent/skills/miraichi-project-guardrails/SKILL.md`
- Modify: `.agent/skills/miraichi-competition-agnostic-review/SKILL.md`
- Delete directory: `docs/local-ai/`
- Delete directory: `docs/llm/`
- Delete: `docs/agents/ai-data-agent.md`
- Delete: `docs/architecture/llm-local-ai-boundary.md`
- Delete: `docs/betting/ai-betting-recommendation-boundary.md`
- Delete: `docs/data/ingestion-to-local-ai-handoff-contract.md`
- Delete AI-only ADRs: `ADR-0006`, `ADR-0007`, `ADR-0017` through `ADR-0021`, `ADR-0037`, `ADR-0038`, `ADR-0040`, `ADR-0041`
- Delete Phase 7/8 AI-only files under `docs/data/`
- Delete Phase 8 specs/plans listed in the approved design inventory under `docs/superpowers/`

**Interfaces:**
- Produces one accepted current decision: ADR-0044.
- Produces current phase source of truth: Product Reset completed, Website Source Selection next.
- Removes active AI agent ownership and national-team-first rules.

- [ ] **Step 1: Write ADR-0044 and root source-of-truth documents**

ADR-0044 must contain:

```text
Status: Accepted
Decision: Miraichi is an owner-only factual match, manual bet/odds, and bankroll web application. Local AI and Sportmonks are removed. Git history is retained.
Consequences: four primary tabs; no prediction/chat/model runtime; future website crawler requires a new source ADR.
```

`PROJECT_PLAN.md` must have no Phase 10. Its next unchecked item is `phase:plan Website Source Selection And Crawler Boundary`.

- [ ] **Step 2: Rewrite lifecycle skills and agent catalog**

Remove local-AI integration commands/examples, model-training rules, World-Cup-first rules, national-team-first rules, and the AI/Data agent. Retain competition-agnostic design, TypeScript-first implementation, TDD, verification, staging, owner approval, and no betting-formula guardrails.

- [ ] **Step 3: Delete AI-only documentation**

Delete the exact directories and files above. Historical content remains recoverable from Git history. Update `docs/README.md` and `docs/decisions/README.md` so no deleted path is indexed.

- [ ] **Step 4: Run documentation and lifecycle checks**

Run:

```text
pnpm run verify:lifecycle
rg -n -i "apps/local-ai|Miraichi AI|Phase 10|national-team-first|sportmonks" PROJECT_PLAN.md README.md ARCHITECTURE.md ROADMAP.md WORKFLOW.md AGENTS.md .agent/skills docs/README.md docs/decisions/README.md
git diff --check
```

Expected: lifecycle PASS; `rg` matches only the accepted removal design/ADR when those files are included separately, not active source-of-truth files.

- [ ] **Step 5: Commit**

```text
git add -A PROJECT_PLAN.md README.md ARCHITECTURE.md ROADMAP.md WORKFLOW.md CHANGELOG.md AGENTS.md .agent docs
git commit -m "docs: reset Miraichi as a non-ai product"
```

---

### Task 7: Full Boundary Verification And Closeout

**Files:**
- Modify only if verification exposes a concrete missed reference or stale test.
- Update checklist state in this implementation plan after each task completes.

**Interfaces:**
- Consumes all prior tasks.
- Produces local and integration evidence for the completed large feature boundary.

- [ ] **Step 1: Run repository scans**

Run:

```text
pnpm run verify:product-boundary
rg -n -i "sportmonks|apps/local-ai|/api/v1/predictions|/api/v1/chat|/api/v1/mock/predict|/api/v1/mock/explain" apps packages scripts package.json .env.example -g '!product-boundary-verify*'
```

Expected: boundary PASS and no forbidden runtime result.

- [ ] **Step 2: Run local verification**

Run:

```text
pnpm run verify:local
```

Expected: lifecycle, unit tests, syntax lint, typecheck, guardrail audit, type-safety audit, and product-boundary audit all PASS.

- [ ] **Step 3: Run integration verification**

Run:

```text
pnpm run test:integration
```

Expected: ingestion, retained API endpoint boundary, owner persistence, and PWA verification PASS without spawning local AI.

- [ ] **Step 4: Run final Git checks**

Run:

```text
git diff --check
git status --short
git log -8 --oneline
```

Expected: no whitespace errors; only intentional plan-checklist/closeout edits remain before the final commit.

- [ ] **Step 5: Commit closeout adjustments**

```text
git add -A
git commit -m "chore: close non-ai product reset"
```

## Execution Choice

Owner instruction selects **Inline Execution**. Use `superpowers:executing-plans` with TDD checkpoints. Do not dispatch subagents and do not pause for another approval unless a verification failure creates a genuine blocker.
