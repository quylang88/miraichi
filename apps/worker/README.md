# Miraichi Worker

The worker is the server-side ingestion boundary. Its current adapter/job is mock scaffolding used by tests and Phase 3 verification; it is not a live data source.

The next source-selection phase must approve a website and crawler contract before live implementation. A future adapter must cache raw evidence, normalize into provider-neutral contracts, respect the configured competition allowlist, and publish through the canonical warehouse and serving-store builder.
