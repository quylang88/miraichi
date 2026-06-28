/**
 * Mock Ingestion Status Route returning static tracking run metadata.
 * Fully competition-agnostic. No business logic.
 */
export function handleIngestionStatus(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: "active",
    providerId: "provider-mock-alpha",
    lastIngestedAt: new Date().toISOString(),
    runs: [
      {
        id: "run-mock-001",
        providerId: "provider-mock-alpha",
        status: "success",
        startTime: "2026-06-23T22:20:00Z",
        endTime: "2026-06-23T22:20:02Z",
        metrics: {
          processedCount: 4,
          successCount: 4,
          skippedCount: 0
        }
      }
    ]
  }));
}
