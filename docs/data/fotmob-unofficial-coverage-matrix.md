# FotMob Unofficial Coverage Matrix

## Verified boundary

- Verification date: **2026-08-31**.
- Canonical target: 50 competitions in registry order.
- FotMob mapping evidence: `https://www.fotmob.com/api/data/allLeagues` and the exact season URL
  `https://www.fotmob.com/api/data/leagues?id={FotMob ID}&ccode3={CCODE}&season={provider season}`.
- ESPN mapping evidence: `https://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000`.
- Terms evidence: `https://www.fotmob.com/terms`, `https://www.fotmob.com/robots.txt`, and
  `https://disneytermsofuse.com/english/`.
- `supported` means the current provider edition was returned with stable fixture IDs and exact
  UTC kickoff fields. `partial` means the mapping exists but the current edition is staged,
  non-annual, split, or only partially published. ESPN is always disabled.

## Matrix

| # | Competition | Status | Cycle | FotMob ID / CCODE | Current provider season | ESPN disabled fallback |
|---:|---|---|---|---|---|---|
| 1 | `eng-premier-league` | supported | cross-year | `47` / `ENG` | `2026/2027` | `eng.1` |
| 2 | `esp-la-liga` | supported | cross-year | `87` / `ESP` | `2026/2027` | `esp.1` |
| 3 | `ita-serie-a` | supported | cross-year | `55` / `ITA` | `2026/2027` | `ita.1` |
| 4 | `ger-bundesliga` | supported | cross-year | `54` / `GER` | `2026/2027` | `ger.1` |
| 5 | `fra-ligue-1` | supported | cross-year | `53` / `FRA` | `2026/2027` | `fra.1` |
| 6 | `uefa-champions-league` | supported | cross-year | `42` / `INT` | `2026/2027` | `uefa.champions` |
| 7 | `uefa-europa-league` | supported | cross-year | `73` / `INT` | `2026/2027` | `uefa.europa` |
| 8 | `uefa-conference-league` | supported | cross-year | `10216` / `INT` | `2026/2027` | `uefa.europa.conf` |
| 9 | `uefa-super-cup` | partial | cross-year | `74` / `INT` | `2025/2026` (event 2026) | `uefa.super_cup` |
| 10 | `conmebol-copa-libertadores` | supported | calendar-year | `45` / `INT` | `2026` | `conmebol.libertadores` |
| 11 | `conmebol-copa-sudamericana` | supported | calendar-year | `299` / `INT` | `2026` | `conmebol.sudamericana` |
| 12 | `afc-champions-league-elite` | supported | cross-year | `525` / `INT` | `2026/2027` | `afc.champions` |
| 13 | `eng-championship` | supported | cross-year | `48` / `ENG` | `2026/2027` | `eng.2` |
| 14 | `esp-segunda-division` | supported | cross-year | `140` / `ESP` | `2026/2027` | `esp.2` |
| 15 | `ita-serie-b` | supported | cross-year | `86` / `ITA` | `2026/2027` | `ita.2` |
| 16 | `ger-2-bundesliga` | supported | cross-year | `146` / `GER` | `2026/2027` | `ger.2` |
| 17 | `fra-ligue-2` | supported | cross-year | `110` / `FRA` | `2026/2027` | `fra.2` |
| 18 | `ned-eredivisie` | supported | cross-year | `57` / `NED` | `2026/2027` | `ned.1` |
| 19 | `por-primeira-liga` | supported | cross-year | `61` / `POR` | `2026/2027` | `por.1` |
| 20 | `bel-pro-league` | supported | cross-year | `40` / `BEL` | `2026/2027` | `bel.1` |
| 21 | `sco-premiership` | supported | cross-year | `64` / `SCO` | `2026/2027` | `sco.1` |
| 22 | `tur-super-lig` | supported | cross-year | `71` / `TUR` | `2026/2027` | `tur.1` |
| 23 | `sui-super-league` | supported | cross-year | `69` / `SUI` | `2026/2027` | — |
| 24 | `aut-bundesliga` | supported | cross-year | `38` / `AUT` | `2026/2027` | `aut.1` |
| 25 | `den-superliga` | supported | cross-year | `46` / `DEN` | `2026/2027` | `den.1` |
| 26 | `gre-super-league-1` | supported | cross-year | `135` / `GRE` | `2026/2027` | `gre.1` |
| 27 | `swe-allsvenskan` | supported | calendar-year | `67` / `SWE` | `2026` | `swe.1` |
| 28 | `nor-eliteserien` | supported | calendar-year | `59` / `NOR` | `2026` | `nor.1` |
| 29 | `pol-ekstraklasa` | supported | cross-year | `196` / `POL` | `2026/2027` | — |
| 30 | `sau-pro-league` | supported | cross-year | `536` / `KSA` | `2026/2027` | `ksa.1` |
| 31 | `usa-mls` | supported | calendar-year | `130` / `USA` | `2026` | `usa.1` |
| 32 | `mex-liga-mx` | partial | cross-year | `230` / `MEX` | `2026/2027 - Apertura` | `mex.1` |
| 33 | `bra-serie-a` | supported | calendar-year | `268` / `BRA` | `2026` | `bra.1` |
| 34 | `arg-primera-division` | supported | calendar-year | `112` / `ARG` | `2026` | `arg.1` |
| 35 | `col-primera-a` | partial | calendar-year | `274` / `COL` | `2026 - Clausura` | `col.1` |
| 36 | `jpn-j1-league` | supported | cross-year | `223` / `JPN` | `2026/2027` | `jpn.1` |
| 37 | `kor-k-league-1` | supported | calendar-year | `9080` / `KOR` | `2026` | — |
| 38 | `aus-a-league` | supported | cross-year | `113` / `AUS` | `2026/2027` | `aus.1` |
| 39 | `chn-csl` | supported | calendar-year | `120` / `CHN` | `2026` | `chn.1` |
| 40 | `tha-league-1` | supported | cross-year | `8984` / `THA` | `2026/2027` | — |
| 41 | `vie-v-league-1` | supported | cross-year | `9088` / `VIE` | `2026/2027` | — |
| 42 | `fifa-club-world-cup` | partial | nonannual | `78` / `INT` | latest edition `2025` | `fifa.cwc` |
| 43 | `eng-fa-cup` | partial | cross-year | `132` / `ENG` | 2026/27 not published | `eng.fa` |
| 44 | `eng-efl-cup` | supported | cross-year | `133` / `ENG` | `2026/2027` | `eng.league_cup` |
| 45 | `esp-copa-del-rey` | partial | cross-year | `138` / `ESP` | 2026/27 not published | `esp.copa_del_rey` |
| 46 | `ger-dfb-pokal` | supported | cross-year | `209` / `GER` | `2026/2027` | `ger.dfb_pokal` |
| 47 | `ita-coppa-italia` | supported | cross-year | `141` / `ITA` | `2026/2027` | `ita.coppa_italia` |
| 48 | `fra-coupe-de-france` | partial | cross-year | `134` / `FRA` | 2026/27 not published | `fra.coupe_de_france` |
| 49 | `por-taca-de-portugal` | partial | cross-year | `186` / `POR` | `2026/2027`, early rounds only | `por.taca.portugal` |
| 50 | `ned-knvb-beker` | partial | cross-year | `235` / `NED` | 2026/27 not published | `ned.cup` |

