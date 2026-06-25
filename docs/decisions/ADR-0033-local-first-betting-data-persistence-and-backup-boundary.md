# ADR-0033: Local-First Betting Data Persistence and Backup Boundary

* **Status**: Accepted
* **Date**: 2026-06-24
* **Accepted Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved
* **Implementation Status**: Not started

---

## 1. Context
PWA web clients need durable storage for local wagers. Relying strictly on session storage or raw RAM objects results in data loss on reload, while setting up cloud backends in early phases adds database costs, hosting limits, and login friction.

## 2. Owner-Approved Business Decisions
* **Local-First Focus**: Storing the betting history must run entirely within the user's local browser context in version 1 (v1).
* **Backup/Recovery**: An "Export JSON" and "Import JSON" backup tool is required to allow users to save their data locally and transfer it between devices.
* **IndexedDB for History**: IndexedDB is the preferred local storage technology for future implementation planning, providing robust capacities for structured objects.
* **LocalStorage Limitations**: LocalStorage may only be used to store tiny temporary configurations (e.g. user theme preferences, default odds format selections) or basic mock dashboard demo states. Under no circumstances may localStorage serve as the persistence engine for the user's real betting history (due to size limits and OS eviction risks).
* **Deferred Systems**: The following components are out-of-scope for v1 and deferred:
  - Cloud synchronization servers
  - User authentication and authorization (Auth)
  - Production databases (e.g. PostgreSQL, MongoDB, Redis)
  - Account and session management engines
* **No Database Configuration**: No database package client imports, ORM library setups, table migrations, or schema definitions may be created in this phase.

## 3. AI Technical Recommendations
* **Persistence Isolation**: Wrap all database operations inside a generic persistence adapter interface. The application code must interact with wagers via this interface, keeping UI files decoupled from storage implementations.
* **Versioned Backups**: Design the export JSON file to wrap wagers inside a versioned envelope containing schema version headers and timestamps, preventing import parsing failures.
* **Replaceable Adapter**: Ensure the storage adapter can be swapped out later (e.g., swapping a local IndexedDB adapter for a remote REST API adapter) without changing calling service code.

## 4. Deferred Business Decisions
* The detailed timelines for adding IndexedDB storage.
* The specific JSON backup schema structure.
* The selection of remote database engines or cloud sync triggers.
* The choice of authentication providers (e.g., OAuth, Auth0, custom).

## 5. Future Extension Points
* An IndexedDB storage adapter class.
* A remote syncing adapter.
* Multi-device synchronization.
* Local backup encryption keys.
* Conflict resolution merge screens for imports.

## 6. Explicit Implementation Exclusions
* No storage write or read execution code.
* No database packages or ORMs (Sequelize, TypeORM, Prisma).
* No table migration scripts.
* No authorization or signup logic.
* No cloud synchronization services.
* No executable code implementation.

## Acceptance Notes

This ADR is accepted as an architecture and planning boundary.

This ADR accepts the local-first persistence and backup boundary only. It does not authorize implementation by itself, and it does not authorize IndexedDB implementation, export/import code, cloud sync, auth, database clients, ORM libraries, schema files, migrations, integrations, formulas, or algorithms.

Implementation requires a later owner-approved implementation plan. Business logic, formulas, algorithms, storage implementation, and integrations remain blocked unless explicitly approved by later ADRs or implementation plans.
