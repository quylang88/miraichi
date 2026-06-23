import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Executes a simulated ingestion cron job.
 * Reads local mock fixtures and prints parsed data to logs.
 */
export function runIngestionJob() {
  console.log(`[Worker Ingestion Job] Tick: Starting ingestion runner at ${new Date().toISOString()}...`);

  try {
    const fixturePath = path.resolve(__dirname, '../fixtures/generic-matches.mock.json');
    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Mock fixture not found at path: ${fixturePath}`);
    }

    const fileContent = fs.readFileSync(fixturePath, 'utf8');
    const feed = JSON.parse(fileContent);

    console.log(`[Worker Ingestion Job] Feed timestamp: ${feed.feedTimestamp}`);
    console.log(`[Worker Ingestion Job] Ingesting ${feed.data.length} matches:`);
    
    feed.data.forEach(fixture => {
      console.log(`  * Ingested ID: ${fixture.provider_fixture_id} | ${fixture.competitor_1} vs ${fixture.competitor_2} [${fixture.league_generic_name}]`);
    });

    console.log(`[Worker Ingestion Job] Ingestion transaction complete.`);
  } catch (err) {
    console.error(`[Worker Ingestion Job] Ingestion failed: ${err.message}`);
  }
}
