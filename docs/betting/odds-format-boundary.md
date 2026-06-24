# Odds Format Boundary Specification

This document outlines the owner-applied candidate strategy for handling odds format boundaries in the betting journal.

## 1. V1 Visible Odds Format

The owner approved HK odds as the default and only visible odds format for the first implementation.

Store:

* `oddsFormat`
* Raw odds as `rawOddsValue` / `oddsValue`
* Optional `normalizedOddsValue`, which may remain null until conversion formulas are owner-approved.

Deferred display/conversion formats:

* Decimal
* Malay
* Indonesian
* American

---

## 2. OddsFormatAdapter Boundary

To avoid polluting UI rendering or future calculations with conversion logic:
1. HK raw odds are stored directly in v1 planning.
2. `normalizedOddsValue` is an optional target/internal field only.
3. Conversions between formats require explicit owner-approved formulas before coding begins.

### OddsFormatAdapter Boundary (Deferred)

`OddsFormatAdapter` remains a documentation-level boundary for future conversion behavior. It must not contain conversion formulas until a later owner-approved ADR explicitly approves them.

> [!IMPORTANT]
> **No conversion formulas are implemented or approved in this phase**. Under `docs/governance/OWNER-DECISION-GATES.md`, all math formulas must be proposed in candidate ADRs and approved by the owner before any code execution files are written.
