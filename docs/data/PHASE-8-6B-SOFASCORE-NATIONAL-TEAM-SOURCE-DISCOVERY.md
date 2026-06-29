# Phase 8.6B Sofascore National-Team Source Discovery Report

## Status
- Discovery report status: pass
- Odds report status: blocked
- Generated at: 2026-06-29T02:45:42.393Z
- Bookmaker baseline available now: no
- Bookmaker baseline status: bookmaker_baseline_unavailable_under_current_constraints

## Sofascore Competition Discovery
| Competition ID | Display Name | Sofascore ID | Status | Completed Seasons | Future Seasons | Completed Events | Rejected Events |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| comp-int-world-cup | FIFA World Cup | 16 | ready_for_ingestion_plan | 23 | 0 | 120 | 0 |
| comp-int-euro | UEFA European Championship | 1 | ready_for_ingestion_plan | 17 | 0 | 108 | 0 |
| comp-int-afcon | Africa Cup of Nations | 270 | ready_for_ingestion_plan | 9 | 0 | 72 | 0 |
| comp-int-copa-america | Copa America | 133 | ready_for_ingestion_plan | 7 | 0 | 56 | 0 |
| comp-int-afc-asian-cup | AFC Asian Cup | 246 | ready_for_ingestion_plan | 4 | 1 | 108 | 0 |
| comp-int-concacaf-gold-cup | CONCACAF Gold Cup | 140 | ready_for_ingestion_plan | 8 | 0 | 72 | 0 |
| comp-int-uefa-nations-league | UEFA Nations League | 10783 | ready_for_ingestion_plan | 4 | 1 | 337 | 7 |

## Odds Baseline Discovery
| Source | Status | Evidence |
| --- | --- | --- |
| the-odds-api | blocked_paid_or_keyed | Historical odds require keyed or paid access and are not approved for Phase 8.6B. |
| api-football | blocked_keyed_or_unverified | Coverage and quota require provider verification with a key; Phase 8.6B does not approve keys or secrets. |
| football-data-match-history | rejected_national_team_coverage_missing | The local soccerdata MatchHistory league list is club-league only in the current environment. |
| sofascore | rejected_no_odds_fields | The accessible schedule/event path provides fixture, team, score, and status fields, not bookmaker odds. |

## Verification
- `pnpm run phase8:sofascore-national-team-discovery`: PASS
- `pnpm run verify:local`: Required external verification
- `pnpm run test:integration`: Not required for this discovery/reporting phase

## Explicit Non-Authorizations
- No main training dataset merge.
- No fake bookmaker baseline.
- No model selection.
- No runtime prediction surface.
- No betting recommendation.
- No API keys, secrets, or paid providers.
- No club competition expansion.
