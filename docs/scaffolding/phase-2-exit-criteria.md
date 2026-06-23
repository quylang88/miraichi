# Phase 2 Exit Criteria

This document defines the conditions that must be satisfied to mark Phase 2 (App Skeleton and Scaffold Planning) as Completed.

---

## 1. Monorepo Structural Integrity

- [ ] **Dependency Linking**: Packages (`shared`, `config`, `ui`, `agent-protocol`) can be compiled and linked successfully without errors.
- [ ] **Cross-Import Verification**: `apps/web`, `apps/api`, `apps/local-ai`, and `apps/worker` successfully import components and definitions from their respective `packages/` dependencies using relative imports or monorepo workspace resolution.
- [ ] **Unified Dev Entry**: A single script (e.g. `npm run dev` or a package-manager workspace equivalent run script) launches all apps concurrently in development mode.

---

## 2. API & Connectivity Sanity

- [ ] **Mediation Gateway Connectivity**: `apps/api` starts up, logs connections, and proxies `/api/v1/chat` and `/api/v1/predictions` to `apps/local-ai` successfully.
- [ ] **Local AI Stub Validation**: `apps/local-ai` boots and successfully responds to `/ai/v1/predict` with valid mock confidence schemas and traceable output contracts.
- [ ] **Worker Stub Execution**: `apps/worker` starts up and logs periodic schedule executions (e.g., ticking every minute, polling a mock fixture JSON file).

---

## 3. UI rendering & Layout

- [ ] **Client Routing**: `apps/web` launches a dev server and loads in a browser.
- [ ] **Page Views**: Users can navigate between:
  - Match dashboard (rendering upcoming matches list).
  - Chat module (rendering bot input and log).
  - Bet history panel (rendering mock historical bet data list in read-only mode).
- [ ] **Presentational Components**: Components use custom HSL variables and style sheets from `packages/ui` using Vanilla CSS.

---

## 4. Test Verification Suite

- [ ] **Mock Test Suite**: A unified command (e.g. `npm run test` or `npm test`) runs simple test stubs for each app and package.
- [ ] **Scope Enforcement tests**: Tests exist to confirm:
  - API chatbot stubs refuse non-sports queries (ADR-0007 verification).
  - Config loader rejects payloads containing hardcoded "World Cup" strings or invalid config keys.
- [ ] **100% Green Run**: All skeleton tests execute and pass without warnings or errors.
