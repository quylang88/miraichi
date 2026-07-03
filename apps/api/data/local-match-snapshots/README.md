# Local Match Snapshots

This directory contains the local, offline JSON match snapshots used by the Miraichi Phase 9 application instead of a live third-party API-Football provider.

## Usage

1. Edit the seed file to add or modify matches:
   - Path: `apps/api/data/local-match-snapshots/national-team-matches.seed.json`
2. Run the update command to validate, normalize, and regenerate the active snapshot file:
   ```bash
   pnpm run data:update:national-teams
   ```
3. The active snapshot is generated at:
   - Path: `apps/api/data/local-match-snapshots/national-team-matches.json`

## Scope

- **National teams only**: Primary focus is national-team competitions (World Cup, UEFA Euro, Copa America, AFCON, AFC Asian Cup, CONCACAF Gold Cup, UEFA Nations League).
- **No live data**: Status fields exclude live/in-play states. Completed matches must have home and away scores specified.
- **No public prediction runtime**: The snapshot provides fixture context without exposing automated prediction metadata.
- **App-light match model**: The app snapshot is intentionally small: fixture identity, kickoff time, status, teams, competition, season, score, source refs, and freshness metadata. It is for selecting a match, opening a bet draft, and doing quick history review.
- **Rich provider data stays outside the app contract**: events, cards, corners, xG, odds, squads, standings, match facts, and provider-specific details must remain in raw provider cache or provider-neutral warehouse artifacts until a later normalization/training phase explicitly promotes them. Do not add those fields to the app snapshot just because Sportmonks returned them.

## Sportmonks Trial Capture Direction

Sportmonks is a removable trial adapter, not an app runtime dependency. During the trial:

1. Capture broad raw payloads under `apps/api/data/providers/sportmonks/`.
2. Capture season-scoped schedules, teams, and standings from known fixture `season_id` values.
3. Normalize only the minimal match summary needed by the app into the local snapshot.
4. Keep richer training candidates in raw/warehouse storage with provenance.

The app must continue to work from this snapshot even if `scripts/providers/sportmonks/` is deleted after the trial.
