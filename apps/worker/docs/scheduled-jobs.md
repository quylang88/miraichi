# Scheduled Jobs

The current worker runs only the mock ingestion scaffold in local development. No live website polling schedule is approved.

Future scheduling must be source-aware, rate-limited, idempotent, and safe to resume. It must publish freshness and failure status without inventing match data.
