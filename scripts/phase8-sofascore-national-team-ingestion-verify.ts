import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  type SofascoreDiscoveryClient,
  type SofascoreDiscoveryRegistry,
  type SofascoreEvent,
  type SofascoreRound,
  type SofascoreSeason
} from '../apps/local-ai/src/data/sofascore-national-team-discovery.js';

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function createFixtureIngestionClient(): SofascoreDiscoveryClient {
  return {
    async fetchSeasons() {
      return [
        { name: 'Fixture Cup 2024', year: '2024', seasonId: 8000 },
        { name: 'Fixture Cup 2023', year: '2023', seasonId: 7000 }
      ];
    },
    async fetchRounds() {
      return [{ round: 1, name: 'Group stage' }];
    },
    async fetchEventsForRound() {
      return [
        {
          eventId: 11761871,
          startTimestamp: 1705176000,
          statusCode: 100,
          homeTeamName: 'Cote d Ivoire',
          awayTeamName: 'Guinea-Bissau',
          homeScore: 2,
          awayScore: 0,
          cornersHome: 6,
          cornersAway: 2,
          yellowHome: 2,
          yellowAway: 1,
          redHome: 0,
          redAway: 0,
          goalsHome: '4,30',
          goalsAway: ''
        }
      ];
    }
  };
}

function pythonExecutable(rootDir: string): string {
  return process.platform === 'win32'
    ? path.join(rootDir, 'apps/local-ai/.venv/Scripts/python.exe')
    : path.join(rootDir, 'apps/local-ai/.venv/bin/python');
}

function runPythonJson<T>(rootDir: string, script: string): T {
  const python = pythonExecutable(rootDir);
  const result = spawnSync(python, ['-c', script], {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10
  });

  if (result.status !== 0) {
    throw new Error(`Sofascore Python probe failed: ${result.stderr || result.stdout}`);
  }

  const lines = result.stdout.trim().split('\n');
  const lastLine = lines[lines.length - 1];
  try {
    return JSON.parse(lastLine) as T;
  } catch (err) {
    throw new Error(`Failed to parse JSON from Python output. Last line: "${lastLine}". Full output:\n${result.stdout}`);
  }
}

export function createPythonSofascoreIngestionClient(rootDir: string): SofascoreDiscoveryClient {
  return {
    async fetchSeasons(tournamentId: number): Promise<SofascoreSeason[]> {
      return runPythonJson<SofascoreSeason[]>(
        rootDir,
        `
import contextlib, io, json
from soccerdata._common import BaseRequestsReader
class Reader(BaseRequestsReader):
    pass
with contextlib.redirect_stdout(io.StringIO()):
    reader = Reader(no_cache=False, no_store=False)
    data = json.load(reader.get("https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/seasons"))
print(json.dumps([
    {"name": season.get("name", ""), "year": str(season.get("year", "")), "seasonId": season.get("id")}
    for season in data.get("seasons", [])
]))
`.trim()
      );
    },
    async fetchRounds(tournamentId: number, seasonId: number): Promise<SofascoreRound[]> {
      return runPythonJson<SofascoreRound[]>(
        rootDir,
        `
import contextlib, io, json
from soccerdata._common import BaseRequestsReader
class Reader(BaseRequestsReader):
    pass
with contextlib.redirect_stdout(io.StringIO()):
    reader = Reader(no_cache=False, no_store=False)
    data = json.load(reader.get("https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/rounds"))
print(json.dumps([
    {"round": item.get("round"), "name": item.get("name")}
    for item in data.get("rounds", [])
]))
`.trim()
      );
    },
    async fetchEventsForRound(tournamentId: number, seasonId: number, round: number): Promise<SofascoreEvent[]> {
      return runPythonJson<SofascoreEvent[]>(
        rootDir,
        `
import contextlib, io, json
from soccerdata._common import BaseRequestsReader
class Reader(BaseRequestsReader):
    pass
with contextlib.redirect_stdout(io.StringIO()):
    reader = Reader(no_cache=False, no_store=False)
    data = json.load(reader.get("https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/events/round/${round}"))
events = []
for event in data.get("events", []):
    event_id = event.get("id")
    corners_home = None
    corners_away = None
    yellow_home = None
    yellow_away = None
    red_home = None
    red_away = None
    
    try:
        stats_data = json.load(reader.get(f"https://api.sofascore.com/api/v1/event/{event_id}/statistics"))
        for period in stats_data.get("statistics", []):
            if period.get("period") == "ALL":
                for group in period.get("groups", []):
                    if group.get("groupName") == "Match overview":
                        for item in group.get("statisticsItems", []):
                            if item.get("name") == "Corner kicks":
                                corners_home = int(item.get("homeValue", 0))
                                corners_away = int(item.get("awayValue", 0))
                            elif item.get("name") == "Yellow cards":
                                yellow_home = int(item.get("homeValue", 0))
                                yellow_away = int(item.get("awayValue", 0))
                            elif item.get("name") == "Red cards":
                                red_home = int(item.get("homeValue", 0))
                                red_away = int(item.get("awayValue", 0))
    except Exception:
        pass

    goals_home = []
    goals_away = []
    try:
        incidents_data = json.load(reader.get(f"https://api.sofascore.com/api/v1/event/{event_id}/incidents"))
        for inc in incidents_data.get("incidents", []):
            if inc.get("incidentType") == "goal":
                time_str = str(inc.get("time"))
                if inc.get("addedTime"):
                    time_str += f"+{inc.get('addedTime')}"
                if inc.get("isHome"):
                    goals_home.append(time_str)
                else:
                    goals_away.append(time_str)
    except Exception:
        pass

    goals_home.reverse()
    goals_away.reverse()

    events.append({
        "eventId": event_id,
        "startTimestamp": event.get("startTimestamp"),
        "statusCode": event.get("status", {}).get("code"),
        "homeTeamName": event.get("homeTeam", {}).get("name", ""),
        "awayTeamName": event.get("awayTeam", {}).get("name", ""),
        "homeScore": event.get("homeScore", {}).get("current"),
        "awayScore": event.get("awayScore", {}).get("current"),
        "cornersHome": corners_home,
        "cornersAway": corners_away,
        "yellowHome": yellow_home,
        "yellowAway": yellow_away,
        "redHome": red_home,
        "redAway": red_away,
        "goalsHome": ",".join(goals_home) if goals_home else "",
        "goalsAway": ",".join(goals_away) if goals_away else ""
    })
print(json.dumps(events))
`.trim()
      );
    }
  };
}

