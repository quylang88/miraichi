/**
 * Memory Ingestion Repository for transient in-memory storage.
 * Fully competition-agnostic. No business logic.
 */
import type { IngestionRun, NormalizedMarket, NormalizedMatch } from '../../../../packages/shared/src/contracts/index.js';

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

class MemoryIngestionRepository {
  private matches = new Map<string, NormalizedMatch>();
  private markets = new Map<string, NormalizedMarket>();
  private runs: IngestionRun[] = [];

  saveMatch(match: NormalizedMatch): void {
    this.matches.set(match.id, cloneValue(match));
  }

  saveMarket(market: NormalizedMarket): void {
    this.markets.set(market.id, cloneValue(market));
  }

  saveRun(run: IngestionRun): void {
    this.runs.push(cloneValue(run));
  }

  getMatch(id: string): NormalizedMatch | undefined {
    return this.matches.get(id);
  }

  getMarket(id: string): NormalizedMarket | undefined {
    return this.markets.get(id);
  }

  listMatches(): NormalizedMatch[] {
    return Array.from(this.matches.values());
  }

  listMarkets(): NormalizedMarket[] {
    return Array.from(this.markets.values());
  }

  listRuns(): IngestionRun[] {
    return [...this.runs];
  }

  clear(): void {
    this.matches.clear();
    this.markets.clear();
    this.runs = [];
  }
}

export const memoryIngestionRepository = new MemoryIngestionRepository();
export default memoryIngestionRepository;
