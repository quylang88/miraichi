# Phase 8.6E API-Football Owner-Only App Live Data Design Spec

* **Status**: Historical/superseded on 2026-07-01 by [ADR-0042](file:///c:/CODE/miraichi/docs/decisions/ADR-0042-local-data-api-and-api-football-removal.md). Phase 9 must remove API-Football from the active app data path.
* **Date**: 2026-06-29
* **Phase**: 8.6E API-Football Owner-Only App Live Data
* **Audience**: Owner, Planner Agent, Architect Agent, Backend Agent, Frontend Agent, QA Agent

---

## 1. Ket Luan Thang

Miraichi should replace the visible hardcoded match feed in the app with an owner-only API-Football-backed feed, mediated by the local API gateway. The web client must never call API-Football directly and must never receive the provider key.

This phase is about **displaying real matchday data in the app**, not training, model selection, betting advice, or odds ingestion.

---

## 2. Context

The owner approved using:

* offline raw CSV/JSON snapshots for local training datasets;
* API-Football for app-visible live or matchday fixture data;
* The Odds API later, not in this first app data slice.

Current repo facts:

* `apps/api/src/index.ts` serves `/api/v1/matches` from `MOCK_MATCHES`.
* `apps/web/src/components/app-shell.ts` renders visible hardcoded match labels such as `Team Alpha vs Team Beta`.
* `apps/web/src/shell-entry.ts` renders the shell synchronously and does not fetch a real match feed.
* ADR-0035 accepts the hybrid provider strategy for owner-only free-tier development, but explicitly does not approve public traffic, paid providers, secrets in source, or production promotion.
* ADR-0039 requires parser-boundary validation and structured handling of invalid provider payloads.

Official provider references to verify again at implementation time:

* API-Football documentation v3: <https://www.api-football.com/documentation-v3>
* API-Football pricing/quotas: <https://www.api-football.com/pricing>

---

## 3. Goals

1. Add a backend-only API-Football client behind `/api/v1/matches`.
2. Keep the provider key in `API_FOOTBALL_KEY`, never in browser code.
3. Normalize API-Football fixtures into a Miraichi app match feed contract.
4. Add in-memory owner-only cache and daily quota guard so a single user does not burn the free tier by reloading the app.
5. Update the web shell to load and render real match feed data for Today and Matches.
6. Show honest unavailable/error states when the provider key is missing, quota is exhausted, or the provider returns invalid data.
7. Preserve app guardrails: no prediction output, no recommendation, no odds, no betting formula.

---

## 4. Non-Goals

* No The Odds API integration.
* No historical training dataset change.
* No raw CSV append-only merge in this phase. That must be a separate plan because it changes offline ingestion semantics.
* No lineups, injuries, events, or statistics endpoints in the first slice. These should be lazy-loaded from match detail in a later approved plan.
* No production database, ORM, migrations, or persistent cache.
* No public or multi-user traffic.
* No prediction algorithm, model runtime route, model artifact, stake advice, bankroll advice, ROI, CLV, Kelly, or bet recommendation.

---

## 5. Architecture

### 5.1 Backend Mediation

The web app calls:

```text
GET /api/v1/matches?date=YYYY-MM-DD
```

The API gateway calls API-Football only from the backend:

```text
GET https://v3.football.api-sports.io/fixtures?date=YYYY-MM-DD&timezone=UTC
Header: x-apisports-key: <API_FOOTBALL_KEY>
```

The backend returns a normalized feed:

```typescript
export type AppMatchFeedResponse = {
  sourceProviderId: 'api-football';
  mode: 'date';
  fetchedAt: string;
  cache: {
    status: 'hit' | 'miss' | 'disabled';
    ttlSeconds: number;
  };
  quota: {
    dailyLimit: number;
    consumedToday: number;
    remainingToday: number;
  };
  matches: AppMatch[];
  warnings: string[];
};
```

When the key is missing or quota is exhausted, the route must return a non-200 status with a clear error payload. It must not silently return old mock data as if it were real provider data.

### 5.2 Provider Boundary

Create a provider module under `apps/api/src/providers/` that owns:

* provider request construction;
* API-Football response parsing;
* status mapping;
* fixture normalization;
* validation of critical fields.

Critical fields:

* provider fixture id;
* kickoff date;
* fixture status;
* league id/name/season;
* home team id/name;
* away team id/name.

Optional warning fields:

* venue name;
* current goals;
* league round;
* elapsed minute.

### 5.3 Cache And Quota Guard

Use a small in-memory cache in the API process:

* key: `api-football:fixtures:date:<YYYY-MM-DD>`;
* TTL: 15 minutes for date fixtures;
* daily limit default: `100`;
* daily counter reset: UTC date boundary;
* configurable env override: `API_FOOTBALL_DAILY_LIMIT`;
* testable clock injection for deterministic unit tests.

This is not production-grade quota storage. For one-owner local development, it is enough and avoids adding a database before the boundary is proven.

### 5.4 Web Shell

The shell should render a match feed state:

```typescript
export type MatchFeedViewState =
  | { status: 'loading'; date: string }
  | { status: 'ready'; date: string; matches: AppMatch[]; warnings: string[] }
  | { status: 'empty'; date: string; warnings: string[] }
  | { status: 'unavailable'; date: string; reason: string; warnings: string[] };
```

`shell-entry.ts` renders loading first, fetches `/api/v1/matches?date=<client date>`, then rerenders the Today and Matches surfaces.

Visible hardcoded match labels in Today and Matches must be removed from the real feed surfaces. Betting journal demo rows can remain only where explicitly marked as shell/manual journal context, not as live fixture data.

---

## 6. Error Handling

| Situation | Backend Behavior | Web Behavior |
| --- | --- | --- |
| Missing `API_FOOTBALL_KEY` | `503`, code `api_football_key_missing` | Show provider setup required; no mock feed disguised as real |
| Daily quota exhausted | `429`, code `api_football_quota_exhausted` | Show quota exhausted state |
| Provider HTTP failure | `502`, code `api_football_provider_error` | Show provider unavailable state |
| Invalid provider payload | `502`, code `api_football_invalid_payload` | Show provider data invalid state |
| Valid response with no fixtures | `200`, empty `matches` | Show empty matchday state |

---

## 7. Security And Guardrails

* No API key may appear in browser code, committed files, logs, screenshots, or generated docs.
* `.env.example` may document the variable name with an empty value only.
* Provider error logs must not print request headers.
* No odds endpoint is called.
* No model or prediction route is connected to the match feed.
* No club-competition assumption is embedded into core parsing. API-Football payloads are normalized competition-agnostically.

---

## 8. Verification Requirements

Focused verification:

```bash
pnpm exec vitest run apps/api/src/providers apps/api/src/services apps/api/src/routes apps/web/src
pnpm run typecheck
pnpm run verify:lifecycle
git diff --check
```

Rendered web verification after implementation:

```bash
pnpm run dev:api
pnpm run dev:web
```

Then validate:

* app loads;
* Today and Matches show loading, unavailable, empty, or real fixture states;
* no hardcoded `Team Alpha vs Team Beta` appears in the live match feed;
* browser console has no relevant app errors.

Full local verification before closing the code phase:

```bash
pnpm run verify:local
```

---

## 9. Exit Criteria

Phase 8.6E can close only when:

1. `/api/v1/matches` is backed by an API-Football provider boundary with tests.
2. Missing-key and quota-exhausted states are explicitly tested.
3. The web shell renders provider-backed match feed states instead of visible hardcoded match feed data.
4. No provider key is exposed to the browser or repository.
5. No odds, predictions, model runtime, or betting recommendation behavior is added.
6. Focused tests, typecheck, lifecycle verification, and `git diff --check` pass.
