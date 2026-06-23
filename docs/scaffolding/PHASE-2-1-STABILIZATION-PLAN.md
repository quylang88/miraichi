# Phase 2.1: Scaffold Stabilization and Boundary Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish workspace script consistency and deploy automated E2E endpoint boundary tests verifying that all monorepo components interact correctly under strict ADR guardrails.

**Architecture:** We will create automated scripts in `scripts/` to check package export resolutions, verify HTTP mock payloads match the contract spec, audit files for business logic leaks, and ensure all workspace package configs align.

**Tech Stack:** Node.js, `pnpm` workspaces, and native HTTP modules.

---

## Allowed Changes
- Standardizing scripts inside `package.json` configurations.
- Creating test suites in `scripts/` or `tests/` verifying mock boundary API calls.
- Fixing import paths or resolving module exports.
- Updating documentation logs or reports.

## Forbidden Changes
- Adding database libraries (Postgres, SQLite, MongoDB, Prisma, etc.).
- Writing production database schemas or SQL queries.
- Adding actual business calculation logic (implied probability, bankroll models, odds payout math).
- Hardcoding specific leagues, matches, or specific tournaments (e.g. World Cup) in code files.
- Adding secrets or API credentials.

---

### Task 1: standardizing Monorepo Workspace Scripts

**Files:**
- Modify: [package.json](file:///c:/CODE/miraichi/package.json)
- Modify: [apps/web/package.json](file:///c:/CODE/miraichi/apps/web/package.json)
- Modify: [apps/api/package.json](file:///c:/CODE/miraichi/apps/api/package.json)
- Modify: [apps/local-ai/package.json](file:///c:/CODE/miraichi/apps/local-ai/package.json)
- Modify: [apps/worker/package.json](file:///c:/CODE/miraichi/apps/worker/package.json)

- [ ] **Step 1: Align dev execution scripts**
  Ensure all apps and packages have a consistent `"dev"` script executing their main process, and update the root `package.json` scripts to run them cleanly.
  - Root `dev` script: `pnpm --filter "./apps/*" --parallel run dev`
  - App `dev` scripts: `node src/index.js`

- [ ] **Step 2: Add lint/test stub script targets**
  Add standard placeholder `"lint"` and `"test"` script targets to all `package.json` files so `pnpm -r run lint` and `pnpm -r run test` execute cleanly across all packages.
  - Add `"test": "node -e \"console.log('Test stub passed')\""` to packages' and apps' `package.json` files.
  - Add `"lint": "node -e \"console.log('Lint stub passed')\""` to packages' and apps' `package.json` files.

- [ ] **Step 3: Run verify command**
  Run: `pnpm -r run test`
  Expected: Success output for all 9 workspace projects.

- [ ] **Step 4: Commit changes**
  Check `auto_commit` in `.agent/config.yml`. If enabled, stage and commit package.json modifications.

---

### Task 2: Implement Automated Endpoint Verification Suite

**Files:**
- Create: `scripts/test-endpoints.js`
- Modify: [package.json](file:///c:/CODE/miraichi/package.json)

- [ ] **Step 1: Write boundary contract verification script**
  Create a script at `scripts/test-endpoints.js` that spins up the `apps/api` and `apps/local-ai` servers, sends fetch requests to the mock endpoints, and asserts that the returned payload structures match [mock-boundary-contracts.md](file:///c:/CODE/miraichi/docs/scaffolding/mock-boundary-contracts.md) exactly.
  - Endpoints to verify:
    - `GET http://localhost:3001/api/v1/health`
    - `GET http://localhost:3001/api/v1/matches`
    - `GET http://localhost:3001/api/v1/predictions?matchId=match_2026_001`
    - `POST http://localhost:3001/api/v1/chat` (verify both sports query reply and out-of-scope refusal payload)
    - `GET http://localhost:3001/api/v1/bets`
    - `POST http://localhost:3002/ai/v1/predict`
    - `POST http://localhost:3002/ai/v1/explain`

- [ ] **Step 2: Update root verify scripts**
  Add `"test:e2e": "node scripts/test-endpoints.js"` to the root `package.json` and configure it to run during `"phase2:verify"`.

- [ ] **Step 3: Run verify command**
  Run: `pnpm run phase2:verify`
  Expected: Successful exit 0, confirming all endpoint schemas align with mock boundary specifications.

- [ ] **Step 4: Commit changes**
  Check `auto_commit` in `.agent/config.yml`. If enabled, commit the new test script.

---

### Task 3: No-Business-Logic and Agnosticism Verification Audits

**Files:**
- Create: `scripts/audit-rules.js`
- Modify: [package.json](file:///c:/CODE/miraichi/package.json)

- [ ] **Step 5: Write automated AST/regex audit checks**
  Create `scripts/audit-rules.js` that scans all javascript files inside `apps/` and `packages/` checking for forbidden patterns:
  - Scans for ORM/DB dependencies or imports (e.g. `prisma`, `sequelize`, `mongoose`, `sqlite`).
  - Scans for hardcoded specific tournament keywords (e.g. case-insensitive matches for "World Cup" or "Premier League" inside `src/` files, allowing them only in comments or configs).
  - Scans for math operations or libraries relating to odds calculation (e.g. `impliedProbability`, Kelly allocation, odds payout math).

- [ ] **Step 6: Integrate audit into verification target**
  Add `"audit": "node scripts/audit-rules.js"` to root `package.json` and chain it inside `"phase2:verify"`.

- [ ] **Step 7: Run verification**
  Run: `pnpm run phase2:verify`
  Expected: PASS with 0 violations found.

- [ ] **Step 8: Commit changes**
  Check `auto_commit` in `.agent/config.yml`. If enabled, stage and commit the audit script.

---

## Exit Criteria for Phase 2.1

To complete Phase 2.1 and graduate to Phase 3, the following conditions must be satisfied:

1. **Workspace Command Consistency**: Running `pnpm -r run lint` and `pnpm -r run test` must execute and pass across all 9 packages with exit 0.
2. **E2E Contract Consistency**: Running `pnpm run test:e2e` successfully starts servers, executes HTTP validations against all endpoints, verifies schema shapes, and shuts down servers cleanly with exit 0.
3. **Automated Guardrail Audit**: Running `pnpm run audit` scans all code, verifying no database hookups, no odds math, and no tournament hardcoding exist, exiting with 0 violations.
4. **Documentation**: Plan execution logs are fully recorded in `docs/scaffolding/PHASE-2-1-STABILIZATION-REPORT.md`.
