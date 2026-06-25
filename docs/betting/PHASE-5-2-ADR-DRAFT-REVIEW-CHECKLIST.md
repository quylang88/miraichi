# Phase 5.2 ADR Draft Review Checklist

This checklist defines the validation criteria applied to every ADR draft created in Wave A and any explicitly approved technical adjunct ADR.

## 1. Document Structure Verification
Each drafted ADR must contain the following sections:
* [ ] **Status**: Must be explicitly set to `Draft`.
* [ ] **Date**: Set to `2026-06-24`.
* [ ] **Owner Approval Required**: Set to `Yes`.
* [ ] **Implementation Status**: Set to `Not started`.
* [ ] **Context**: Background and problem definition.
* [ ] **Owner-Approved Business Decisions or Technical Direction**: Clear statements of owner requirements for business ADRs, or owner-approved technical direction for technical ADRs.
* [ ] **AI Technical Recommendations**: Architecture best practices recommended by the agent.
* [ ] **Deferred Business Decisions**: List of pending decisions requiring separate ADRs.
* [ ] **Future Extension Points**: Roadmapped additions.
* [ ] **Explicit Implementation Exclusions**: Hard limits on scope.

## 2. Technical Exclusions Audit
Ensure that:
* [ ] **No code block** in any ADR contains actual logic (no calculation equations, database operations, or API route scripts).
* [ ] **No database tables or configuration files** are declared for creation.
* [ ] **Agnostic compliance**: No references to specific leagues, tournaments, or World Cup teams are hardcoded.
* [ ] **No TypeScript implementation**: Technical ADRs may recommend TypeScript direction only; they must not install dependencies, add `tsconfig` files, rename JS files, or wire build/typecheck commands.
* [ ] **No framework selection by TypeScript ADR**: TypeScript adoption must not decide React, Next.js, Vue, Svelte, Vite, Express, Fastify, Hono, NestJS, or any equivalent framework.

## 3. Separation of Responsibilities
* [ ] **Owner vs AI**: The document must explicitly separate what is decided by the owner from what is proposed/recommended as technical guidelines by the agent.
* [ ] **Decisions vs Backlog**: Any out-of-scope calculation or formula must be categorized as "Deferred" or "Exclusion" and not silently resolved.
* [ ] **Technical vs Business Scope**: Technical architecture recommendations must not approve betting, bankroll, risk, settlement, prediction, recommendation, storage, or provider business decisions.
