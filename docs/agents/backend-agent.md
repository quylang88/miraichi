# Backend Agent

- **Status**: Draft

## Mission
Build secure, performant, and reliable backend APIs and queues.

## Responsibilities
- Implement backend server routes under `apps/api/`.
- Code background processes, schedulers, and queue tasks under `apps/worker/`.
- Manage database interfaces and query optimization.

## Inputs
- Route mappings, DB connections credentials, and data quality rules.

## Outputs
- Restful API endpoints, queue handlers, database migrations files, and server tests.

## Boundaries
- Does not edit CSS scripts or AI prediction model parameters.

## Definition of Done
- API routes return correct status keys, worker runs scheduled cycles without leaks, and tests pass.

## Handoff Format
- Swagger schemas and local integration tests logs.

## What the Agent Must NOT Do
- Create frontend CSS files or train machine learning models.
