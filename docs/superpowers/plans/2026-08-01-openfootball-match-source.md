# OpenFootball Match Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a backend-only, allowlisted OpenFootball ingestion path that captures exact Football.TXT evidence, normalizes one club competition and one national-team competition, and atomically publishes a non-live serving snapshot.

**Architecture:** `apps/worker` fetches only tracked `raw.githubusercontent.com/openfootball` paths, archives changed UTF-8 text before parsing, converts a strict Football.TXT Level 1 subset into provider-neutral canonical records, and writes a run-scoped warehouse snapshot. The existing serving store remains the application boundary: version files are written first and `manifest.json` is replaced last, so any fetch, parse, mapping, count, or publication failure leaves the last valid serving version active.

**Tech Stack:** TypeScript 6, Node.js 18+, pnpm workspaces, Vitest 4, native `fetch`, `@js-temporal/polyfill`, filesystem JSON/JSONL, existing Miraichi canonical and serving-store contracts.

## Global Constraints

- Keep Git history; every slice is a new commit and no existing commit is amended or rewritten.
- OpenFootball is the only external match source approved by ADR-0045.
- Fetch only `https://raw.githubusercontent.com/openfootball/<repository>/master/<filePath>` entries declared in tracked configuration.
- The first production registry contains exactly one club source and one national-team source.
- The browser never requests GitHub, OpenFootball, arbitrary URLs, odds, or live-match endpoints.
- The worker never scrapes GitHub HTML, searches repositories at runtime, clones repositories, executes downloaded text, or sends credentials.
- OpenFootball supplies scheduled fixtures and completed results only; it never emits `in_play` and the UI never labels this feed `LIVE`.
- Odds and live-bet placement context remain manual and are outside this plan.
- The default and minimum refresh interval is 360 minutes; owner-triggered capture uses the same gate.
- HTTP timeout is 10 seconds; maximum attempts are 3; maximum accepted payload size is 1,048,576 bytes.
- Archive every changed successful response before parsing it.
- Any enabled-source failure aborts the publication transaction and preserves the last valid serving manifest.
- A source entry must publish at least its configured minimum match count and may not lose more than 5 percent of its prior valid matches.
- Canonical match identity excludes kickoff time and uses `competitionId | season | normalizedRound | homeTeamId | awayTeamId`.
- Missing or ambiguous kickoff time, unresolved team aliases, duplicate identities, unsupported encoding, impossible scores, and unrecognized match lines are withheld; no value is guessed.
- New implementation files are TypeScript-first and all behavior is developed test-first.

---

## File Structure

- `packages/config/src/openfootball-source-registry.ts`: exact repositories, paths, competition metadata, freshness limits, payload limits, and publication thresholds.
- `packages/config/src/openfootball-team-aliases.ts`: explicit source-name to canonical-team mappings for the two initial entries.
- `packages/shared/src/contracts/provider-ingestion-contracts.ts`: OpenFootball raw evidence and capture-manifest contracts.
- `packages/shared/src/contracts/local-match-contracts.ts`: the reduced approved-source union; the existing factual match shape remains provider-neutral.
- `apps/worker/src/sources/openfootball/openfootball-client.ts`: allowlisted conditional HTTP capture with timeout, byte, content-type, redirect, and retry enforcement.
- `apps/worker/src/sources/openfootball/football-txt-parser.ts`: strict focused Level 1 parser that never invents values.
- `apps/worker/src/sources/openfootball/openfootball-time.ts`: explicit-offset and IANA-timezone conversion with ambiguous local times rejected.
- `apps/worker/src/sources/openfootball/openfootball-adapter.ts`: alias resolution, provider-neutral IDs, canonical records, links, provenance, and serving projection.
- `apps/worker/src/sources/openfootball/openfootball-publication-validator.ts`: duplicate, contract, count, deletion, and all-source publication gates.
- `scripts/providers/shared/raw-cache.ts` and `manifest.ts`: evidence persistence and last-capture lookup.
- `scripts/providers/shared/canonical-warehouse.ts`: complete immutable run-scoped JSONL snapshots addressed by run ID.
- `apps/worker/src/jobs/openfootball-ingestion-job.ts`: due-gated all-or-nothing orchestration.
- `scripts/capture-openfootball.ts`: owner CLI that invokes the same job and cannot force the interval gate.
- `apps/api/src/repositories/serving-match-store.ts`: atomic final manifest write and factual venue projection.
- `apps/api/src/repositories/serving-match-store-repository.ts`: 12-hour stale semantics for a six-hour source.
- `apps/web/src/components/app-shell.ts`: ready/stale/unavailable snapshot copy with no OpenFootball `LIVE` control.
- `tests/integration/openfootball-match-source.test.ts`: local-fixture raw-to-serving proof for both competition types and last-good preservation.

---

### Task 1: Lock Approved Provider And Source Registry Contracts

**Files:**
- Create: `packages/config/src/openfootball-source-registry.ts`
- Create: `packages/config/src/openfootball-source-registry.test.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.ts`
- Modify: `packages/shared/src/contracts/provider-ingestion-contracts.test.ts`
- Modify: `packages/shared/src/contracts/local-match-contracts.ts`
- Modify: `packages/shared/src/contracts/local-match-contracts.test.ts`
- Modify: `apps/worker/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `OpenFootballCompetitionSource`, `OPENFOOTBALL_SOURCE_REGISTRY`, `validateOpenFootballSourceRegistry(entries)`, `buildOpenFootballRawUrl(entry)`.
- Produces: `ProviderId = 'openfootball' | 'manual-snapshot'` and `LocalDataSourceId = 'openfootball' | 'manual-snapshot'`.
- Produces: OpenFootball-required raw source/response metadata, capture statuses, and `validateProviderCaptureManifestEntry(input)`.

- [ ] **Step 1: Write failing registry and contract tests**

Add assertions for the two exact entries and every rejection boundary:

```ts
expect(OPENFOOTBALL_SOURCE_REGISTRY.map((entry) => entry.entryId)).toEqual([
  'openfootball-england-premier-league-2026-27',
  'openfootball-world-cup-2026-group-stage'
]);
expect(buildOpenFootballRawUrl(OPENFOOTBALL_SOURCE_REGISTRY[0]!)).toBe(
  'https://raw.githubusercontent.com/openfootball/england/master/2026-27/1-premierleague.txt'
);
expect(validateOpenFootballSourceRegistry([
  { ...OPENFOOTBALL_SOURCE_REGISTRY[0]!, filePath: '../README.md' }
])).toEqual(expect.arrayContaining([expect.stringContaining('path traversal')]));
expect(validateOpenFootballSourceRegistry([
  { ...OPENFOOTBALL_SOURCE_REGISTRY[0]!, origin: 'http://raw.githubusercontent.com' }
])).toEqual(expect.arrayContaining([expect.stringContaining('HTTPS')]));
expect(validateOpenFootballSourceRegistry([
  { ...OPENFOOTBALL_SOURCE_REGISTRY[0]!, refreshIntervalMinutes: 359 }
])).toEqual(expect.arrayContaining([expect.stringContaining('360')]));
expect(validateOpenFootballSourceRegistry([
  { ...OPENFOOTBALL_SOURCE_REGISTRY[0]!, sourceTimezone: 'Mars/Olympus' }
])).toEqual(expect.arrayContaining([expect.stringContaining('IANA')]));
```

Update contract tests so `openfootball` is accepted, stale source IDs are rejected, and OpenFootball envelopes require exact text metadata.

- [ ] **Step 2: Run tests and verify the red state**

Run:

```text
pnpm exec vitest run packages/config/src/openfootball-source-registry.test.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts packages/shared/src/contracts/local-match-contracts.test.ts
```

Expected: FAIL because the registry module and new contract fields do not exist.

- [ ] **Step 3: Implement the exact source registry**

Define the registry with no runtime discovery:

```ts
export type OpenFootballRepository =
  | 'england'
  | 'europe'
  | 'champions-league'
  | 'world'
  | 'worldcup';

