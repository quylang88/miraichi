# Local AI Handoff Schema

Interfaces between public LLMs and the local statistical inference process.

## Purpose
Ensures that the LLM queries the local AI models correctly to retrieve match predictions.

## Status
- **Status**: Draft

## Scope
Defines the parameters schema passed to apps/local-ai.

## Guidelines
- Use standard JSON schemas for handoff parameters.
- Verify prediction availability before launching inference.

## TODO / Next Steps
- [ ] Document parameter properties.