function latestYearFromSeasonYear(year: string): number | null {
  const matches = year.match(/\d{2,4}/g);
  if (!matches || matches.length === 0) return null;
  const parsedYears = matches.map((value) => {
    const numeric = Number(value);
    if (value.length === 2) return 2000 + numeric;
    return numeric;
  });
  return Math.max(...parsedYears);
}

function isFutureSeason(season: SofascoreSeason, now: Date): boolean {
  const latestYear = latestYearFromSeasonYear(season.year);
  if (latestYear === null) return false;
  return latestYear > now.getUTCFullYear();
}

function extractSeasonYear(yearStr: string): number {
  const latestYear = latestYearFromSeasonYear(yearStr);
  return latestYear ?? new Date().getFullYear();
}

type IngestResult = {
  success: boolean;
  writtenCompetitions: string[];
};

export async function ingestSofascoreNationalTeamData(
  rootDir: string,
  client: SofascoreDiscoveryClient,
  options: { skipBuildDataset?: boolean; now?: Date } = {}
): Promise<IngestResult> {
  const now = options.now ?? new Date();
  const registryPath = path.join(rootDir, 'apps/local-ai/config/sofascore-national-team-discovery.json');
  const registry = readJson<SofascoreDiscoveryRegistry>(registryPath);
  const writtenCompetitions: string[] = [];

  for (const competition of registry.competitions) {
    console.log(`[Ingestion] Ingesting ${competition.competitionId} (Sofascore Unique Tournament: ${competition.sofascoreUniqueTournamentId})...`);
    
    try {
      const seasons = await client.fetchSeasons(competition.sofascoreUniqueTournamentId);
      
      let registryConfigPath = path.join(rootDir, 'apps/local-ai/config/competition-registry.json');
      if (!fs.existsSync(registryConfigPath)) {
        registryConfigPath = path.join(process.cwd(), 'apps/local-ai/config/competition-registry.json');
      }
      const registryConfig = readJson<{ competitions: { competition_id: string; seasons: number[] }[] }>(registryConfigPath);
      const compConfig = registryConfig.competitions.find(c => c.competition_id === competition.competitionId);
      const allowedSeasons = compConfig ? new Set(compConfig.seasons) : null;

      const completedSeasons = seasons.filter((season) => {
        if (isFutureSeason(season, now)) return false;
        if (allowedSeasons) {
          const year = extractSeasonYear(season.year);
          return allowedSeasons.has(year);
        }
        return true;
      });
      
      const allEvents: { event: SofascoreEvent; seasonYear: number; roundName: string }[] = [];

      for (const season of completedSeasons) {
        const seasonYear = extractSeasonYear(season.year);
        try {
          const rounds = await client.fetchRounds(competition.sofascoreUniqueTournamentId, season.seasonId);
          for (const round of rounds) {
            const roundName = round.name || `Round ${round.round}`;
            try {
              const events = await client.fetchEventsForRound(
                competition.sofascoreUniqueTournamentId,
                season.seasonId,
                round.round
              );
              for (const event of events) {
                allEvents.push({ event, seasonYear, roundName });
              }
            } catch (roundError) {
              console.warn(`[Ingestion] Warning: Failed to fetch events for ${competition.competitionId} season ${season.name} round ${round.round}: ${roundError}`);
            }
          }
        } catch (roundsError) {
          console.warn(`[Ingestion] Warning: Failed to fetch rounds for ${competition.competitionId} season ${season.name}: ${roundsError}`);
        }
      }

      if (allEvents.length === 0) {
        console.warn(`[Ingestion] Warning: No events found for ${competition.competitionId}. Skipping CSV write.`);
        continue;
      }

      // Write raw CSV file
      const rawCsvDir = path.join(rootDir, 'apps/local-ai/data/raw');
      fs.mkdirSync(rawCsvDir, { recursive: true });
      const csvPath = path.join(rawCsvDir, `${competition.competitionId}_schedule.csv`);
      
      let csvContent = 'game_id,date,season,time,home_team,away_team,home_score,away_score,venue,round,corners_home,corners_away,yellow_cards_home,yellow_cards_away,red_cards_home,red_cards_away,goal_minutes_home,goal_minutes_away\n';
      
      for (const { event, seasonYear, roundName } of allEvents) {
        const dateObj = new Date(event.startTimestamp * 1000);
        const dateStr = dateObj.toISOString().split('T')[0];
        const hours = String(dateObj.getUTCHours()).padStart(2, '0');
        const minutes = String(dateObj.getUTCMinutes()).padStart(2, '0');
        const timeStr = `${hours}:${minutes}`;
        const homeScoreStr = event.homeScore !== null && event.homeScore !== undefined ? String(event.homeScore) : '';
        const awayScoreStr = event.awayScore !== null && event.awayScore !== undefined ? String(event.awayScore) : '';
        
        const escape = (str: string) => {
          if (!str) return '';
          return str.includes(',') ? `"${str}"` : str;
        };
        
        const cHome = event.cornersHome !== null && event.cornersHome !== undefined ? String(event.cornersHome) : '';
        const cAway = event.cornersAway !== null && event.cornersAway !== undefined ? String(event.cornersAway) : '';
        const yHome = event.yellowHome !== null && event.yellowHome !== undefined ? String(event.yellowHome) : '';
        const yAway = event.yellowAway !== null && event.yellowAway !== undefined ? String(event.yellowAway) : '';
        const rHome = event.redHome !== null && event.redHome !== undefined ? String(event.redHome) : '';
        const rAway = event.redAway !== null && event.redAway !== undefined ? String(event.redAway) : '';
        const gHome = event.goalsHome || '';
        const gAway = event.goalsAway || '';
        
        csvContent += `${event.eventId},${dateStr},${seasonYear},${timeStr},${escape(event.homeTeamName)},${escape(event.awayTeamName)},${homeScoreStr},${awayScoreStr},,${escape(roundName)},${cHome},${cAway},${yHome},${yAway},${rHome},${rAway},${escape(gHome)},${escape(gAway)}\n`;
      }

      fs.writeFileSync(csvPath, csvContent, 'utf8');
      console.log(`[Ingestion] Successfully wrote ${allEvents.length} events to ${csvPath}`);
      writtenCompetitions.push(competition.competitionId);

    } catch (err) {
      console.error(`[Ingestion] Error: Failed to ingest ${competition.competitionId}: ${err}`);
    }
  }

  if (writtenCompetitions.length === 0) {
    return { success: false, writtenCompetitions };
  }

  if (!options.skipBuildDataset) {
    console.log('[Ingestion] Rebuilding dataset splits via build_national_team_datasets.py...');
    const python = pythonExecutable(rootDir);
    const result = spawnSync(python, ['-m', 'scripts.build_national_team_datasets'], {
      cwd: path.join(rootDir, 'apps/local-ai'),
      encoding: 'utf8'
    });

    if (result.status !== 0) {
      throw new Error(`Dataset splits rebuild failed: ${result.stderr || result.stdout}`);
    }
    console.log(result.stdout);
  }

  return { success: true, writtenCompetitions };
}

export async function main() {
  const rootDir = process.cwd();
  const client = createPythonSofascoreIngestionClient(rootDir);
  const result = await ingestSofascoreNationalTeamData(rootDir, client);

  if (!result.success) {
    console.error('[Ingestion] Ingestion failed. No raw CSV files written.');
    process.exit(1);
  }

  console.log('[Ingestion] Ingestion PASSED and splits rebuilt.');
}

const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
  process.argv[1].endsWith('phase8-sofascore-national-team-ingestion-verify.ts') ||
  process.argv[1].endsWith('phase8-sofascore-national-team-ingestion-verify.js') ||
  process.argv[1].endsWith('phase8-sofascore-national-team-ingestion-verify')
);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
