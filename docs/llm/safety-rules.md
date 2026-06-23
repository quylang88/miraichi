# LLM Safety & Alignment Rules

Safety policies to prevent abuse and malicious prompts injection.

## Purpose
Secures LLM endpoints against prompt injection attacks.

## Status
- **Status**: Draft

## Scope
Directly plans input validation middleware and system instructions.

## Safety Guidelines
- Sanitize user strings to remove system command characters.
- Implement strict limits on output tokens length to prevent infinite loops.

## TODO / Next Steps
- [ ] Configure automatic tests checking prompt injection resilience.