export interface OpenFootballCompetitionSource {
  entryId: string;
  sourceId: 'openfootball';
  origin: 'https://raw.githubusercontent.com';
  competitionId: string;
  competitionName: string;
  expectedCompetitionHeader: string;
  competitionType: 'club' | 'national-team';
  repository: OpenFootballRepository;
  ref: 'master';
  filePath: string;
  season: string;
  sourceTimezone: string;
  refreshIntervalMinutes: number;
  maxPayloadBytes: number;
  minimumExpectedMatches: number;
  maximumMissingRatio: number;
  enabled: boolean;
}

export const OPENFOOTBALL_SOURCE_REGISTRY: readonly OpenFootballCompetitionSource[] = Object.freeze([
  {
    entryId: 'openfootball-england-premier-league-2026-27',
    sourceId: 'openfootball',
    origin: 'https://raw.githubusercontent.com',
    competitionId: 'eng-premier-league',
    competitionName: 'English Premier League',
    expectedCompetitionHeader: 'English Premier League 2026/27',
    competitionType: 'club',
    repository: 'england',
    ref: 'master',
    filePath: '2026-27/1-premierleague.txt',
    season: '2026-27',
    sourceTimezone: 'Europe/London',
    refreshIntervalMinutes: 360,
    maxPayloadBytes: 1_048_576,
    minimumExpectedMatches: 300,
    maximumMissingRatio: 0.05,
    enabled: true
  },
  {
    entryId: 'openfootball-world-cup-2026-group-stage',
    sourceId: 'openfootball',
    origin: 'https://raw.githubusercontent.com',
    competitionId: 'world-cup-2026',
    competitionName: 'World Cup',
    expectedCompetitionHeader: 'World Cup 2026',
    competitionType: 'national-team',
    repository: 'worldcup',
    ref: 'master',
    filePath: '2026--canada-usa-mexico/cup.txt',
    season: '2026',
    sourceTimezone: 'America/New_York',
    refreshIntervalMinutes: 360,
    maxPayloadBytes: 1_048_576,
    minimumExpectedMatches: 60,
    maximumMissingRatio: 0.05,
    enabled: true
  }
]);
```

`validateOpenFootballSourceRegistry` must reject duplicate entry IDs, duplicate repository/ref/file-path triples, empty expected headers, unknown repositories, any ref other than `master`, backslashes, leading slashes, `..` path segments, query/hash characters, non-`.txt` paths, invalid IANA timezones, refresh below 360, payload limits outside `1..1_048_576`, minimum counts below 1, missing ratios outside `0..0.05`, and disabled-only registries. Multiple tracked files may target the same competition/season in a future reviewed registry. `buildOpenFootballRawUrl` must validate first and construct through `new URL()`.

Update provider contracts with these exact conditional fields:

```ts
export interface OpenFootballRawSourceMetadata {
  allowlistEntryId: string;
  repository: string;
  ref: string;
  filePath: string;
}

export interface RawProviderResponseMetadata {
  etag?: string;
  lastModified?: string;
  contentType: string;
  byteCount: number;
}

export type ProviderCaptureStatus =
  | 'pending'
  | 'captured'
  | 'not_modified'
  | 'invalid'
  | 'published'
  | 'skipped'
  | 'unavailable'
  | 'failed';

export interface ProviderCaptureManifestEntry {
  runId?: string;
  allowlistEntryId?: string;
  provider: ProviderId;
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
  status: ProviderCaptureStatus;
  fetchedAt?: string;
  httpStatus?: number;
  attemptCount?: number;
  page?: number;
  hasMore?: boolean;
  payloadHash?: string;
  recordCount?: number;
  errorCode?: string;
  errorMessage?: string;
}
```

For `provider === 'openfootball'`, the validator requires `source`, `response`, an empty `query`, and a string `payload`. Add optional factual `venue?: string` to `CanonicalMatch`; `LocalMatch` already has this serving field. Half-time scores remain parsed source evidence in this slice and do not expand cloud storage until a separate product requirement asks the app to display or query them.

Add the workspace dependency before worker source files import the registry:

```text
pnpm --filter worker add "@miraichi/config@workspace:*"
```

`validateProviderCaptureManifestEntry` requires `runId`, `allowlistEntryId`, and `fetchedAt` when `provider === 'openfootball'`; the fields remain optional in the shared interface so existing manual-snapshot evidence remains readable.

- [ ] **Step 4: Run focused tests and typecheck**

Run:

```text
pnpm exec vitest run packages/config/src/openfootball-source-registry.test.ts packages/shared/src/contracts/provider-ingestion-contracts.test.ts packages/shared/src/contracts/local-match-contracts.test.ts
pnpm run typecheck
```

Expected: all focused tests and typecheck PASS.

- [ ] **Step 5: Commit the contract boundary**

```text
git add packages/config/src packages/shared/src/contracts apps/worker/package.json pnpm-lock.yaml
git commit -m "feat: define OpenFootball source boundary"
```

---

### Task 2: Archive Exact Text And Capture Manifest State

**Files:**
- Modify: `scripts/providers/shared/raw-cache.ts`
- Modify: `scripts/providers/shared/raw-cache.test.ts`
- Modify: `scripts/providers/shared/manifest.ts`
- Modify: `scripts/providers/shared/manifest.test.ts`

**Interfaces:**
- Consumes: `RawProviderPayloadEnvelope`, `ProviderCaptureManifestEntry` from Task 1.
- Produces: `createTextPayloadHash(text)`, `readLatestRawProviderPayload(root, provider, endpointKey)`, `readLatestProviderManifestEntry(root, provider, endpointKey)`.

- [ ] **Step 1: Write failing evidence-store tests**

```ts
expect(createTextPayloadHash('a\r\nb\n')).not.toBe(createTextPayloadHash('a\nb\n'));

const latest = await readLatestRawProviderPayload(root, 'openfootball', 'openfootball-england-premier-league-2026-27');
expect(latest).toMatchObject({
  provider: 'openfootball',
  payload: '= English Premier League 2026/27\n'
});

