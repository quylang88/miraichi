# Odds Format Boundary Specification

This document outlines the strategy for handling multiple odds format types in the betting journal.

## 1. Supported Odds Formats

The application defaults to Hong Kong (HK) odds in v1, with provisions for future formats:

* **Hong Kong Odds (HK)**: Represents net profit relative to stake (e.g. `0.85`). A stake of 10 points yields 8.5 points profit if won. Always positive.
* **Decimal Odds (EU)**: Represents total return relative to stake (e.g. `1.85`). Total return = stake * decimal value.
* **Malay Odds (MY)**: Can be positive or negative. Positive values (e.g. `0.85`) represent profit. Negative values (e.g. `-0.50`) represent the fraction of the unit stake required to win 1 unit profit.
* **Indonesian Odds (ID)**: Similar to US odds but divided by 100. Positive values represent profit on 1 unit stake. Negative values represent stake needed to win 1 unit profit.
* **American Odds (US)**: Positive values represent profit from 100 units stake. Negative values represent stake needed to win 100 units profit.

---

## 2. OddsFormatAdapter Boundary

To avoid polluting UI rendering or database calculations with format conversion logic:
1. All calculations must use a normalized internal decimal multiplier value (`decimalOdds`).
2. Input conversion is isolated inside the `OddsFormatAdapter` boundary.
3. Conversions between formats require explicit owner-approved formulas before coding begins.

### IOddsFormatAdapter Interface Contract (Draft)
```typescript
interface IOddsFormatAdapter {
  /**
   * Translates the raw format string value to a normalized European Decimal multiplier.
   * e.g., HK odds "0.85" -> Decimal multiplier 1.85
   */
  toDecimalMultiplier(rawValue: number): number;

  /**
   * Translates a normalized European Decimal multiplier back to the target format.
   * e.g., Decimal multiplier 1.85 -> HK odds "0.85"
   */
  fromDecimalMultiplier(decimalMultiplier: number): number;
}
```

> [!IMPORTANT]
> **No conversion formulas are implemented in this phase**. Under `docs/governance/OWNER-DECISION-GATES.md`, all math formulas must be proposed in candidate ADRs and approved by the owner before any code execution files are written.
