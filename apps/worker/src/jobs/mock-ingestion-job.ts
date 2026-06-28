import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { IngestionRun } from '../../../../packages/shared/src/contracts/index.js';
import { MockProviderAdapter } from '../adapters/mock-provider-adapter.js';
import { validateMatch, validateMarket } from '../validators/ingestion-validator.js';
import { memoryIngestionRepository } from '../repositories/memory-ingestion-repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMockIngestionJob() {
  const startTime = new Date().toISOString();
  const runId = `run-${Math.random().toString(36).substr(2, 9)}`;
  const adapter = new MockProviderAdapter();
  const providerId = adapter.providerId;

  let processedCount = 0;
  let successCount = 0;
  let skippedCount = 0;

  console.log(`[Ingestion Job] Starting mock ingestion run ${runId} for provider ${providerId}...`);

  try {
    const fixturesPath = path.join(__dirname, '../fixtures/provider-mock-alpha-fixtures.json');
    const marketsPath = path.join(__dirname, '../fixtures/provider-mock-alpha-markets.json');

    // 1. Read Raw Mock Files
    const rawMatchesData = await fs.readFile(fixturesPath, 'utf-8');
    const rawMarketsData = await fs.readFile(marketsPath, 'utf-8');

    const rawMatches = JSON.parse(rawMatchesData);
    const rawMarkets = JSON.parse(rawMarketsData);

    // 2. Adapter Normalization mapping
    const normalizedMatches = adapter.parseMatches(rawMatches);
    const normalizedMarkets = adapter.parseMarkets(rawMarkets);

    // 3. Process & Validate Matches
    for (const match of normalizedMatches) {
      processedCount++;

      const validation = validateMatch(match);
      if (validation.valid) {
        memoryIngestionRepository.saveMatch(match);
        successCount++;
      } else {
        console.warn(`[Ingestion Job] Validation failed for match ${match.id || 'unknown'}:`, validation.errors);
        skippedCount++;
      }
    }

    // 4. Process & Validate Markets
    for (const market of normalizedMarkets) {
      processedCount++;

      const validation = validateMarket(market);
      if (validation.valid) {
        memoryIngestionRepository.saveMarket(market);
        successCount++;
      } else {
        console.warn(`[Ingestion Job] Validation failed for market ${market.id || 'unknown'}:`, validation.errors);
        skippedCount++;
      }
    }

    // 5. Ingestion Run Status Summary
    const endTime = new Date().toISOString();
    const runStatus: 'success' | 'partial_failure' = skippedCount > 0 ? 'partial_failure' : 'success';

    const runReport: IngestionRun = {
      id: runId,
      providerId,
      status: runStatus,
      startTime,
      endTime,
      metrics: {
        processedCount,
        successCount,
        skippedCount
      }
    };

    memoryIngestionRepository.saveRun(runReport);

    console.log(`[Ingestion Job] Completed run ${runId} successfully with status ${runStatus}. Metrics:`, runReport.metrics);

  } catch (error) {
    const endTime = new Date().toISOString();
    console.error(`[Ingestion Job] Critical failure in run ${runId}:`, error instanceof Error ? error.message : String(error));

    const runReport: IngestionRun = {
      id: runId,
      providerId,
      status: 'failed',
      startTime,
      endTime,
      metrics: {
        processedCount,
        successCount,
        skippedCount
      },
      errorMessage: error instanceof Error ? error.message : String(error)
    };

    memoryIngestionRepository.saveRun(runReport);
  }
}

export const runIngestionJob = runMockIngestionJob;

