# Phase 6 CI/CD and Staging Smoke Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a no-secret CI check workflow and repeatable staging smoke-check script without enabling automatic Cloudflare deployment.

**Architecture:** Keep deployment manual in Phase 6.2 and harden verification first. Add one root Node smoke-check script with Vitest coverage, then add one GitHub Actions workflow that runs existing local checks but deliberately contains no Wrangler deploy, Cloudflare token usage, provider secrets, production deploy, database provisioning, auth, or cloud sync.

**Tech Stack:** Node.js 18+ global `fetch`, Vitest, pnpm, GitHub Actions, PowerShell-compatible commands.

---

## 1. Source Decisions

This implementation plan is based on:

* `ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md`
* `ops/deploy/staging-plan.md`
* `ops/ci/github-actions-plan.md`
* `ops/deploy/deployment-targets.md`
* `docs/betting/PHASE-5-CLOSEOUT-REVIEW.md`
* `docs/web/PHASE-5-12-OWNER-REQUESTED-SHELL-QUALITY-UP-REVIEW.md`
* `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`
* `.agent/skills/miraichi-project-guardrails/SKILL.md`

Owner-approved boundary from the `phase:implementation-plan Phase 6 CI/CD and Staging Smoke Automation` command:

* Implementation planning may start.
* CI deployment automation is not approved.
* Staging smoke-check automation may be planned for a later code slice.
* Cloudflare credentials must remain outside git.
* Production promotion remains blocked.

This plan does not authorize real provider selection, production infrastructure, auth, cloud sync, production databases, betting formulas, prediction algorithms, recommendation ranking, or paid monitoring.

## 1.1 JavaScript To TypeScript Migration Boundary

This implementation plan does not include a JavaScript-to-TypeScript migration slice.

Reason: root verification scripts are currently JavaScript, and Phase 6.2 approved CI/smoke hardening only. Miraichi rules require JS-to-TS migration to be its own approved slice with exact files, behavior-preservation tests, and verification commands. Do not convert root scripts opportunistically inside the smoke-check or CI workflow slices.

## 2. File Structure

Create:

* `scripts/staging-smoke-check.js` - Node CLI and testable helpers for staging smoke checks.
* `scripts/staging-smoke-check.test.js` - Vitest unit tests for URL normalization, smoke check success, marker failures, manifest JSON failures, and CLI script wiring.
* `.github/workflows/ci.yml` - GitHub Actions workflow for install, lifecycle, unit, syntax, typecheck, and audit checks only.
* `scripts/github-actions-ci-workflow.test.js` - Vitest unit tests that enforce CI workflow checks and block deploy/secrets usage.

Modify:

* `package.json` - Add `smoke:staging` script.
* `ops/ci/github-actions-plan.md` - Record CI check-only workflow boundary after implementation.
* `ops/deploy/staging-plan.md` - Record smoke-check command after implementation.
* `ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md` - Mark implementation planning as created.
* `PROJECT_PLAN.md` - Mark Phase 6 implementation plan creation and gate code slices behind owner review.
* `ROADMAP.md` - Mirror Phase 6 implementation plan status.
* `CHANGELOG.md` - Record the implementation plan.
* `docs/README.md` - Link this implementation plan.

Do not create:

* `.github/workflows/deploy.yml`
* Dockerfiles
* production config
* database schema files
* provider config
* auth or cloud sync code
* secret values

## 3. Task 1: Staging Smoke-Check Script

**Files:**

* Create: `scripts/staging-smoke-check.js`
* Create: `scripts/staging-smoke-check.test.js`
* Modify: `package.json`

- [x] **Step 1: Write the failing test**

Create `scripts/staging-smoke-check.test.js`:

