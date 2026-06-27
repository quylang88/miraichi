import { runIngestionJob } from './jobs/mock-ingestion-job.js';

console.log(`[Worker Daemon] Starting periodic ingestion worker scheduler...`);

// Execute ingestion once immediately on startup
runIngestionJob();

// Trigger every 60 seconds (1 minute interval)
const INTERVAL_MS = 60000;
setInterval(() => {
  runIngestionJob();
}, INTERVAL_MS);
