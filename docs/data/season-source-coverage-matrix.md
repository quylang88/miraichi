# Season Source Coverage Matrix

## Verified boundary

- Verified on: **2026-08-28**.
- Target registry: 50 competitions in canonical registry order.
- OpenFootball evidence: tree `4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f` in
  [`openfootball/football.json`](https://github.com/openfootball/football.json/tree/4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f).
- OpenFootball mapping URL: `https://raw.githubusercontent.com/openfootball/football.json/4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f/{season}/{OF ID}`.
- football-data.org evidence: official [free-tier coverage](https://www.football-data.org/coverage),
  [pricing](https://www.football-data.org/pricing), and
  [v4 competition-match endpoint](https://docs.football-data.org/general/v4/competition.html).
- football-data.org mapping URL: `https://api.football-data.org/v4/competitions/{FD code}/matches?season={startYear}`.
  It needs an `X-Auth-Token`; the free tier is limited to 10 calls/minute and returns delayed scores.
- No SportScore data endpoint was called during this verification.

`supported` means the selected anonymous season source has the current season and every row in the
verified file has an exact kickoff time. `partial` means the mapping is historical-only, token-gated,
or current rows lack exact kickoff times. `unsupported` means no usable free mapping was verified.
Date-only rows are retained as raw evidence but are not published with an invented timestamp.

## Matrix

| # | Canonical competition | Status | Cycle | OpenFootball ID | Verified seasons | Exact current kickoff | football-data.org | Daily result source | Detail source |
|---:|---|---|---|---|---|---:|---|---|---|
| 1 | `eng-premier-league` | supported | cross-year | `en.1.json` | 2026-27, 2025-26, 2024-25 | 380/380 | `PL` / 2021 | football-data.org delayed, pending owner token | none |
| 2 | `esp-la-liga` | partial | cross-year | `es.1.json` | 2026-27, 2025-26, 2024-25 | 41/380 | `PD` / 2014 | football-data.org delayed, pending owner token | none |
| 3 | `ita-serie-a` | partial | cross-year | `it.1.json` | 2026-27, 2025-26, 2024-25 | 50/380 | `SA` / 2019 | football-data.org delayed, pending owner token | none |
| 4 | `ger-bundesliga` | partial | cross-year | `de.1.json` | 2026-27, 2025-26, 2024-25 | 45/306 | `BL1` / 2002 | football-data.org delayed, pending owner token | none |
| 5 | `fra-ligue-1` | partial | cross-year | `fr.1.json` | 2026-27, 2025-26, 2024-25 | 40/306 | `FL1` / 2015 | football-data.org delayed, pending owner token | none |
| 6 | `uefa-champions-league` | partial | cross-year | — | — | — | `CL` / 2001 | football-data.org delayed, pending owner token | none |
| 7 | `uefa-europa-league` | unsupported | cross-year | — | — | — | — | none | none |
| 8 | `uefa-conference-league` | unsupported | cross-year | — | — | — | — | none | none |
| 9 | `uefa-super-cup` | unsupported | cross-year | — | — | — | — | none | none |
| 10 | `conmebol-copa-libertadores` | partial | calendar-year | `copa.l.json` | 2025 | — | — | none | none |
| 11 | `conmebol-copa-sudamericana` | unsupported | calendar-year | — | — | — | — | none | none |
| 12 | `afc-champions-league-elite` | unsupported | cross-year | — | — | — | — | none | none |
| 13 | `eng-championship` | partial | cross-year | `en.2.json` | 2026-27, 2025-26, 2024-25 | 288/552 | `ELC` / 2016 | football-data.org delayed, pending owner token | none |
| 14 | `esp-segunda-division` | partial | cross-year | `es.2.json` | 2025-26, 2024-25 | — | — | none | none |
| 15 | `ita-serie-b` | partial | cross-year | `it.2.json` | 2025-26, 2024-25 | — | — | none | none |
| 16 | `ger-2-bundesliga` | partial | cross-year | `de.2.json` | 2025-26, 2024-25 | — | — | none | none |
| 17 | `fra-ligue-2` | partial | cross-year | `fr.2.json` | 2025-26, 2024-25 | — | — | none | none |
| 18 | `ned-eredivisie` | partial | cross-year | `nl.1.json` | 2026-27, 2025-26, 2024-25 | 134/306 | `DED` / 2003 | football-data.org delayed, pending owner token | none |
| 19 | `por-primeira-liga` | partial | cross-year | `pt.1.json` | 2026-27, 2025-26, 2024-25 | 35/306 | `PPL` / 2017 | football-data.org delayed, pending owner token | none |
| 20 | `bel-pro-league` | partial | cross-year | `be.1.json` | 2025-26, 2024-25 | — | — | none | none |
| 21 | `sco-premiership` | partial | cross-year | `sco.1.json` | 2025-26, 2024-25 | — | — | none | none |
| 22 | `tur-super-lig` | partial | cross-year | `tr.1.json` | 2025-26, 2024-25 | — | — | none | none |
| 23 | `sui-super-league` | unsupported | cross-year | — | — | — | — | none | none |
| 24 | `aut-bundesliga` | partial | cross-year | `at.1.json` | 2025-26, 2024-25 | — | — | none | none |
| 25 | `den-superliga` | unsupported | cross-year | — | — | — | — | none | none |
| 26 | `gre-super-league-1` | partial | cross-year | `gr.1.json` | 2025-26, 2024-25 | — | — | none | none |
| 27 | `swe-allsvenskan` | unsupported | calendar-year | — | — | — | — | none | none |
| 28 | `nor-eliteserien` | unsupported | calendar-year | — | — | — | — | none | none |
| 29 | `pol-ekstraklasa` | unsupported | cross-year | — | — | — | — | none | none |
| 30 | `sau-pro-league` | unsupported | cross-year | — | — | — | — | none | none |
| 31 | `usa-mls` | partial | calendar-year | `mls.json` | 2025 | — | — | none | none |
| 32 | `mex-liga-mx` | unsupported | cross-year | — | — | — | — | none | none |
| 33 | `bra-serie-a` | partial | calendar-year | `br.1.json` | 2026, 2025 | 256/380 | `BSA` / 2013 | football-data.org delayed, pending owner token | none |
| 34 | `arg-primera-division` | partial | calendar-year | `ar.1.json` | 2025 | — | — | none | none |
| 35 | `col-primera-a` | partial | calendar-year | `co.1.json` | 2025 | — | — | none | none |
| 36 | `jpn-j1-league` | partial | calendar-year | `jp.1.json` | 2025 | — | — | none | none |
| 37 | `kor-k-league-1` | unsupported | calendar-year | — | — | — | — | none | none |
| 38 | `aus-a-league` | unsupported | cross-year | — | — | — | — | none | none |
| 39 | `chn-csl` | partial | calendar-year | `cn.1.json` | 2025 | — | — | none | none |
| 40 | `tha-league-1` | unsupported | cross-year | — | — | — | — | none | none |
| 41 | `vie-v-league-1` | unsupported | cross-year | — | — | — | — | none | none |
| 42 | `fifa-club-world-cup` | unsupported | calendar-year | — | — | — | — | none | none |
| 43 | `eng-fa-cup` | unsupported | cross-year | — | — | — | — | none | none |
| 44 | `eng-efl-cup` | unsupported | cross-year | — | — | — | — | none | none |
| 45 | `esp-copa-del-rey` | unsupported | cross-year | — | — | — | — | none | none |
| 46 | `ger-dfb-pokal` | unsupported | cross-year | — | — | — | — | none | none |
| 47 | `ita-coppa-italia` | unsupported | cross-year | — | — | — | — | none | none |
| 48 | `fra-coupe-de-france` | unsupported | cross-year | — | — | — | — | none | none |
| 49 | `por-taca-de-portugal` | unsupported | cross-year | — | — | — | — | none | none |
| 50 | `ned-knvb-beker` | unsupported | cross-year | — | — | — | — | none | none |

## Operational conclusions

- Anonymous no-key current hydration can request 9 season files. Only Premier League is complete
  enough for exact kickoff publication; the other eight are partial and publish only rows with a
  factual local kickoff time.
- OpenFootball JSON is rebuilt daily, but its own README states the upstream Football.TXT datasets
  are not automatically updated. It is not a dependable daily-result SLA.
- football-data.org can raise clean current coverage to 10/50 and is the only verified free delayed
  result source for those ten. It requires an owner-provided token and a separate approved TDD slice.
- Free match detail coverage is 0/50. Detail remains unavailable until a lawful source is approved.
- The 25 unsupported competitions have no verified mapping in the accepted free sources. Reaching
  50/50 requires reducing scope, accepting scraping/contract risk, or buying broader coverage.