## Honest coverage result

- Exact FotMob mappings: **50/50**.
- Provider-selected active editions observed: **45/50**.
- Strict current coverage: **41 supported, 9 partial, 0 unmapped**. Partial includes split
  stages, the one-off Super Cup, non-annual Club World Cup, early-round-only publication, and four
  not-yet-published cup editions.
- Daily result capability: one FotMob global date request per day, filtered to registry; terminal
  results only. This is operationally efficient but contract-risky.
- Match detail capability: 50 mapped competitions, lazy after FT, but field coverage is partial and
  nullable. It is not an SLA.

## Verified hydration result — 2026-08-31

- Current edition targets: **45/50 complete** and **5/50 not applicable/unpublished**. The five are
  Club World Cup (latest edition 2025), FA Cup, Copa del Rey, Coupe de France, and KNVB Beker.
- The guarded owner-local run made 48 FotMob season requests: 45 final successful targets, six
  transient adapter failures later recovered, and three factual selected-season mismatches that
  caused the unavailable cup editions to be removed from current execution. No request was made
  for KNVB after the earlier registry-order blocker; its unavailable current edition was already
  verified in the mapping research.
- Active serving data grew from 41 preserved matches to **10,899** canonical matches. Two in-play
  rows were ignored and never entered canonical/serving data.
- Historical execution remains deliberately narrow: only Club World Cup 2025 and the verified
  2025/26 editions of FA Cup, Copa del Rey, Coupe de France, and KNVB Beker are enabled. Past-season
  labels for the other 45 competitions are not enabled until each mapping is independently
  verified. Generic year conversion is not treated as evidence.
