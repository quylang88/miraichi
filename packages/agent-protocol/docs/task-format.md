# Task Data Format

Data layout schemas for agent task specifications.

## Purpose
Enforces details required when delegating coding, testing, or research items to subagents.

## Status
- **Status**: Draft

## Scope
Format details of task payloads.

## Task Format Schema
- `taskId`: Unique ID
- `goal`: Clear definition of what the task must accomplish
- `context`: Background information and file references
- `constraints`: Specific rules and limitations (e.g. "Do not add dependencies")
- `verification`: Instructions for validating the output

## TODO / Next Steps
- [ ] Export validation schemas.
