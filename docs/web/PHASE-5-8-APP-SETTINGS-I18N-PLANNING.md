# Phase 5.8 App Settings & Language/i18n Planning

This document outlines the planning for future application settings and internationalization (i18n) support for the Miraichi mobile-first PWA. No code or settings features are implemented in this phase.

---

## 1. App Settings Categories

To ensure extensibility and a clean user experience, future settings are categorized below.

### 1.1 Settings Categories & Scope

| Settings Category | Description / Scope | Priority |
| :--- | :--- | :--- |
| **Language & Locale** | Language override (English/Vietnamese) and locale detection preferences. | High |
| **Theme & Appearance** | Theme toggle (Dark default, optional system theme sync, future Light mode). | Medium |
| **Odds Display Preferences** | Formatting of odds display (Decimal, Fractional, American, or Indo/Malay if relevant). | High |
| **Notification Preferences** | Opt-in preferences for daily reminders, match triggers, and assistant notes (local-only push). | Low |
| **Privacy, Export & Backup** | Local data export (JSON/CSV), manual clear history, database reset, and cloud-sync settings. | Medium |
| **Responsible-Use & Risk Warnings** | Threshold limits for daily logs, display toggles for caution banners, and activity cooling periods. | High |
| **App Display Density** | UI scale options: Standard (ideal for small touch screens) vs. Compact (ledger view density). | Low |
| **Accessibility Options** | Large font size support, color-blind mode (high contrast for status badges), and reduced animation. | Low |

---

## 2. Separate Owner Decisions vs. AI Technical Recommendations

To respect owner sovereignty, product decisions must be separated from technical architecture.

### AI Recommendations (Technical)
* **Local-First Configuration**: Store all application state preferences locally in a lightweight, schema-versioned settings store (e.g., using a dedicated namespace in `localStorage` or `IndexedDB`).
* **Settings Schema Versioning**: Define settings schema using TypeScript types. Include a schema version field (`schemaVersion: 1`) to allow safe migrations when new settings fields are introduced.
* **Componentized View**: Render settings from a declarative config object. This keeps UI views separate from the settings state schema.

### Owner Decision Space (Product)
* The default language selection for Vietnamese vs. English.
* The presence of a theme switch (e.g., whether to allow light mode at all or force pure black always).
* The entry point and placement of the settings panel (e.g., whether settings should reside on its own tab, a sub-screen, or inside the profile/auth dropdown).

---

## 3. Language & i18n Strategy

Miraichi will support English and Vietnamese from the ground up, utilizing best practices in internationalization.

### 3.1 Language Detection and Overrides
1. **Detection Pipeline**:
   * The app will check the browser's current settings via `navigator.language` or `navigator.languages`.
   * If the detected locale matches `vi` or starts with `vi-`, default to Vietnamese. Otherwise, default to English.
2. **Persistence Override**:
   * Once the user manually selects a language in Settings, save this preference in the local settings store.
   * On subsequent loads, the stored preference overrides browser detection.
3. **Dynamic Locale Initialization Flow**:
   ```mermaid
   graph TD
     Start[App Bootstraps] --> LoadPref{Load stored language preference}
     LoadPref -- Found --> ApplyPref[Apply preference: English/Vietnamese]
     LoadPref -- Not Found --> DetectLang{Check navigator.language}
     DetectLang -- Starts with 'vi' --> SetVI[Set language: Vietnamese]
     DetectLang -- Other --> SetEN[Set language: English]
     SetVI --> SaveTemp[Cache runtime language context]
     SetEN --> SaveTemp
     ApplyPref --> SaveTemp
   ```

### 3.2 Translation Scoping & Text Key Strategy
To avoid nested file management overhead, translations will be structured flatly within language JSON dictionaries.

* **Namespace Scoping**: Keys must be prefixed by their UI context to avoid naming collisions.
  * Prefix: `nav.`, `today.`, `matches.`, `bets.`, `bankroll.`, `miraichi.`, `settings.`, `common.`
* **Structured ICU Placeholder Format**: Avoid string concatenation to ensure flexibility in word order differences between English and Vietnamese.
  * English: `"Review match: {teamA} vs {teamB}"`
  * Vietnamese: `"Xem xét trận đấu: {teamA} vs {teamB}"`

Example translation schema (future):
```json
{
  "nav.today": "Today",
  "nav.matches": "Matches",
  "nav.settings": "Settings",
  "today.points_snapshot": "Points Snapshot",
  "bets.add_bet": "Add Bet",
  "errors.invalid_stake": "Please enter a valid stake amount of at least {minStake} points."
}
```

### 3.3 Localization: Date, Time & Numbers
English and Vietnamese formats differ substantially. The application must leverage locale-aware native standard APIs rather than custom string parsing.

* **Dates**:
  * English (US): `MM/DD/YYYY` or `Month DD, YYYY`
  * Vietnamese: `DD/MM/YYYY` or `Ngày DD tháng MM, YYYY`
  * Solution: Use `Intl.DateTimeFormat(locale, options).format(date)`
* **Currencies & Points**:
  * English (US): `1,234.56` (using comma for thousands, period for decimals)
  * Vietnamese: `1.234,56` (using period for thousands, comma for decimals)
  * Solution: Use `Intl.NumberFormat(locale, options).format(number)`

No implementation of this logic or runtime files is authorized or performed during Phase 5.8.