const manifest = await readLatestProviderManifestEntry(
  root,
  'openfootball',
  'openfootball-england-premier-league-2026-27'
);
expect(manifest?.status).toBe('published');
```

Write two raw envelopes with different `fetchedAt` values and prove the reader selects by envelope timestamp rather than filename or directory iteration order. Write malformed JSON after valid manifest lines and prove the reader throws `provider_manifest_invalid` instead of silently ignoring corruption.

- [ ] **Step 2: Run tests and verify the red state**

Run:

```text
pnpm exec vitest run scripts/providers/shared/raw-cache.test.ts scripts/providers/shared/manifest.test.ts
```

Expected: FAIL because text hashing and latest-record readers are absent.

- [ ] **Step 3: Implement byte-exact hashing and deterministic readers**

```ts
export function createTextPayloadHash(text: string): string {
  return createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

export async function readLatestRawProviderPayload(
  root: string,
  provider: ProviderId,
  endpointKey: string
): Promise<RawProviderPayloadEnvelope | null> {
  // Read all dated JSON envelopes below the exact provider/endpoint directory,
  // validate each envelope, and return the greatest fetchedAt value.
}
```

The raw writer must add a trailing newline, reject an invalid envelope before creating a file, and preserve exact `payload` text including CRLF/LF differences. The manifest reader must parse every non-empty JSONL line, validate provider and endpoint identity, and return the newest matching `fetchedAt`; malformed content throws a typed error. Manifest writes remain append-only evidence.

- [ ] **Step 4: Run focused verification**

Run:

```text
pnpm exec vitest run scripts/providers/shared/raw-cache.test.ts scripts/providers/shared/manifest.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit evidence persistence**

```text
git add scripts/providers/shared/raw-cache.ts scripts/providers/shared/raw-cache.test.ts scripts/providers/shared/manifest.ts scripts/providers/shared/manifest.test.ts
git commit -m "feat: archive OpenFootball text evidence"
```

---

### Task 3: Implement Bounded Conditional HTTP Capture

**Files:**
- Create: `apps/worker/src/sources/openfootball/openfootball-client.ts`
- Create: `apps/worker/src/sources/openfootball/openfootball-client.test.ts`

**Interfaces:**
- Consumes: `OpenFootballCompetitionSource`, `buildOpenFootballRawUrl(entry)`.
- Produces: `fetchOpenFootballSource(input, dependencies): Promise<OpenFootballFetchResult>` and `OpenFootballFetchError`.

- [ ] **Step 1: Write failing client tests with injected fetch and sleep**

Cover these exact cases:

```ts
expect(request.headers.get('user-agent')).toBe('Miraichi-OpenFootball-Worker/1.0');
expect(request.headers.get('if-none-match')).toBe('"etag-v1"');
expect(result).toMatchObject({
  status: 'changed',
  text: '= English Premier League 2026/27\n',
  byteCount: 33,
  contentType: 'text/plain; charset=utf-8'
});
```

Also assert: `304` returns `not_modified`; network and `503` use at most 3 attempts; `429` uses parsed `Retry-After`; `404`, HTML content, oversized `Content-Length`, oversized body, invalid UTF-8, and redirected non-allowlisted response URLs use one attempt and throw their exact codes; a 10-second abort signal is supplied.

- [ ] **Step 2: Run the client test and verify failure**

Run:

```text
pnpm exec vitest run apps/worker/src/sources/openfootball/openfootball-client.test.ts
```

Expected: FAIL because the client module is missing.

- [ ] **Step 3: Implement the typed client boundary**

Use these signatures:

```ts
export type OpenFootballFetchResult =
  | {
      status: 'changed';
      fetchedAt: string;
      urlPath: string;
      text: string;
      etag?: string;
      lastModified?: string;
      contentType: string;
      byteCount: number;
    }
  | {
      status: 'not_modified';
      fetchedAt: string;
      urlPath: string;
      etag?: string;
      lastModified?: string;
    };

export interface OpenFootballClientDependencies {
  fetchFn: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => Date;
}

export interface OpenFootballFetchInput {
  source: OpenFootballCompetitionSource;
  conditional?: {
    etag?: string;
    lastModified?: string;
  };
}

export type OpenFootballFetchErrorCode =
  | 'network_failed'
  | 'http_server_error'
  | 'rate_limited'
  | 'retry_after_too_long'
  | 'source_unavailable'
  | 'invalid_content_type'
  | 'payload_too_large'
  | 'invalid_utf8'
  | 'redirect_outside_allowlist';

export class OpenFootballFetchError extends Error {
  readonly code: OpenFootballFetchErrorCode;
  readonly httpStatus: number | undefined;
  readonly attemptCount: number;

  constructor(input: {
    code: OpenFootballFetchErrorCode;
    message: string;
    httpStatus?: number;
    attemptCount: number;
  }) {
    super(input.message);
    this.name = 'OpenFootballFetchError';
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.attemptCount = input.attemptCount;
  }
}

export async function fetchOpenFootballSource(
  input: OpenFootballFetchInput,
  dependencies: OpenFootballClientDependencies
): Promise<OpenFootballFetchResult>;
```

Use `AbortSignal.timeout(10_000)`, attempts `1..3`, network/`5xx` delays `[500, 1_500]`, and `Retry-After` seconds or HTTP date capped at 60 seconds. A value above 60 seconds throws `retry_after_too_long` without a tight retry. Accept only `text/plain` with optional charset, decode using `new TextDecoder('utf-8', { fatal: true })`, validate `response.url` when present, send no authorization/cookie header, and never log response bodies.

- [ ] **Step 4: Run focused verification**

Run:

```text
pnpm exec vitest run apps/worker/src/sources/openfootball/openfootball-client.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the HTTP client**

```text
git add apps/worker/src/sources/openfootball/openfootball-client.ts apps/worker/src/sources/openfootball/openfootball-client.test.ts
git commit -m "feat: fetch allowlisted OpenFootball text"
```

---

### Task 4: Parse The Focused Football.TXT Level 1 Grammar

**Files:**
- Create: `apps/worker/src/sources/openfootball/fixtures/england-premier-league-level1.txt`
- Create: `apps/worker/src/sources/openfootball/fixtures/world-cup-level1.txt`
- Create: `apps/worker/src/sources/openfootball/fixtures/ambiguous-level1.txt`
- Create: `apps/worker/src/sources/openfootball/football-txt-parser.ts`
- Create: `apps/worker/src/sources/openfootball/football-txt-parser.test.ts`

**Interfaces:**
- Produces: `ParsedOpenFootballMatch`, `FootballTxtParseIssue`, `FootballTxtParseResult`, `parseFootballTxt(text)`.
- Does not convert local time to UTC or resolve team identity.

- [ ] **Step 1: Add recorded representative source fixtures**

The club fixture contains year/time inheritance and both score states:

```text
= English Premier League 2026/27
# Source: openfootball/england master 2026-27/1-premierleague.txt

▪ Matchday 1
  Fri Aug 21 2026
    20:00  Arsenal FC              v Coventry City FC
  Sat Aug 22
    12:30  Hull City AFC           v Manchester United FC
    15:00  Ipswich Town FC         v Sunderland AFC          2-1 (1-0)
           Nottingham Forest FC    v Leeds United FC
```

The national-team fixture contains group metadata, header-year inheritance, explicit offsets, venues, completed scores, and ignored scoring-detail continuation lines:

```text
= World Cup 2026
# Source: openfootball/worldcup master 2026--canada-usa-mexico/cup.txt

Group A | Mexico  South Africa  South Korea  Czech Republic

▪ Group A
  Thu June 11
    13:00 UTC-6  Mexico       2-0 (1-0)  South Africa     @ Mexico City
                   (Julián Quiñones 9' Raúl Jiménez 67')
    20:00 UTC-6  South Korea  2-1 (0-0)  Czech Republic  @ Guadalajara (Zapopan)
                   (Hwang In-Beom 67' Oh Hyeon-Gyu 80';
                    Ladislav Krejcí 59')
```

The ambiguous fixture contains `11/06/2026`, a first match without time, a negative score, and an unrecognized non-comment line; tests exercise each as a separate input so error codes are deterministic.

- [ ] **Step 2: Write failing parser assertions**

```ts
expect(parseFootballTxt(clubFixture).matches[3]).toMatchObject({
  lineNumber: 10,
  round: 'Matchday 1',
  localDate: '2026-08-22',
  localTime: '15:00',
  timeWasInherited: true,
  sourceHomeName: 'Nottingham Forest FC',
  sourceAwayName: 'Leeds United FC',
  fullTimeScore: null,
  halfTimeScore: null
});

expect(parseFootballTxt(worldCupFixture).matches[0]).toMatchObject({
  localDate: '2026-06-11',
  explicitUtcOffsetMinutes: -360,
  fullTimeScore: { home: 2, away: 0 },
  halfTimeScore: { home: 1, away: 0 },
  venue: 'Mexico City'
});
```

Assert exact issue codes `ambiguous_date`, `missing_kickoff_time`, `impossible_score`, and `unrecognized_line`. Assert the year can inherit from the competition header. Assert comments, blank lines, `####`, `##` comments, `Group X |` roster lines, and a balanced indented scoring-detail continuation block immediately following a completed match are recognized non-serving metadata. A stray or unbalanced scoring-detail block is `unrecognized_line`.

- [ ] **Step 3: Run parser tests and verify failure**

Run:

```text
pnpm exec vitest run apps/worker/src/sources/openfootball/football-txt-parser.test.ts
```

Expected: FAIL because the parser is missing.

- [ ] **Step 4: Implement a line-oriented fail-closed parser**

Use these exact shapes:

```ts
export interface ParsedOpenFootballMatch {
  lineNumber: number;
  competitionHeader: string;
  round: string;
  localDate: string;
  localTime: string | null;
  timeWasInherited: boolean;
  explicitUtcOffsetMinutes: number | null;
  sourceHomeName: string;
  sourceAwayName: string;
  fullTimeScore: { home: number; away: number } | null;
  halfTimeScore: { home: number; away: number } | null;
  venue?: string;
}

export interface FootballTxtParseIssue {
  code:
    | 'missing_competition_header'
    | 'missing_round'
    | 'ambiguous_date'
    | 'missing_kickoff_time'
    | 'impossible_score'
    | 'unrecognized_line';
  lineNumber: number;
  line: string;
  fatal: boolean;
}

export interface FootballTxtParseResult {
  competitionHeader: string | null;
  matches: ParsedOpenFootballMatch[];
  issues: FootballTxtParseIssue[];
}

export function parseFootballTxt(text: string): FootballTxtParseResult;
```

Recognize English month names only. A missing year inherits from the most recent explicit date year or the single four-digit season year in the competition header; reject headers with no usable year or multiple ambiguous years. A missing match time inherits the most recent explicit time inside the same date block. Missing time on the first match in a date block creates a non-fatal issue and withholds that record. Missing header/round, structural ambiguity, impossible scores, and unrecognized non-comment lines are fatal for the payload. Parse scheduled rows on a whitespace-delimited `v` or `-`. Parse completed rows by locating the unique whitespace-delimited `homeScore-awayScore` token with optional `(halfHome-halfAway)` immediately after it; text to the left is home and text to the right before `@` is away. Ignore a balanced scoring-detail continuation block only when it directly follows a completed match.

- [ ] **Step 5: Run focused verification and commit**

Run:

```text
pnpm exec vitest run apps/worker/src/sources/openfootball/football-txt-parser.test.ts
pnpm run typecheck
git add apps/worker/src/sources/openfootball
git commit -m "feat: parse focused Football TXT fixtures"
```

Expected: tests and typecheck PASS, then commit succeeds.

---

### Task 5: Resolve Time, Teams, Canonical Identity, And Provenance

**Files:**
- Create: `packages/config/src/openfootball-team-aliases.ts`
- Create: `packages/config/src/openfootball-team-aliases.test.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `apps/worker/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/worker/src/sources/openfootball/openfootball-time.ts`
- Create: `apps/worker/src/sources/openfootball/openfootball-time.test.ts`
- Create: `apps/worker/src/sources/openfootball/openfootball-adapter.ts`
- Create: `apps/worker/src/sources/openfootball/openfootball-adapter.test.ts`
- Modify: `scripts/providers/shared/entity-resolution.ts`
- Modify: `scripts/providers/shared/entity-resolution.test.ts`

**Interfaces:**
- Consumes: parsed matches and source entries.
- Produces: `resolveOpenFootballTeamAlias(entryId, sourceName)`, `toOpenFootballKickoffUtc(match, timezone)`, `adaptOpenFootballMatches(input)`, provider-neutral `buildCanonicalMatchId(input)`.

- [ ] **Step 1: Write failing alias, time, identity, and adapter tests**

```ts
expect(resolveOpenFootballTeamAlias(
  'openfootball-england-premier-league-2026-27',
  'Arsenal FC'
)).toMatchObject({ teamId: 'team-arsenal', canonicalName: 'Arsenal' });

expect(toOpenFootballKickoffUtc({
  localDate: '2026-08-21',
  localTime: '20:00',
  explicitUtcOffsetMinutes: null
}, 'Europe/London')).toBe('2026-08-21T19:00:00Z');

const identityInput = {
  competitionId: 'eng-premier-league',
  season: '2026-27',
  normalizedRound: 'matchday-1',
  homeTeamId: 'team-arsenal',
  awayTeamId: 'team-coventry-city'
};
const before = buildCanonicalMatchId(identityInput);
const afterReschedule = buildCanonicalMatchId(identityInput);
expect(afterReschedule).toBe(before);
expect(before).toMatch(/^match-[a-f0-9]{24}$/);
```

Assert an unknown alias is withheld with `unresolved_team_alias`; a parsed competition header that differs from `expectedCompetitionHeader` is rejected with `competition_header_mismatch`; `Temporal` rejects nonexistent/ambiguous local times; explicit `UTC-6` wins over the entry timezone; scheduled rows have null scores; scored rows are `completed`; adapter output never contains `in_play`; duplicate source match tuples produce the same canonical ID for the publication gate to reject.

- [ ] **Step 2: Run tests and verify the red state**

Run:

```text
pnpm exec vitest run packages/config/src/openfootball-team-aliases.test.ts apps/worker/src/sources/openfootball/openfootball-time.test.ts apps/worker/src/sources/openfootball/openfootball-adapter.test.ts scripts/providers/shared/entity-resolution.test.ts
```

Expected: FAIL because the modules and new identity signature are missing.

- [ ] **Step 3: Add the timezone dependency**

Run:

```text
pnpm --filter worker add @js-temporal/polyfill
```

Expected: `apps/worker/package.json` and `pnpm-lock.yaml` record the dependency.

- [ ] **Step 4: Implement explicit tracked aliases**

Use exact records rather than generating IDs from source names:

```ts
export interface OpenFootballTeamAlias {
  sourceEntryId: string;
  sourceName: string;
  teamId: string;
  canonicalName: string;
}

const premierLeagueAliases = [
  ['Arsenal FC', 'team-arsenal', 'Arsenal'],
  ['Coventry City FC', 'team-coventry-city', 'Coventry City'],
  ['Hull City AFC', 'team-hull-city', 'Hull City'],
  ['Manchester United FC', 'team-manchester-united', 'Manchester United'],
  ['Ipswich Town FC', 'team-ipswich-town', 'Ipswich Town'],
  ['Sunderland AFC', 'team-sunderland', 'Sunderland'],
  ['Nottingham Forest FC', 'team-nottingham-forest', 'Nottingham Forest'],
  ['Leeds United FC', 'team-leeds-united', 'Leeds United'],
  ['Everton FC', 'team-everton', 'Everton'],
  ['Crystal Palace FC', 'team-crystal-palace', 'Crystal Palace'],
  ['Brentford FC', 'team-brentford', 'Brentford'],
  ['Tottenham Hotspur FC', 'team-tottenham-hotspur', 'Tottenham Hotspur'],
  ['Manchester City FC', 'team-manchester-city', 'Manchester City'],
  ['AFC Bournemouth', 'team-afc-bournemouth', 'AFC Bournemouth'],
  ['Brighton & Hove Albion FC', 'team-brighton-hove-albion', 'Brighton & Hove Albion'],
  ['Aston Villa FC', 'team-aston-villa', 'Aston Villa'],
  ['Newcastle United FC', 'team-newcastle-united', 'Newcastle United'],
  ['Liverpool FC', 'team-liverpool', 'Liverpool'],
  ['Fulham FC', 'team-fulham', 'Fulham'],
  ['Chelsea FC', 'team-chelsea', 'Chelsea']
] as const;

const worldCupAliases = [
  ['Mexico', 'team-mexico'], ['South Africa', 'team-south-africa'],
  ['South Korea', 'team-south-korea'], ['Czech Republic', 'team-czech-republic'],
  ['Canada', 'team-canada'], ['Bosnia & Herzegovina', 'team-bosnia-herzegovina'],
  ['Qatar', 'team-qatar'], ['Switzerland', 'team-switzerland'],
  ['Brazil', 'team-brazil'], ['Morocco', 'team-morocco'],
  ['Haiti', 'team-haiti'], ['Scotland', 'team-scotland'],
  ['USA', 'team-usa'], ['Paraguay', 'team-paraguay'],
  ['Australia', 'team-australia'], ['Turkey', 'team-turkey'],
  ['Germany', 'team-germany'], ['Curaçao', 'team-curacao'],
  ['Ivory Coast', 'team-ivory-coast'], ['Ecuador', 'team-ecuador'],
  ['Netherlands', 'team-netherlands'], ['Japan', 'team-japan'],
  ['Sweden', 'team-sweden'], ['Tunisia', 'team-tunisia'],
  ['Belgium', 'team-belgium'], ['Egypt', 'team-egypt'],
  ['Iran', 'team-iran'], ['New Zealand', 'team-new-zealand'],
  ['Spain', 'team-spain'], ['Cape Verde', 'team-cape-verde'],
  ['Saudi Arabia', 'team-saudi-arabia'], ['Uruguay', 'team-uruguay'],
  ['France', 'team-france'], ['Senegal', 'team-senegal'],
  ['Iraq', 'team-iraq'], ['Norway', 'team-norway'],
  ['Argentina', 'team-argentina'], ['Algeria', 'team-algeria'],
  ['Austria', 'team-austria'], ['Jordan', 'team-jordan'],
  ['Portugal', 'team-portugal'], ['DR Congo', 'team-dr-congo'],
  ['Uzbekistan', 'team-uzbekistan'], ['Colombia', 'team-colombia'],
  ['England', 'team-england'], ['Croatia', 'team-croatia'],
  ['Ghana', 'team-ghana'], ['Panama', 'team-panama']
] as const;
```

Map each national tuple's canonical name to its source name explicitly. Normalize lookup input only with Unicode NFC, trim, and internal-whitespace collapse; never create a team ID when the lookup misses. Tests must assert 20 club aliases, 48 national-team aliases, and no duplicate `(sourceEntryId, sourceName)`. Multiple spellings may map to one explicit canonical team ID after a future reviewed alias addition.

- [ ] **Step 5: Implement time conversion and provider-neutral IDs**

```ts
export interface CanonicalMatchIdInput {
  competitionId: string;
  season: string;
  normalizedRound: string;
  homeTeamId: string;
  awayTeamId: string;
}

export function buildCanonicalMatchId(input: CanonicalMatchIdInput): string {
  const key = [
    input.competitionId,
    input.season,
    input.normalizedRound,
    input.homeTeamId,
    input.awayTeamId
  ].join('|');
  return `match-${createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 24)}`;
}

export function toOpenFootballKickoffUtc(
  match: Pick<ParsedOpenFootballMatch, 'localDate' | 'localTime' | 'explicitUtcOffsetMinutes'>,
  sourceTimezone: string
): string;

export interface OpenFootballAdapterInput {
  source: OpenFootballCompetitionSource;
  parsedMatches: ParsedOpenFootballMatch[];
  observedAt: string;
}

export interface OpenFootballCanonicalBatch {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
  issues: Array<{ code: string; lineNumber: number; message: string }>;
}
```

Use `Temporal.ZonedDateTime.from(fields, { disambiguation: 'reject' })` when no explicit offset exists. For explicit offsets, compute `Date.UTC(local parts) - offsetMinutes * 60_000`. The adapter creates canonical matches, unique teams, one competition, match provider links, and field provenance for kickoff, status, full-time scores, round, and venue. Half-time scores stay in the parsed result and exact raw evidence but are not projected into the current serving/cloud schema. Provider entity IDs use `entryId` plus a SHA-256 digest of source round/home/away names; canonical IDs contain no provider string or kickoff.

- [ ] **Step 6: Run focused verification and commit**

Run:

```text
pnpm exec vitest run packages/config/src/openfootball-team-aliases.test.ts apps/worker/src/sources/openfootball/openfootball-time.test.ts apps/worker/src/sources/openfootball/openfootball-adapter.test.ts scripts/providers/shared/entity-resolution.test.ts
pnpm run typecheck
git add packages/config/src apps/worker/package.json apps/worker/src/sources/openfootball pnpm-lock.yaml scripts/providers/shared/entity-resolution.ts scripts/providers/shared/entity-resolution.test.ts
git commit -m "feat: normalize OpenFootball matches"
```

Expected: tests and typecheck PASS, then commit succeeds.

---

### Task 6: Gate And Stage Complete Canonical Warehouse Runs

**Files:**
- Modify: `scripts/providers/shared/canonical-warehouse.ts`
- Modify: `scripts/providers/shared/canonical-warehouse.test.ts`
- Create: `apps/worker/src/sources/openfootball/openfootball-publication-validator.ts`
- Create: `apps/worker/src/sources/openfootball/openfootball-publication-validator.test.ts`
- Modify: `apps/api/src/repositories/serving-match-store.ts`
- Modify: `apps/api/src/repositories/serving-match-store.test.ts`
- Modify: `scripts/build-serving-match-store.ts`
- Modify: `scripts/build-serving-match-store.test.ts`

**Interfaces:**
- Consumes: canonical adapter batches and prior `LocalMatchSnapshot`.
- Produces: `writeCanonicalWarehouseRun`, `resolveCanonicalWarehouseRun`, `validateOpenFootballPublicationCandidate`.

- [ ] **Step 1: Write failing warehouse, gate, and atomic serving tests**

```ts
const staged = await writeCanonicalWarehouseRun(root, 'run-001', snapshot);
expect(staged).toBe(join(root, 'warehouse', 'versions', 'run-001'));
expect(await resolveCanonicalWarehouseRun(root, 'run-001')).toBe(staged);
```

Assert the publication validator rejects: candidate counts below `minimumExpectedMatches`; more than 5 percent loss against the matching prior competition; duplicate match IDs; invalid canonical matches; `in_play`; unresolved or missing teams; and a candidate missing either enabled source. Assert a failed second `buildServingMatchStore` call leaves the prior `manifest.json.currentVersion` unchanged.

- [ ] **Step 2: Run tests and verify the red state**

Run:

```text
pnpm exec vitest run scripts/providers/shared/canonical-warehouse.test.ts apps/worker/src/sources/openfootball/openfootball-publication-validator.test.ts apps/api/src/repositories/serving-match-store.test.ts scripts/build-serving-match-store.test.ts
```

Expected: FAIL because snapshot functions and publication gates are absent.

- [ ] **Step 3: Implement run-scoped warehouse snapshots**

```ts
export interface CanonicalWarehouseSnapshot {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
}

export async function writeCanonicalWarehouseRun(
  dataRoot: string,
  runId: string,
  snapshot: CanonicalWarehouseSnapshot
): Promise<string>;

export async function resolveCanonicalWarehouseRun(
  dataRoot: string,
  runId: string
): Promise<string>;
```

Write complete sorted JSONL files under `warehouse/versions/<runId>/`; reject an existing run directory rather than appending. `resolveCanonicalWarehouseRun` accepts only a safe run ID, resolves it under `warehouse/versions`, and rejects traversal or a missing run. The immutable warehouse run has no independent current pointer: the serving manifest is the single operational publication pointer, preventing two manifests from drifting. Retain legacy flat-warehouse reading for the generic build command when no explicit `--warehouse-run` is supplied so existing hand-built tests keep working.

Extend serving publication with an optional trace pointer that the OpenFootball job always supplies:

```ts
export interface BuildServingMatchStoreOptions {
  warehouseRunId?: string;
}

export interface ServingMatchStoreManifest {
  warehouseRunId?: string;
}
```

The generic command accepts `--warehouse-run <safe-run-id>`, resolves that immutable run, and passes the run ID into the serving manifest. Existing manual flat-warehouse builds omit the field.

- [ ] **Step 4: Implement candidate gates and atomic serving manifest replacement**

```ts
export interface OpenFootballPublicationValidationInput {
  sources: readonly OpenFootballCompetitionSource[];
  candidate: CanonicalWarehouseSnapshot;
  priorMatches: LocalMatch[];
}

export function validateOpenFootballPublicationCandidate(
  input: OpenFootballPublicationValidationInput
): { ok: true } | { ok: false; errors: string[] };
```

Count by `(competitionId, season)`, compare only against the matching last-valid partition, calculate loss as `(priorCount - candidateCount) / priorCount`, and reject only positive loss above the configured ratio. Validate all matches before creating a serving version. In `buildServingMatchStore`, write all version files first; write `manifest.json.tmp-<version>`, fsync/close it, then rename it over `manifest.json`. On any pre-manifest failure, remove only the new version directory and preserve the old manifest and version.

- [ ] **Step 5: Run focused verification and commit**

Run:

```text
pnpm exec vitest run scripts/providers/shared/canonical-warehouse.test.ts apps/worker/src/sources/openfootball/openfootball-publication-validator.test.ts apps/api/src/repositories/serving-match-store.test.ts scripts/build-serving-match-store.test.ts
pnpm run typecheck
git add scripts/providers/shared/canonical-warehouse.ts scripts/providers/shared/canonical-warehouse.test.ts apps/worker/src/sources/openfootball/openfootball-publication-validator.ts apps/worker/src/sources/openfootball/openfootball-publication-validator.test.ts apps/api/src/repositories/serving-match-store.ts apps/api/src/repositories/serving-match-store.test.ts scripts/build-serving-match-store.ts scripts/build-serving-match-store.test.ts
git commit -m "feat: gate atomic match snapshot publication"
```

Expected: tests and typecheck PASS, then commit succeeds.

---

### Task 7: Orchestrate All-Or-Nothing OpenFootball Ingestion

**Files:**
- Create: `apps/worker/src/jobs/openfootball-ingestion-job.ts`
- Create: `apps/worker/src/jobs/openfootball-ingestion-job.test.ts`

**Interfaces:**
- Consumes: registry, client, evidence store, parser, adapter, publication validator, warehouse writer, and serving-store builder.
- Produces: `runOpenFootballIngestionJob(options): Promise<OpenFootballIngestionRunResult>`.

- [ ] **Step 1: Write failing orchestration tests**

Use temporary data roots and injected clients to prove these exact flows:

```ts
expect(await runOpenFootballIngestionJob(options)).toMatchObject({
  status: 'published',
  changedSourceCount: 2,
  notModifiedSourceCount: 0,
  publishedMatchCount: 6
});
expect(await readServingMatchStoreSnapshot(servingRoot)).toMatchObject({
  sources: expect.arrayContaining([expect.objectContaining({ sourceId: 'openfootball' })])
});
```

Additional tests: a changed response is present in raw storage before parser invocation; `304` reparses the last raw envelope; all `304` returns `not_modified` without a new serving version; a not-due run makes zero HTTP calls; `404` records `unavailable`; invalid text records `invalid`; one failed source prevents publication of the other; a failed update preserves the prior serving manifest while retaining the failed run only as non-current evidence.

- [ ] **Step 2: Run the job test and verify failure**

Run:

```text
pnpm exec vitest run apps/worker/src/jobs/openfootball-ingestion-job.test.ts
```

Expected: FAIL because the job module is missing.

- [ ] **Step 3: Implement the orchestration contract**

```ts
export type OpenFootballIngestionRunResult =
  | {
      status: 'published';
      runId: string;
      changedSourceCount: number;
      notModifiedSourceCount: number;
      publishedMatchCount: number;
      servingVersion: string;
    }
  | {
      status: 'not_modified' | 'skipped' | 'failed';
      runId: string;
      changedSourceCount: number;
      notModifiedSourceCount: number;
      errorCodes: string[];
    };

export interface OpenFootballIngestionJobOptions {
  dataRoot: string;
  sources: readonly OpenFootballCompetitionSource[];
  now: () => Date;
  dependencies?: Partial<OpenFootballIngestionDependencies>;
}

export interface OpenFootballIngestionDependencies {
  fetchSource: typeof fetchOpenFootballSource;
  parseText: typeof parseFootballTxt;
  writeRawPayload: typeof writeRawProviderPayload;
}
```

The job order is fixed:

1. Validate the full enabled registry and calculate whether every entry is due from the latest `published` or `not_modified` manifest timestamp.
2. Append `pending` for due entries.
3. Fetch each entry sequentially to keep request pressure bounded.
4. For `changed`, build and validate the raw envelope, archive it, append `captured`, then parse.
5. For `not_modified`, load and parse the last archived payload; fail if it is absent.
6. Resolve time/aliases and build all canonical batches in memory.
7. Abort the whole run if any entry has a fatal issue or fails its publication gate.
8. Write the immutable run-scoped warehouse, build serving matches from that exact run, and publish the serving version with `warehouseRunId` in its manifest.
9. Append `published` for each entry only after the serving manifest points to the successful version.

Every failure appends `invalid`, `unavailable`, or `failed` with `runId`, `allowlistEntryId`, error code/message, and fetch timestamp. It never mutates the prior serving manifest.

- [ ] **Step 4: Run focused verification**

Run:

```text
pnpm exec vitest run apps/worker/src/jobs/openfootball-ingestion-job.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the job**

```text
git add apps/worker/src/jobs/openfootball-ingestion-job.ts apps/worker/src/jobs/openfootball-ingestion-job.test.ts
git commit -m "feat: orchestrate OpenFootball ingestion"
```

---

### Task 8: Wire Six-Hour Worker And Owner CLI Without A Force Bypass

**Files:**
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/src/index.test.ts`
- Create: `scripts/capture-openfootball.ts`
- Create: `scripts/capture-openfootball.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `runOpenFootballIngestionJob` from Task 7.
- Produces: root command `data:capture:openfootball` and `startOpenFootballSchedule(dependencies)`.

- [ ] **Step 1: Write failing schedule and CLI tests**

```ts
expect(schedule.intervalMilliseconds).toBe(360 * 60_000);
expect(await runCaptureOpenFootballCommand({ args: [], runJob })).toBe(0);
expect(await runCaptureOpenFootballCommand({ args: ['--force'], runJob })).toBe(2);
expect(runJob).toHaveBeenCalledWith(expect.not.objectContaining({ force: true }));
```

Assert overlapping interval ticks are coalesced by an in-process `running` flag, the first run starts immediately, failures are logged without terminating the scheduler, and `--data-root <absolute path>` is the only accepted CLI override.

- [ ] **Step 2: Run tests and verify the red state**

Run:

```text
pnpm exec vitest run apps/worker/src/index.test.ts scripts/capture-openfootball.test.ts
```

Expected: FAIL because scheduler and CLI exports are absent.

- [ ] **Step 3: Implement schedule and CLI wiring**

```ts
export const OPENFOOTBALL_SCHEDULE_INTERVAL_MS = 360 * 60_000;

export interface ScheduleDependencies {
  runJob: () => Promise<OpenFootballIngestionRunResult>;
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
  log: (message: string) => void;
}

export function startOpenFootballSchedule(dependencies: ScheduleDependencies): {
  intervalMilliseconds: number;
  stop: () => void;
};

export interface CaptureOpenFootballCommandDependencies {
  args: string[];
  runJob: (options: OpenFootballIngestionJobOptions) => Promise<OpenFootballIngestionRunResult>;
}

export function runCaptureOpenFootballCommand(
  dependencies: CaptureOpenFootballCommandDependencies
): Promise<0 | 1 | 2>;
```

Keep `mock-ingestion-job.ts` for the existing Phase 3 verifier, but remove it from the real worker entrypoint. The CLI calls the same due-gated job and rejects `--force`, arbitrary URLs, repository/path flags, and unknown arguments.

Add root scripts:

```json
{
  "data:capture:openfootball": "tsx scripts/capture-openfootball.ts",
  "openfootball:verify": "vitest run packages/config/src/openfootball-source-registry.test.ts packages/config/src/openfootball-team-aliases.test.ts apps/worker/src/sources/openfootball apps/worker/src/jobs/openfootball-ingestion-job.test.ts scripts/capture-openfootball.test.ts"
}
```

- [ ] **Step 4: Run focused verification and commit**

Run:

```text
pnpm exec vitest run apps/worker/src/index.test.ts scripts/capture-openfootball.test.ts
pnpm run openfootball:verify
pnpm run typecheck
git add apps/worker/src/index.ts apps/worker/src/index.test.ts scripts/capture-openfootball.ts scripts/capture-openfootball.test.ts package.json
git commit -m "feat: schedule OpenFootball captures"
```

Expected: tests and typecheck PASS, then commit succeeds.

---

### Task 9: Expose Honest Freshness And Remove Match-Feed LIVE Semantics

**Files:**
- Modify: `apps/api/src/repositories/serving-match-store-repository.ts`
- Modify: `apps/api/src/repositories/serving-match-store-repository.test.ts`
- Modify: `apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.ts`
- Modify: `apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts`
- Create: `supabase/migrations/20260801000000_allow_club_competitions.sql`
- Modify: `apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.sql`
- Modify: `apps/web/src/services/match-feed-service.ts`
- Modify: `apps/web/src/services/match-feed-service.test.ts`
- Modify: `apps/web/src/components/app-shell.ts`
- Modify: `apps/web/src/shell-entry.ts`
- Modify: `apps/web/src/production-shell.test.ts`
- Modify: `scripts/product-boundary-verify.ts`
- Modify: `scripts/product-boundary-verify.test.ts`

**Interfaces:**
- Preserves: API contract values `fresh | stale | missing`.
- Presents: web labels `Ready`, `Stale`, or `Unavailable`, plus snapshot generation time.
- Removes: match-feed `isLiveFilterActive` and `#live-filter-btn`; manual bet context remains untouched.

- [ ] **Step 1: Change tests to the approved non-live semantics**

```ts
expect(statusAtTwelveHours.freshness).toBe('fresh');
expect(statusAfterTwelveHours.freshness).toBe('stale');
expect(html).toContain('Data status: Ready');
expect(html).toContain('Snapshot generated:');
expect(html).not.toContain('id="live-filter-btn"');
expect(html).not.toContain('>LIVE</button>');
```

Change the product-boundary fixture so any `raw.githubusercontent.com`, `github.com/openfootball`, or OpenFootball runtime URL in `apps/web/src` is reported. Add Supabase assertions that a club match writes and reads `competition_type = 'club'` rather than the current hardcoded national-team value.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```text
pnpm exec vitest run apps/api/src/repositories/serving-match-store-repository.test.ts apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts apps/web/src/services/match-feed-service.test.ts apps/web/src/production-shell.test.ts scripts/product-boundary-verify.test.ts
```

Expected: FAIL because freshness is seven days, club persistence is hardcoded, and the LIVE filter still renders.

- [ ] **Step 3: Implement freshness, club persistence, and UI cleanup**

Use a named threshold:

```ts
export const MATCH_SNAPSHOT_STALE_AFTER_MS = 12 * 60 * 60 * 1000;
```

The API returns `fresh` through exactly 12 hours and `stale` after it. The web maps `fresh` to `Ready`, `stale` to `Stale`, and missing/HTTP failure to `Unavailable`; render `generatedAt` without claiming source-live freshness. Remove the LIVE button, CSS, filter state, renderer argument, click handler, `unsupported_match_status` live copy, and fabricated `in_play` test data from the match feed. Replace competition-name keyword inference with `match.competition.type === 'national-team'` or `'club'`, and update the filter fixtures to carry the correct type. In the Supabase adapter, read `competition_type` from the row and bind `match.competition.type` in the insert/update SQL instead of the literal `'national-team'`.

The new migration is additive and does not rewrite migration history:

```sql
begin;

alter table miraichi_app.match_record
  drop constraint if exists match_record_competition_type_check;

alter table miraichi_app.match_record
  add constraint match_record_competition_type_check
  check (competition_type in ('national-team', 'club'));

commit;
```

Update the reference setup SQL with the same two-value check for fresh installations.

- [ ] **Step 4: Run focused verification and commit**

Run:

```text
pnpm exec vitest run apps/api/src/repositories/serving-match-store-repository.test.ts apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts apps/web/src/services/match-feed-service.test.ts apps/web/src/production-shell.test.ts scripts/product-boundary-verify.test.ts
pnpm run verify:product-boundary
pnpm run phase9:cloud-persistence-verify
pnpm run typecheck
git add apps/api/src/repositories/serving-match-store-repository.ts apps/api/src/repositories/serving-match-store-repository.test.ts apps/api/src/persistence/supabase supabase/migrations/20260801000000_allow_club_competitions.sql apps/web/src/services/match-feed-service.ts apps/web/src/services/match-feed-service.test.ts apps/web/src/components/app-shell.ts apps/web/src/shell-entry.ts apps/web/src/production-shell.test.ts scripts/product-boundary-verify.ts scripts/product-boundary-verify.test.ts
git commit -m "refactor: expose non-live match freshness"
```

Expected: focused tests, product boundary, and typecheck PASS, then commit succeeds.

---

### Task 10: Prove Club And National-Team Raw-To-Serving Integration

**Files:**
- Create: `tests/integration/openfootball-match-source.test.ts`
- Modify: `package.json`
- Modify: `apps/api/data/serving/README.md`
- Modify: `docs/superpowers/specs/2026-08-01-openfootball-match-source-design.md`
- Modify: `PROJECT_PLAN.md`

**Interfaces:**
- Consumes the complete OpenFootball path.
- Produces root command `openfootball:integration` and lifecycle evidence for the code-slice closeout.

- [ ] **Step 1: Write the end-to-end integration test**

Use the two recorded fixtures, a mocked `fetchFn`, a temporary data root, and copies of the two registry entries whose test-only minimum counts are set to the exact fixture counts `4` and `2`:

```ts
const first = await runOpenFootballIngestionJob(testOptions);
expect(first.status).toBe('published');

const snapshot = await readServingMatchStoreSnapshot(servingRoot);
expect(new Set(snapshot.matches.map((match) => match.competition.type))).toEqual(
  new Set(['club', 'national-team'])
);
expect(snapshot.matches.every((match) => match.status !== ('in_play' as never))).toBe(true);
expect(snapshot.matches.every((match) => !('odds' in match))).toBe(true);
expect(snapshot.matches.every((match) => match.sourceRefs[0]?.sourceId === 'openfootball')).toBe(true);
```

After the first valid run, advance time by 361 minutes and return malformed text for one source. Assert the run is `failed`, serving `manifest.json.currentVersion` is unchanged, the old snapshot still reads successfully, and the failed payload/manifest error remains archived. Assert the raw cache contains exact club and national fixture text and the canonical match ID remains equal after changing only kickoff time.

- [ ] **Step 2: Run the integration test and verify the red state**

Run:

```text
pnpm exec vitest run tests/integration/openfootball-match-source.test.ts
```

Expected: FAIL until every production seam is wired consistently.

- [ ] **Step 3: Fix only concrete integration seams and wire the command**

Add:

```json
{
  "openfootball:integration": "vitest run tests/integration/openfootball-match-source.test.ts",
  "test:integration": "pnpm run phase3:verify && pnpm run openfootball:integration && pnpm run test:e2e && pnpm run pwa:verify"
}
```

Update the serving README with the exact flow and commands: allowlist -> conditional capture -> raw archive -> parser/adapter -> run-scoped warehouse -> atomic serving version. State explicitly that OpenFootball is periodic, not live, and that owner live-bet snapshots belong to a separate feature.

- [ ] **Step 4: Run full verification**

Run:

```text
pnpm run openfootball:verify
pnpm run openfootball:integration
pnpm run verify:local
pnpm run test:integration
git diff --check
```

Expected: all commands PASS and no whitespace errors are reported.

- [ ] **Step 5: Update lifecycle evidence and commit**

Set the source spec implementation status to complete only after Step 4 passes. Update `PROJECT_PLAN.md` so the next phase is `phase:implementation-plan Manual Live Bet Context Snapshot`; do not mark staging or production approved.

```text
git add package.json apps/api/data/serving/README.md tests/integration/openfootball-match-source.test.ts docs/superpowers/specs/2026-08-01-openfootball-match-source-design.md PROJECT_PLAN.md
git commit -m "test: verify OpenFootball match source"
```

---

## Execution Choice

No execution approach is selected inside this plan. The owner chooses either Subagent-Driven execution with review after every task or Inline Execution in the current session with `superpowers:executing-plans` checkpoints.
