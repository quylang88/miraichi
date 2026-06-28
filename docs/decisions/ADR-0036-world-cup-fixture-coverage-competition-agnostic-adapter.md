# ADR-0036: World Cup Fixture Coverage and Competition-Agnostic Adapter Design

* **Status**: Accepted
* **Date**: 2026-06-28
* **Accepted Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This accepted ADR treats World Cup coverage as the first use case only. It does not allow hard-coded tournament logic.

---

## 1. Context
The immediate product target may require full FIFA World Cup fixture coverage. That does not justify World Cup-specific parser code, database tables, routes, or prediction logic.

Miraichi must remain competition-agnostic: the same ingestion and normalization path should support another league or tournament by changing configuration, not core code.

## 2. Options Considered
* **Option A**: Write World Cup-specific parsers, tables, and routes.
* **Option B (Accepted)**: Use a generic provider adapter and map provider competition IDs to internal generic competition IDs through configuration.

## 3. Decision
Accept **Option B**.

Provider-specific IDs such as a World Cup league ID should be supplied through configuration or a later owner-approved registry store. Parser and downstream contracts should only use generic concepts such as `competitionId`, `seasonId`, `teamId`, `matchId`, and `marketId`.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| How should team name variations be handled? | Use a canonical team registry with provider aliases, source provider IDs, and manual review for unknown or low-confidence aliases. | Names vary across providers and bookmakers. IDs and alias maps are safer than string matching in parser logic. | String matching in parser code will create silent duplicate teams and corrupted datasets. |
| Should registry config support multiple active seasons for the same tournament? | Yes, model `competitionId` and `seasonId` separately in configuration. Do not decide production DB schema in this ADR. | Tournaments recur and providers often encode seasons separately. | A single active season assumption will block historical comparisons and multi-season evaluation. |

## 5. Consequences
* World Cup coverage becomes a configuration case, not a code fork.
* Future leagues and tournaments can reuse the same adapter boundary.
* Cup-specific facts such as neutral venues, extra time, and penalties can be represented as generic match metadata extensions if approved later.

## 6. Risks
* International tournaments may expose provider fields differently from domestic leagues.
* Cup-specific rules can tempt developers to hardcode behavior if metadata is under-specified.

## 7. Explicit Exclusions
* No World Cup-specific parser, route, table, or model logic is approved.
* No production registry database schema is approved.
* No exact environment variable names or production configuration values are approved.
* No prediction algorithm or betting logic is approved.

## 8. Acceptance Notes
Accepted by the project owner on 2026-06-28 as a Phase 7 planning boundary only. This decision authorizes competition-agnostic adapter design constraints, not live provider integration, production registry storage, World Cup-specific code, prediction algorithms, or betting logic.
