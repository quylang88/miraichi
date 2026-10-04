# FotMob National-Team Coverage Matrix

## Verified boundary

- Verification date: **2026-09-24**.
- Source: the already owner-approved unofficial FotMob boundary in ADR-0049.
- Discovery evidence: `https://www.fotmob.com/api/data/allLeagues`.
- Edition evidence: `https://www.fotmob.com/api/data/leagues?id={FotMob ID}&ccode3=INT&season={provider season}`.
- Scope: current or explicitly scheduled national-team competitions with exact provider league ID,
  selected edition, stable match IDs, and timezone-qualified kickoffs.
- This verification does not approve deployment, production promotion, historical hydration, a new
  provider, or any attempt to bypass provider controls.

## Enabled current editions

| Competition ID | FotMob | Canonical / provider season | Observed fixtures | Observed window | Coverage |
|---|---:|---|---:|---|---|
| `uefa-nations-league-a` | 9806 | `2026-27` / `2026/2027` | 48 | 2026-09-24 to 2026-11-17 | supported |
| `uefa-nations-league-b` | 9807 | `2026-27` / `2026/2027` | 48 | 2026-09-24 to 2026-11-17 | supported |
| `uefa-nations-league-c` | 9808 | `2026-27` / `2026/2027` | 48 | 2026-09-25 to 2026-11-16 | supported |
| `uefa-nations-league-d` | 9809 | `2026-27` / `2026/2027` | 12 | 2026-09-24 to 2026-11-16 | supported |
| `concacaf-nations-league` | 9821 | `2026-27` / `2026/2027` | 74 | 2026-09-23 to 2026-10-07 | supported |
| `fifa-asean-cup` | 13287 | `2026` / `2026` | 21 | 2026-09-24 to 2026-10-05 | supported |
| `fifa-u20-womens-world-cup` | 10369 | `2026` / `2026` | 52 | 2026-09-05 to 2026-09-27 | supported |
| `asian-games-football` | 9833 | `2026` / `2026` | 25 | 2026-09-15 to 2026-09-26 | supported |
| `caf-afcon-qualification` | 10608 | `2026-27` / `2026/2027` | 156 | 2026-03-25 to 2027-03-28 | supported |
| `uefa-u21-qualification` | 10437 | `2025-26` / `2025/2026` | 240 | 2025-06-05 to 2026-10-06 | supported |
| `fifa-u17-world-cup` | 306 | `2026` / `2026` | 72 | published through 2026-11-27 | partial |
| `fifa-womens-world-cup-qualification-uefa` | 10357 | `2026` / `2026` | 198 | 2026-03-03 to 2026-12-05 | supported |
| `fifa-womens-world-cup-qualification-concacaf` | 10358 | `2026` / `2026` | 4 | 2026-11-27 to 2026-11-28 | partial |
| `afc-asian-cup` | 290 | `2027` / `2027` | 51 | 2027-01-07 to 2027-02-05 | supported |

`partial` is deliberate. FotMob had published only the U-17 group-stage window even though FIFA's
official tournament window ends on 2026-12-13, and only four CONCACAF women's qualifier fixtures
were published. Revalidation may discover later rounds; the registry does not invent them.

## Deliberate exclusions

- `ASEAN Championship` / Hyundai Cup 2026 ended on 2026-08-26. The current upcoming tournament is
  the distinct `FIFA ASEAN Cup` (FotMob 13287), not the completed AFF competition (FotMob 9265).
- FIFA World Cup 2026, Women's Asian Cup 2026, AFCON 2025, Copa America 2024, Gold Cup 2025, and
  Women's EURO 2025 are completed editions. Enabling them now would reopen historical hydration,
  which remains pending by owner decision.
- FIFA U-17 Women's World Cup 2026 was not present as an exact season-league mapping in the verified
  FotMob directory. It is not guessed from daily matches.
- Asian Games women's football was not exposed as a separate exact season-league mapping. The
  enabled `asian-games-football` entry represents the provider's male competition only.
- Friendlies are excluded because they are a broad match bucket rather than a bounded competition.

## Operational consequence

The provider-neutral registry now contains 64 entries: 50 club and 14 national-team competitions.
Fifty-nine editions are executable for current hydration on 2026-09-24. Normal nine-request batch
limits, ETag checkpoints, terminal-only publication, 403/429 circuit breaking, and no historical
execution remain unchanged.

## Frankfurt staging evidence — 2026-09-24

- Supabase Edge v27 bundle SHA-256:
  `b1ed71b70f7fb55bc0bc95b74c7bdf8837022cd00207a55f72f72159908087f4`.
- Cloudflare Worker `62fac25e-e956-426e-8778-6f81cdb4ca3e` serves 100% of staging traffic.
- All 59 executable current-edition checkpoints are complete. The serving database contains
  12,236 matches across 59 competitions, including all 14 national-team competition IDs.
- Hosted browser verification used a real scheduled UEFA Nations League A match for the upcoming
  detail path. Current, terminal, and live scheduler delivery passed with three active jobs and
  four exact Vault names.
- Final owner-data audit retains one pre-existing draft, zero bets, and zero ledger entries.
- The previous Edge v26 SHA `3b8a77ff5717bb1f519333b9edf320cd1b2b60e93f7e3a7d0f86500571c2ca92`
  and Worker `fc867def-cd30-4237-978d-7090f068cb99` remain the rollback baseline.
