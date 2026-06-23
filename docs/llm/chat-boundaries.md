# Chat Boundaries

Topic exclusions and safety limits for conversational features.

## Purpose
Ensures the chat assistant does not answer non-sports questions or provide unauthorized financial advice.

## Status
- **Status**: Draft

## Scope
Directly configures system prompt constraints and validation filters.

## Chat Guidelines
- The model must reject queries regarding non-sports topics (e.g. politics, stocks).
- The model must not state "This match is guaranteed to win". It must display probability ratios.

## TODO / Next Steps
- [ ] Implement system validation regex filters.
