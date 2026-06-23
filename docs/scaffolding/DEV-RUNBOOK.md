# Developer Runbook: Phase 2 Monorepo Scaffold

This runbook helps developers configure and verify the local development environment for the Miraichi monorepo scaffold.

---

## 1. Local Environment Setup

### Prerequisites
* **Node.js**: Version 18.0.0 or higher.
* **pnpm**: Monorepo package management tool (v8+ recommended).

### Dependency Installation & Linking
From the workspace root directory, run:
```bash
pnpm install
```
This command automatically registers all 9 workspaces and links peer workspaces (such as `@miraichi/shared` and `@miraichi/ui`) using pnpm workspace linking.

---

## 2. Launching Services Concurrently

To boot up the entire application stack in development mode:
```bash
pnpm dev
```
This script launches all apps concurrently using pnpm's parallel runner:
* **Web Client (`apps/web`)**: Running at `http://localhost:3000`
* **API Mediation Gateway (`apps/api`)**: Running at `http://localhost:3001`
* **Local AI Statistics Processor (`apps/local-ai`)**: Running at `http://localhost:3002`
* **Periodic Ingestion Worker (`apps/worker`)**: Runs daemon intervals in background.

---

## 3. Verification & Guardrail Audits

The monorepo contains strict automated checks to enforce architectural boundaries and verify agnosticism.

### A. Run All Verification Diagnostics
This runs the file structure checklist, code safety audits, scope tests, and end-to-end integration tests:
```bash
pnpm run phase2:verify
```

### B. Individual Verification Steps

* **File Checklist Check**:
  ```bash
  pnpm run check
  ```
* **Guardrail AST Audit**: Check for database, secrets, payout math, or World Cup hardcoding:
  ```bash
  pnpm run audit
  ```
* **Automated Scope Checks**: Verify config key boundaries and chatbot sports refusal rules:
  ```bash
  pnpm run phase2:check-rules
  ```
* **E2E Endpoint Boundary Tests**: Starts background servers, executes fetch tests, and terminates:
  ```bash
  pnpm run test:e2e
  ```
* **Run Workspace Unit/Lint Stubs**:
  ```bash
  pnpm run test
  pnpm run lint
  ```
