# ADR-0026: Odds Format Strategy Boundary

* **Status**: Draft
* **Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context
Sports betting uses diverse odds format systems globally. Scattering format conversion or math throughout UI components or reporting aggregates introduces severe rounding errors and complicates codebase maintenance. We need an isolated conversion boundary.

## 2. Owner-Approved Business Decisions
* **Hong Kong (HK) Odds Default**: Hong Kong odds is the default format for version 1 (v1).
* **HK Visible Launch**: In the first presentational release of the betting journal, only Hong Kong odds will be visible in the user interface.
* **Format Tracking**: The `oddsFormat` parameter must be stored within the `BetRecordEnvelope` to record the type.
* **Raw Odds Value Storage**: Store the exact raw, user-entered odds value as `oddsValue` in the record.
* **Deferred Normalization**: An internal field `normalizedOddsValue` (representing European decimal multiplier representation) may be declared in the schema, but it **must remain null** and unused until mathematical conversion equations are approved by the owner.
* **Format Deferrals**: Implementing, displaying, or converting to Decimal, Malay, Indonesian, or American formats is deferred to later phases.
* **No Unapproved Formulas**: Under no circumstances may any odds conversion math be written in code files without a later, separate owner-approved ADR.

## 3. AI Technical Recommendations
* **Adapter Boundary**: Isolate future odds translations inside a dedicated interface `OddsFormatAdapter`, preventing leakages into UI pages, reporting models, or database queries.
* **Single Value Reference**: Maintain one canonical value property name `oddsValue` for the user's raw input. Do not declare both `rawOddsValue` and `oddsValue` in the core record wrapper simultaneously to prevent redundancy.

## 4. Deferred Business Decisions
* The exact mathematical conversion equations for Malay, Indonesian, and American odds.
* The float rounding precision and tolerance boundaries for converted values.
* The layout designs for showing multi-format equivalents in the user dashboard.
* The specification of the internal canonical normalized value.

## 5. Future Extension Points
* Decimal, Malay, Indonesian, and American odds format adapters.
* A user-profile configuration setting to change the default visible odds format application-wide.

## 6. Explicit Implementation Exclusions
* No odds format translation, calculation, or conversion execution code.
* No rounding logic or decimal formatting utilities for wagers.
* No settlement calculations depending on format conversions.
* No executable code implementation.
