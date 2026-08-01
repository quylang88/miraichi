# AI And Sportmonks Removal Product Reset Design

## Status

- **Status**: Owner approved
- **Date**: 2026-08-01
- **Lifecycle command**: `phase:plan AI and Sportmonks Removal Product Reset`
- **Owner approval**: The owner approved the design direction and authorized uninterrupted execution on 2026-08-01.

## Straight Conclusion

Miraichi is no longer an AI prediction product. The active product is an owner-only web application for factual football match data, manual bet/odds records, and bankroll management.

This subproject removes local AI, prediction and explanation surfaces, model-training artifacts, Sportmonks integration, Sportmonks-derived data, and the roadmap phases that would reintroduce them. Git history remains intact.

The replacement website crawler is a separate subproject. This reset must not invent or silently select a website source. Until a source is approved and implemented, `Today` and `Matches` must show the last valid non-Sportmonks serving snapshot or an honest empty, stale, or unavailable state.

## Owner Decisions

The following decisions are final for this design:

1. Keep Git history; remove obsolete artifacts only from the current source tree.
2. Keep factual fixture, schedule, result, status, team, competition, event, lineup, and odds data.
3. Remove predicted probabilities, value-bet feeds, expected-goals data, training datasets, model outputs, and recommendation logic.
4. Future collection runs in a backend worker or scheduled process, through raw cache and normalization. The browser never scrapes third-party pages directly.
5. Keep the application owner-only. Do not add public authentication or multi-tenancy.
6. Remove Sportmonks completely from active source, configuration, tests, commands, raw data, reports, warehouse data, and serving data.
7. Remain competition-agnostic. Future crawlers operate only on an owner-configured competition allowlist that may include national-team and club competitions.
8. Remove the `national-team-first` product guardrail.
9. Remove the fifth `Miraichi` assistant tab. Retain the Miraichi product name.

## Program Decomposition

The wider product change is split into independent subprojects:

1. **This design: AI and Sportmonks removal plus product reset.**
2. Website-source research, terms/robots review, coverage proof, and source ADR.
3. Backend crawler, raw cache, normalization, scheduling, and stale-data handling.
4. Web integration, Bets/Bankroll hardening, integration verification, and staging.

Only the first subproject is authorized for implementation by this spec. A website source is a guardrail-sensitive decision and must not be guessed during cleanup.

## Target Architecture

The runtime boundary after this reset is:

```text
apps/web (Today, Matches, Bets, Bankroll)
    -> apps/api
        -> serving match repository
        -> Supabase-backed owner persistence

apps/worker
    -> reserved for the later approved crawler subproject
```

There is no local AI process, prediction process, explanation/chat route, model runtime, Sportmonks adapter, or provider-specific data path.

## Retained Components

### Web

- `Today`, `Matches`, `Bets`, and `Bankroll` navigation and panels.
- Match feed loading, empty, stale, unavailable, and ready states.
- Manual bet entry, edit, settlement, and history workflows.
- Manual bankroll accounts and signed ledger entries.
- Settings needed by the four retained tabs.

### API And Persistence

- Health, match list, match detail, and snapshot-status endpoints.
- Bet drafts, bets, bankroll, backup/import/export, and cloud-persistence status endpoints.
- Serving-store repository and cloud fallback boundary.
- Supabase-backed owner-only persistence already accepted for non-AI user data.

### Shared And Ingestion

- Match, market/odds, bet, bankroll, cloud-persistence, and provider-neutral ingestion contracts.
- Provider-neutral raw-cache, manifest, provenance, entity-resolution, and canonical-warehouse utilities under `scripts/providers/shared/`.
- Competition-agnostic identifiers and source registries.

The retained ingestion utilities must not contain Sportmonks-specific endpoint keys, fields, source IDs, or assumptions.

## Deleted Runtime And Product Surface

### Local AI Application

Delete the complete `apps/local-ai/` tree, including:

