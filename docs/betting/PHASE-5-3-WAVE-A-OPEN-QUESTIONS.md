# Phase 5.3 Wave A Open Questions

These questions must be resolved or explicitly deferred before execution begins. They do not block Phase 5.3 planning.

---

## 1. TypeScript Tooling

1. Should TypeScript first apply only to `packages/shared`, or to all new packages?
   - **AI recommendation**: Start with `packages/shared`.
   - **Reason**: Shared contracts have the highest field-drift risk and the lowest runtime blast radius.

2. Should strict mode be mandatory from day one for domain contracts?
   - **AI recommendation**: Yes for new shared contracts after tooling approval.
   - **Reason**: Loose typing would undercut ADR-0034's purpose.

3. Should existing JavaScript apps remain JavaScript until after shared contracts are stable?
   - **AI recommendation**: Yes.
   - **Reason**: App migration before shared contracts would create churn without contract safety.

---

## 2. Typed Domain Contracts

1. Should `source` include `imported` in addition to `manual` and `ai_recommendation`?
   - **AI recommendation**: Defer to implementation planning for import/export behavior.
   - **Reason**: Import behavior touches backup semantics and should align with ADR-0033 execution.

2. Should `liveMinute` become required for live wagers?
   - **AI recommendation**: Keep optional for v1.
   - **Reason**: Fast manual entry is more important than strict live metadata completeness.

3. Should `profitLossPoints` be included as nullable contract shape before formulas are approved?
   - **AI recommendation**: Include only as nullable shape if owner approves typed contracts later.
   - **Reason**: Shape can exist without formulas; calculation remains blocked.

---

## 3. Market Catalog and Line Presets

1. Where should future market config live?
   - **AI recommendation**: Prefer a shared/config package boundary after tooling approval.
   - **Reason**: Market labels and presets may be used by web, API, and future validation layers.

2. Should non-0.25 warning metadata be stored in catalog config or UI copy?
   - **AI recommendation**: Store rule metadata separately from UI copy.
   - **Reason**: Keeps display text replaceable and warning behavior consistent.

3. Should `Custom Market` bypass all preset rules?
   - **AI recommendation**: Yes.
   - **Reason**: The custom market is the manual escape hatch.

---

## 4. PWA Navigation

1. Should route IDs exactly match lowercase tab labels?
   - **AI recommendation**: Yes: `today`, `matches`, `bets`, `bankroll`, `miraichi`.
   - **Reason**: Stable route IDs reduce future migration risk.

2. Should `Add Bet` be global or scoped to `Today` and `Bets`?
   - **AI recommendation**: Global primary action with strongest visibility in `Today` and `Bets`.
   - **Reason**: Manual entry speed is a v1 UX priority.

3. Should `Reports` appear as a primary tab?
   - **AI recommendation**: No.
   - **Reason**: ADR-0031 places reporting under `Bankroll`.

---

## 5. Local-First Persistence and Backup

1. Should the first persistence execution create an adapter interface before IndexedDB?
   - **AI recommendation**: Yes.
   - **Reason**: Adapter-first sequencing keeps IndexedDB replaceable.

2. Should export/import be implemented before real IndexedDB storage?
   - **AI recommendation**: No.
   - **Reason**: Backup behavior depends on the accepted storage envelope and versioning strategy.

3. Should `localStorage` ever store real betting history?
   - **AI recommendation**: No.
   - **Reason**: ADR-0033 explicitly forbids localStorage as real history persistence.

---

## 6. Verification and Audit

1. Should Phase 5.4 add verification scripts at the same time as TypeScript tooling?
   - **AI recommendation**: Only if explicitly approved in the Phase 5.4 plan.
   - **Reason**: Verification scripts are implementation artifacts.

2. Should guardrail checks fail on real competition names in docs or only code?
   - **AI recommendation**: Future implementation checks should focus on code and executable config first.
   - **Reason**: Historical docs may mention examples, but implementation must remain clean.

3. Should package manifests be protected by review checks?
   - **AI recommendation**: Yes.
   - **Reason**: Dependencies are the fastest way to accidentally start implementation.
