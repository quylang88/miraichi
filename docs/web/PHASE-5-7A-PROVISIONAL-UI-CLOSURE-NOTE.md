# Phase 5.7A Provisional UI Closure Note

* **Date**: 2026-06-26
* **Phase**: 5.7A
* **Status**: Closed - Provisional Preview Baseline

This note records the owner clarification that the current Phase 5.7A UI preview is acceptable only as a temporary visual baseline.

---

## 1. Current UI Preview Status

The current `/preview` surface uses the **Black Apple Ledger** direction as a provisional preview baseline.

It is acceptable for planning continuity, visual discussion, and local inspection. It is not the final production UI.

---

## 2. Why It Is Provisional

The preview exists so the project can continue to later phases without blocking on final product design.

This is a practical closure point, not final design approval. The UI can and likely will be revised later.

---

## 3. What It Does Not Decide

Phase 5.7A does not lock:

* Final colors.
* Final spacing.
* Final typography.
* Final navigation treatment.
* Final settings layout.
* Final language behavior.
* Final interaction details.
* Final production design system.

---

## 4. What Remains Deferred

The following remain deferred:

* Final production design polish.
* Final design system and UI polish.
* App settings UI.
* Language selector.
* i18n framework.
* Translation files.
* Settings persistence.
* Production betting workflows.
* Betting calculations, formulas, and settlement behavior.
* AI recommendation, prediction, confidence, ranking, or stake advice behavior.

---

## 5. App Settings and Language/i18n Future Planning

Future planning should cover app settings and language/i18n as a separate planning topic.

At minimum, later planning should address:

* English and Vietnamese support.
* Default language.
* Supported language list.
* Translation scope.
* Settings placement.
* Theme and display customization.
* Other owner-requested app settings.

These decisions should be collected in a later settings ADR or planning pack before implementation.

---

## 6. Continuing to Later Phases

Continuing to later phases is allowed.

The project should not wait for final UI design before proceeding with non-UI planning work, as long as later phases do not treat this preview as production UI approval.

---

## 7. Superseded Next Phase Note

The older recommendation to make Phase 5.8 a local-first persistence planning phase is superseded by `PROJECT_PLAN.md`.

The actual sequence is:

1. **Phase 5.8**: App Settings, Language/i18n, and UI Flexibility Planning.
2. **Phase 5.9**: Production PWA Shell Implementation.
3. **Phase 5.10**: Add Bet Draft/Form State + Persistence Planning.

Production storage, backup, sync, formulas, or real betting behavior still require separate owner-approved implementation plans.