- TypeScript prediction, evaluation, model-candidate, feature, explanation, and report modules;
- Python dataset scripts and tests;
- raw and processed training data;
- discovery, evaluation, leakage, bake-off, and experimental reports;
- competition/model configuration;
- the untracked Python virtual environment and caches.

### API

Delete prediction, mock-prediction, explanation/chat, and mock-explanation route modules. Remove their imports and route registrations from the API entry point.

The removed paths include:

- `/api/v1/predictions`
- `/api/v1/chat`
- `/api/v1/mock/predict`
- `/api/v1/mock/explain`

These paths must return the normal API `404` response after removal. Do not retain disabled AI endpoints or compatibility shims.

### Web

- Remove `miraichi` from the production navigation tab IDs and navigation metadata.
- Delete the assistant panel and all settings hooks scoped only to that panel.
- Delete prediction/explanation views and AI-only mock-client functions and tests.
- Update shell tests to assert exactly four primary tabs.
- Replace AI-oriented visible copy with factual data, manual-journal, or honest unavailable wording.

### Shared Contracts

- Remove mock prediction/explanation fixtures and exports.
- Remove prediction trace and recommendation identifiers from bet-domain types.
- Remove `ai_recommendation` as a bet-record source.
- Keep odds and manual bet fields.
- Keep validation that prevents automated betting-calculation fields only where it protects the manual product contract; do not preserve AI runtime contracts merely as a prohibition mechanism.

### Sportmonks

Delete:

- `scripts/providers/sportmonks/` and all Sportmonks-specific root capture/enrichment/probe commands and tests;
- Sportmonks package scripts and environment examples;
- `sportmonks` source IDs and test fixtures from active shared contracts;
- `apps/api/data/providers/sportmonks/`, including untracked raw payloads, manifests, and reports;
- Sportmonks-derived canonical warehouse and serving-store records;
- Sportmonks-specific plans, reports, route-map references, and active roadmap tasks.

Untracked Sportmonks raw data is intentionally destroyed and cannot be restored from Git. The owner explicitly approved this deletion.

## Documentation And Lifecycle Reset

### Delete From The Current Tree

- `docs/local-ai/`;
- AI/local-AI handoff and agent documents;
- AI betting-recommendation boundary documents;
- Phase 4 local-AI planning/review/report artifacts;
- Phase 7/8 documents that exist only for prediction datasets, evaluation, model readiness, training, or model selection;
- Phase 10 AI training/runtime roadmap content;
- AI-specific ADRs and superseded implementation plans whose only value is available in Git history;
- Phase 4/8 verification scripts and package commands.

Provider-neutral ingestion decisions may be retained after AI-only wording and requirements are removed.

### Rewrite Active Sources Of Truth

