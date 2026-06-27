/**
 * Ingestion Run Contract Object Schema.
 * Fully competition-agnostic. No business logic.
 */
export const INGESTION_RUN_CONTRACT = {
  id: "string",         // Unique run tracker ID (e.g. run-alpha-001)
  providerId: "string", // Source provider ID (e.g. provider-mock-alpha)
  status: "string",     // success, partial_failure, failed
  startTime: "string",  // ISO-8601 UTC timestamp
  endTime: "string",    // ISO-8601 UTC timestamp
  metrics: {
    processedCount: "number",
    successCount: "number",
    skippedCount: "number"
  },
  errorMessage: "string" // optional log (required if status is failed)
};
Object.freeze(INGESTION_RUN_CONTRACT);
Object.freeze(INGESTION_RUN_CONTRACT.metrics);
