/**
 * Memory Ingestion Repository for transient in-memory storage.
 * Fully competition-agnostic. No business logic.
 */
class MemoryIngestionRepository {
  constructor() {
    this.matches = new Map();
    this.markets = new Map();
    this.runs = [];
  }

  saveMatch(match) {
    this.matches.set(match.id, JSON.parse(JSON.stringify(match)));
  }

  saveMarket(market) {
    this.markets.set(market.id, JSON.parse(JSON.stringify(market)));
  }

  saveRun(run) {
    this.runs.push(JSON.parse(JSON.stringify(run)));
  }

  getMatch(id) {
    return this.matches.get(id);
  }

  getMarket(id) {
    return this.markets.get(id);
  }

  listMatches() {
    return Array.from(this.matches.values());
  }

  listMarkets() {
    return Array.from(this.markets.values());
  }

  listRuns() {
    return [...this.runs];
  }

  clear() {
    this.matches.clear();
    this.markets.clear();
    this.runs = [];
  }
}

export const memoryIngestionRepository = new MemoryIngestionRepository();
export default memoryIngestionRepository;
