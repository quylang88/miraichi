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