```js
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_PHASE_5_12_CACHE_MARKER,
  buildStagingSmokeChecks,
  normalizeBaseUrl,
  runStagingSmokeCheck
} from './staging-smoke-check.js';

function createResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}

function createFetchStub(responsesByUrl) {
  const calls = [];

  async function fetchStub(url) {
    calls.push(url);
    const response = responsesByUrl[url];

    if (!response) {
      return createResponse('not found', 404);
    }

    return response;
  }

  fetchStub.calls = calls;
  return fetchStub;
}

describe('staging smoke check helpers', () => {
  it('normalizes base URLs and rejects empty URLs', () => {
    expect(normalizeBaseUrl('https://example.pages.dev/')).toBe('https://example.pages.dev');
    expect(() => normalizeBaseUrl('   ')).toThrow('Staging URL is required');
  });

  it('builds Phase 5.12 smoke targets from a base URL', () => {
    expect(buildStagingSmokeChecks('https://example.pages.dev')).toEqual([
      {
        label: 'root shell',
        url: 'https://example.pages.dev/',
        markers: ['Miraichi', 'shell-entry', 'app-root']
      },
      {
        label: 'manifest',
        url: 'https://example.pages.dev/manifest.webmanifest',
        json: {
          name: 'Miraichi'
        }
      },
      {
        label: 'service worker',
        url: 'https://example.pages.dev/service-worker.js',
        markers: [DEFAULT_PHASE_5_12_CACHE_MARKER]
      },
      {
        label: 'shell entry',
        url: 'https://example.pages.dev/apps/web/src/shell-entry.js',
        markers: ['renderAppShell']
      },
      {
        label: 'ui css',
        url: 'https://example.pages.dev/packages/ui/src/index.css',
        markers: ['main-scroll']
      }
    ]);
  });

  it('passes when every staging endpoint returns expected markers', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }')
    });

    const result = await runStagingSmokeCheck({
      baseUrl,
      fetchImpl: fetchStub
    });

    expect(result.ok).toBe(true);
    expect(result.results.map((entry) => entry.ok)).toEqual([true, true, true, true, true]);
    expect(fetchStub.calls).toEqual(buildStagingSmokeChecks(baseUrl).map((check) => check.url));
  });

  it('reports missing markers without leaking response bodies', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse('old-cache-marker-secret-like-text'),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }')
    });

    const result = await runStagingSmokeCheck({
      baseUrl,
      fetchImpl: fetchStub
    });

    expect(result.ok).toBe(false);
    expect(result.results.find((entry) => entry.label === 'service worker')).toEqual({
      label: 'service worker',
      url: 'https://example.pages.dev/service-worker.js',
      ok: false,
      status: 200,
      message: `missing marker: ${DEFAULT_PHASE_5_12_CACHE_MARKER}`
    });
  });

  it('reports malformed manifest JSON', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse('{bad-json'),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }')
    });

    const result = await runStagingSmokeCheck({
      baseUrl,
      fetchImpl: fetchStub
    });

    expect(result.ok).toBe(false);
    expect(result.results.find((entry) => entry.label === 'manifest')?.message).toBe(
      'invalid JSON response'
    );
  });

  it('wires the root package smoke:staging script to the smoke checker', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

    expect(packageJson.scripts['smoke:staging']).toBe('node scripts/staging-smoke-check.js');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run scripts/staging-smoke-check.test.js
```

Expected: FAIL because `scripts/staging-smoke-check.js` does not exist and `package.json` has no `smoke:staging` script.

- [x] **Step 3: Write minimal implementation**

Create `scripts/staging-smoke-check.js`:

```js
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
  const baseUrl = process.argv[2] || process.env.STAGING_URL;
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
```

Modify `package.json` scripts:

```json
"smoke:staging": "node scripts/staging-smoke-check.js"
```

Keep the existing `deploy:staging:local` script unchanged.

- [x] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run scripts/staging-smoke-check.test.js
pnpm run typecheck
```

Expected: PASS. Typecheck exits with code 0.

- [x] **Step 5: Run the smoke script against the latest staging URL**

Run:

```powershell
pnpm run smoke:staging -- https://e9b19946.miraichi-staging.pages.dev
```

Expected:

```text
PASS root shell https://e9b19946.miraichi-staging.pages.dev/ ok
PASS manifest https://e9b19946.miraichi-staging.pages.dev/manifest.webmanifest ok
PASS service worker https://e9b19946.miraichi-staging.pages.dev/service-worker.js ok
PASS shell entry https://e9b19946.miraichi-staging.pages.dev/apps/web/src/shell-entry.js ok
PASS ui css https://e9b19946.miraichi-staging.pages.dev/packages/ui/src/index.css ok
```

- [ ] **Step 6: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add package.json scripts/staging-smoke-check.js scripts/staging-smoke-check.test.js
git commit -m "feat: add staging smoke check script"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

## 4. Task 2: CI Check-Only GitHub Actions Workflow

**Files:**

* Create: `.github/workflows/ci.yml`
* Create: `scripts/github-actions-ci-workflow.test.js`

- [ ] **Step 1: Write the failing test**

Create `scripts/github-actions-ci-workflow.test.js`:

```js
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const WORKFLOW_PATH = path.resolve('.github/workflows/ci.yml');

