import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildOddsBaselineDiscoveryReport,
  buildSofascoreDiscoveryReport,
  generateSofascoreDiscoveryMarkdown,
  type SofascoreDiscoveryClient,
  type SofascoreDiscoveryRegistry,
  type SofascoreEvent,
  type SofascoreRound,
  type SofascoreSeason
} from '../apps/local-ai/src/data/sofascore-national-team-discovery.js';

type Phase86BArtifacts = {
  discoveryReport: Awaited<ReturnType<typeof buildSofascoreDiscoveryReport>>;
  oddsReport: ReturnType<typeof buildOddsBaselineDiscoveryReport>;
  markdown: string;
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function createFixtureDiscoveryClient(): SofascoreDiscoveryClient {
  return {
    async fetchSeasons() {
      return [
        { name: 'Fixture Cup 2027', year: '2027', seasonId: 9000 },
        { name: 'Fixture Cup 2024', year: '2024', seasonId: 8000 },
        { name: 'Fixture Cup 2021', year: '2021', seasonId: 7000 }
      ];
    },
    async fetchRounds() {
      return [{ round: 1 }];
    },
    async fetchEventsForRound() {
      return [
        {
          eventId: 1,
          startTimestamp: 1718928000,
          statusCode: 100,
          homeTeamName: 'Team A',
          awayTeamName: 'Team B',
          homeScore: 2,
          awayScore: 1
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


export function createPythonSofascoreDiscoveryClient(rootDir: string): SofascoreDiscoveryClient {
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
    reader = Reader(no_cache=True, no_store=True)
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
    reader = Reader(no_cache=True, no_store=True)
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
    reader = Reader(no_cache=True, no_store=True)
    data = json.load(reader.get("https://api.sofascore.com/api/v1/unique-tournament/${tournamentId}/season/${seasonId}/events/round/${round}"))
events = []
for event in data.get("events", []):
    events.append({
        "eventId": event.get("id"),
        "startTimestamp": event.get("startTimestamp"),
        "statusCode": event.get("status", {}).get("code"),
        "homeTeamName": event.get("homeTeam", {}).get("name", ""),
        "awayTeamName": event.get("awayTeam", {}).get("name", ""),
        "homeScore": event.get("homeScore", {}).get("current"),
        "awayScore": event.get("awayScore", {}).get("current")
    })
print(json.dumps(events))
`.trim()
      );
    }
  };
}

export async function generatePhase86BReports(
  rootDir: string,
  client: SofascoreDiscoveryClient = createPythonSofascoreDiscoveryClient(rootDir)
): Promise<Phase86BArtifacts> {
  const registryPath = path.join(rootDir, 'apps/local-ai/config/sofascore-national-team-discovery.json');
  const discoveryReportPath = path.join(rootDir, 'apps/local-ai/reports/phase-8-6b-sofascore-national-team-source-discovery.json');
  const oddsReportPath = path.join(rootDir, 'apps/local-ai/reports/phase-8-6b-odds-baseline-source-discovery.json');
  const docsPath = path.join(rootDir, 'docs/data/PHASE-8-6B-SOFASCORE-NATIONAL-TEAM-SOURCE-DISCOVERY.md');

  const registry = readJson<SofascoreDiscoveryRegistry>(registryPath);
  const discoveryReport = await buildSofascoreDiscoveryReport(registry, client);
  const oddsReport = buildOddsBaselineDiscoveryReport({ generatedAt: discoveryReport.generatedAt });
  const markdown = generateSofascoreDiscoveryMarkdown(discoveryReport, oddsReport);

  writeJson(discoveryReportPath, discoveryReport);
  writeJson(oddsReportPath, oddsReport);
  fs.mkdirSync(path.dirname(docsPath), { recursive: true });
  fs.writeFileSync(docsPath, markdown, 'utf8');

  return { discoveryReport, oddsReport, markdown };
}

export async function main() {
  const rootDir = process.cwd();
  const result = await generatePhase86BReports(rootDir);

  if (result.discoveryReport.status !== 'pass') {
    console.error('[Phase 8.6B] BLOCKED. No usable Sofascore national-team discovery evidence was produced.');
    process.exit(1);
  }

  console.log('[Phase 8.6B] PASSED. Report: apps/local-ai/reports/phase-8-6b-sofascore-national-team-source-discovery.json');
}

const isMain = process.argv[1] && (
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)) ||
  process.argv[1].endsWith('phase8-sofascore-national-team-discovery-verify.ts') ||
  process.argv[1].endsWith('phase8-sofascore-national-team-discovery-verify.js') ||
  process.argv[1].endsWith('phase8-sofascore-national-team-discovery-verify')
);

if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
