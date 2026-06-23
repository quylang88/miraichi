# Agent Protocol

Schemas and interfaces for subagent-to-subagent coordination.

## Purpose
Defines standard payload formats and messaging interfaces so agents can delegate, check status, and hand off tasks.

## Status
- **Status**: Draft

## Scope
Communication interfaces, message schemas, and handoff protocols.

## Protocol Guidelines
- All messages between agents must match the schemas defined in docs/task-format.md.
- Ensure security boundaries are checked during every agent-to-agent action.

## TODO / Next Steps
- [ ] Export standard message payload typescript interfaces.
