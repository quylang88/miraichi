# Agent Communication Schema

Channel layouts and protocol definitions for subagent messages.

## Purpose
Specifies JSON schemas and properties for message validation.

## Status
- **Status**: Draft

## Scope
Directly governs messages exchanged in packages/agent-protocol.

## Core Schema properties
- `id`: unique string key
- `sender`: agent identifier
- `recipient`: agent identifier
- `type`: `delegation` | `update` | `result` | `error`
- `timestamp`: RFC3339 string
- `payload`: custom object parameters

## TODO / Next Steps
- [ ] Implement validation functions.