- `PROJECT_PLAN.md` becomes a non-AI roadmap. Phase 9 is superseded by the product reset; Phase 10 is removed.
- `README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `WORKFLOW.md`, and `AGENTS.md` describe the four-tab owner-only application and future website-crawler boundary.
- `.agent/skills/miraichi-project-guardrails/SKILL.md` removes model-training, World-Cup-first, national-team-first, and prediction-specific rules.
- `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` removes local-AI integration requirements and AI examples.
- Agent catalogs remove the AI/Data agent or replace it with a narrowly scoped Data Ingestion role only in a later approved docs change. This reset removes the active AI/Data role.

### Decision Record

Keep this design and one accepted decision record that states AI and Sportmonks are intentionally removed. This is the only active documentation allowed to describe their removal as a current architectural decision. Historical details remain in Git history rather than the active documentation tree.

## Data Purge Rules

1. Delete all `apps/local-ai` raw/processed datasets and reports.
2. Delete all Sportmonks raw payloads, manifests, reports, token/config files, and cached responses.
3. Delete canonical or serving records when their source/provenance is Sportmonks.
4. Preserve non-Sportmonks owner data: bet drafts, bet records, bankroll accounts, bankroll ledger entries, and backups.
5. Do not delete Supabase owner persistence or migrations merely because they reject AI/formula fields.
6. If the serving store becomes empty after provenance purge, expose the existing empty/unavailable state. Do not seed fake matches.

## Error Handling

- Removed API routes use the standard `404` response, not a fake success or disabled prediction envelope.
- Missing match data is represented by existing empty, stale, or unavailable states.
- No fallback may return mock predictions, mock explanations, hardcoded matches, or Sportmonks snapshots.
- Build and verification commands must fail if active runtime source reintroduces `apps/local-ai`, Sportmonks package commands, AI API routes, or the fifth assistant tab.
- Historical Git commits are not scanned by runtime guardrails.

## Controlled Purge Sequence

### Slice 1: AI-Free Guardrail And Lifecycle Reset

Add or update repository verification so the intended boundary is executable. Rewrite active root/project lifecycle documents before deleting the implementations they currently require.

Exit condition: the focused guardrail test fails against the current AI/Sportmonks tree and passes only after the reset rules are implemented.

### Slice 2: Runtime Detachment

Remove AI API routes, web tab/views, mock prediction data, shared prediction/recommendation fields, package commands, and Phase 4 integration hooks.

Exit condition: focused API, web, shared, typecheck, and endpoint tests pass with exactly four tabs and no AI endpoints.

### Slice 3: Application, Provider, Data, And Documentation Purge

Delete `apps/local-ai`, Sportmonks code/data, AI phase scripts, AI-only ADRs/plans/reports, and Sportmonks-derived data. Repair remaining active documentation references.

Exit condition: repository scans, unit tests, typecheck, local verification, and integration verification pass without AI or Sportmonks dependencies.

## Testing Strategy

### TDD Requirement

Each slice begins with a failing test or verifier assertion. Deletion is not exempt from TDD: the test must define the post-removal boundary before implementation files are deleted.

### Focused Checks

- Repository guardrail test rejects forbidden runtime paths, package commands, navigation IDs, and API routes.
- API endpoint tests expect `404` for removed AI paths while retained endpoints continue to respond.
- Web navigation and shell tests expect exactly `today`, `matches`, `bets`, and `bankroll`.
- Shared contract tests prove manual bets and odds still work without prediction/recommendation fields.
- Ingestion tests prove generic cache/manifest/provenance/warehouse utilities remain independent of Sportmonks.

### Required Final Verification

Run:

```text
pnpm run verify:local
pnpm run test:integration
git diff --check
```

The integration command must no longer call Phase 4/local-AI verification. It must cover retained API endpoints and PWA verification.

## Non-Goals

- Selecting or implementing a website scraper.
- Live-score polling or odds refresh scheduling.
- Public authentication or multi-user data isolation.
- Automatic stake sizing, risk scoring, Kelly, ROI, CLV, value-bet, recommendation, or prediction logic.
- New production database schemas.
- Rewriting Git history.
- Production or staging deployment during this reset.

## Completion Criteria

The reset is complete only when:

1. `apps/local-ai/` and Sportmonks code/data are absent from the current tree.
2. The web exposes exactly four primary tabs.
3. The API exposes no prediction or explanation routes.
4. Shared business contracts contain no AI recommendation or prediction-trace coupling.
5. Active lifecycle and roadmap documents contain no future AI phase or national-team-first restriction.
6. The integration suite has no local-AI dependency.
7. Owner bet/bankroll persistence remains intact.
8. Empty match data is presented honestly without fake fallback records.
9. `pnpm run verify:local`, `pnpm run test:integration`, and `git diff --check` pass.

## Next Subproject

After this reset closes, the earliest safe next command is:

`phase:plan Website Source Selection And Crawler Boundary`

That phase must identify the exact website, verify terms/robots and factual/odds coverage, define crawl cadence and stale-data policy, and obtain an owner-approved source decision before crawler code is written.