function readWorkflow() {
  return fs.readFileSync(WORKFLOW_PATH, 'utf8');
}

describe('GitHub Actions CI workflow', () => {
  it('exists and runs the required non-deploy verification commands', () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('name: CI');
    expect(workflow).toContain('pnpm/action-setup@v4');
    expect(workflow).toContain('actions/setup-node@v4');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm run verify:lifecycle');
    expect(workflow).toContain('pnpm run test:unit');
    expect(workflow).toContain('pnpm run lint');
    expect(workflow).toContain('pnpm run typecheck');
    expect(workflow).toContain('pnpm run audit');
  });

  it('does not deploy or reference Cloudflare secrets', () => {
    const workflow = readWorkflow();
    const forbiddenMarkers = [
      'wrangler',
      'pages deploy',
      'deploy:staging',
      'deploy:staging:local',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'secrets.',
      'production'
    ];

    for (const marker of forbiddenMarkers) {
      expect(workflow).not.toContain(marker);
    }
  });

  it('keeps integration and staging checks out of the default PR workflow', () => {
    const workflow = readWorkflow();

    expect(workflow).not.toContain('pnpm run test:integration');
    expect(workflow).not.toContain('pnpm run verify:staging');
    expect(workflow).not.toContain('pnpm run smoke:staging');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run scripts/github-actions-ci-workflow.test.js
```

Expected: FAIL because `.github/workflows/ci.yml` does not exist.

- [ ] **Step 3: Write minimal workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.25.0
          run_install: false

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lifecycle verification
        run: pnpm run verify:lifecycle

      - name: Unit tests
        run: pnpm run test:unit

      - name: JavaScript syntax check
        run: pnpm run lint

      - name: TypeScript typecheck
        run: pnpm run typecheck

      - name: Guardrail audit
        run: pnpm run audit
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run scripts/github-actions-ci-workflow.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add .github/workflows/ci.yml scripts/github-actions-ci-workflow.test.js
git commit -m "ci: add check-only github actions workflow"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

## 5. Task 3: Documentation And Phase Status Updates

**Files:**

* Modify: `ops/ci/github-actions-plan.md`
* Modify: `ops/deploy/staging-plan.md`
* Modify: `ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md`
* Modify: `PROJECT_PLAN.md`
* Modify: `ROADMAP.md`
* Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CI documentation**

Modify `ops/ci/github-actions-plan.md`:

```markdown
## Phase 6.2 Check-Only Workflow

The first CI workflow is check-only. It runs lifecycle verification, unit tests, syntax checks, typecheck, and guardrail audit.

It intentionally does not run Cloudflare deployment, does not reference Cloudflare secrets, and does not run production promotion.
```

- [ ] **Step 2: Update staging documentation**

Modify `ops/deploy/staging-plan.md`:

````markdown
## Phase 6.2 Smoke Command

After a staging deploy, run:

```powershell
pnpm run smoke:staging -- https://e9b19946.miraichi-staging.pages.dev
```

Replace the URL with the deployment URL returned by Cloudflare Pages for the current phase.
````

- [ ] **Step 3: Update root phase status docs**

Apply these exact status changes:

* In `PROJECT_PLAN.md`, keep Phase 6 status as `Active Planning`, mark implementation plan created, and add owner review before `phase:code-slice`.
* In `ROADMAP.md`, mirror the same Phase 6 implementation-plan status.
* In `CHANGELOG.md`, add that the Phase 6 CI/CD and staging smoke automation implementation plan was created.
* In `ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md`, record that implementation planning exists and code slices remain gated behind owner review.

- [ ] **Step 4: Run documentation consistency checks**

Run:

```powershell
rg -n "Phase 6|smoke:staging|github-actions-ci-workflow|phase:code-slice|owner review" PROJECT_PLAN.md ROADMAP.md CHANGELOG.md ops docs/README.md
```

Expected: Output shows Phase 6 implementation planning, smoke command references, and owner review/code-slice gate.

- [ ] **Step 5: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add ops/ci/github-actions-plan.md ops/deploy/staging-plan.md ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md PROJECT_PLAN.md ROADMAP.md CHANGELOG.md
git commit -m "docs: update phase 6 implementation plan status"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

## 6. Task 4: Full Verification Boundary

**Files:**

* No planned source file changes.

- [ ] **Step 1: Run focused Phase 6 tests**

Run:

```powershell
pnpm exec vitest run scripts/staging-smoke-check.test.js scripts/github-actions-ci-workflow.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full local verification**

Run:

```powershell
pnpm run verify:local
```

Expected: PASS for lifecycle verification, unit tests, JavaScript syntax, typecheck, and guardrail audit.

- [ ] **Step 3: Run integration only if this slice is treated as the large Phase 6 boundary**

Run only after Tasks 1 to 3 are complete and the owner wants to close Phase 6.2 as a boundary:

```powershell
pnpm run test:integration
```

Expected: PASS for Phase 3, Phase 4, endpoint, and PWA verification.

- [ ] **Step 4: Confirm no forbidden deployment or secret automation entered the repo**

Run:

```powershell
rg -n "wrangler|pages deploy|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|secrets\\.|production|CREATE TABLE|Prisma|localStorage.*bet|prediction algorithm|recommendation ranking|World Cup|FIFA" .github scripts apps packages ops
```

Expected: Hits are allowed only in documentation that explicitly blocks those actions or in existing local-only deploy scripts. There must be no Cloudflare token value, no new auto-deploy workflow, no production deploy, no database schema, no real provider hardcode, and no prediction or betting formula implementation.

- [ ] **Step 5: Record verification evidence if a review document is added**

If this code-slice adds a Phase 6 review document, place it under `ops/` and include:

* commands run
* pass/fail result
* staging URL if smoke-checking a public deployment
* known risks
* next lifecycle phase

## 7. Execution Gate

Phase 6 code execution may start only after owner review approves this implementation plan.

Approved execution must start with Task 1 and must keep TDD order:

1. Write the failing test.
2. Run the failing test and read the failure.
3. Write the minimal implementation.
4. Run focused passing tests.
5. Run relevant local verification.
6. Commit only if auto commit is enabled.

Do not start with `.github/workflows/ci.yml`. The workflow test must fail first.

Do not add Cloudflare deployment from CI in Phase 6.2. Any later CI deployment needs a separate owner-approved plan for secrets and branch protection.

## 8. Self-Review

Spec coverage:

* CI/CD check-only workflow: Task 2.
* Staging smoke automation: Task 1.
* Secret handling: Task 2 forbids workflow secrets and deploy commands; Task 4 checks forbidden markers.
* Staging hardening: Task 1 creates repeatable smoke checks and Task 3 documents the command.
* Production block: Task 2 forbids production markers and Task 4 scans for production/deploy misuse.
* No business logic, formulas, provider selection, auth, cloud sync, production schema, or AI recommendation logic: stated in source decisions and guarded by Task 4.

Placeholder scan:

* No unresolved placeholder markers are used.
* No task says to add unspecified validation.
* Every code-changing task has exact paths, failing test code, expected failure, implementation code, passing command, and commit instruction.

Type consistency:

* `runStagingSmokeCheck`, `buildStagingSmokeChecks`, and `normalizeBaseUrl` are defined in `scripts/staging-smoke-check.js` and imported from the same file by `scripts/staging-smoke-check.test.js`.
* The `smoke:staging` package script calls the same CLI file tested by Vitest.
* `.github/workflows/ci.yml` is verified by `scripts/github-actions-ci-workflow.test.js`.
