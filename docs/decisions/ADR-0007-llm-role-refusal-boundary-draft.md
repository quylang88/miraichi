# ADR-0007: LLM Role and Refusal Behavior Boundary

## Status
- **Status**: Draft
- **Source candidate**: Candidate 005
- **Date**: 2026-06-23

## Context
Miraichi may use an LLM for conversation, explanation, routing, and user interaction. The LLM must not become the source of prediction truth or invent predictions when local AI has not produced a traceable output.

Chat persistence, chat retention, and chat privacy are intentionally out of scope for this ADR. Those decisions should be handled by a future storage/privacy ADR because they affect sensitive data handling and retention.

## Decision to Be Made
Decide the LLM's role and refusal behavior before implementation begins.

## Options Considered
- Use the LLM as orchestration and explanation layer only.
- Allow the LLM to act as a broader assistant that can provide unsupported guidance.
- Disable LLM chat until local AI output exists.
- Defer LLM role and refusal behavior until local AI implementation is complete.

## Draft Recommendation
Use the LLM as an orchestration and explanation layer only, with explicit refusal or deferral when local AI output is unavailable. Defer chat persistence, summarization, retention, and privacy choices to a future storage/privacy ADR.

## Consequences
- Reduces hallucination risk around predictions and betting-related guidance.
- Keeps structured local AI output as the prediction authority.
- May make early chat experiences more constrained until local AI outputs exist.
- Keeps chat storage and privacy choices out of this ADR so they can be reviewed with the broader data-retention boundary.

## Risks
- Users may expect conversational answers even when no structured prediction exists.
- Weak refusal wording can imply unsupported confidence or advice.
- If refusal rules are too strict, the LLM may under-explain valid available analysis.
- If chat persistence is not handled soon in a separate ADR, future chat work may lack retention guidance.

## Open Questions
- What exact user-facing wording should appear when no prediction is available?
- What evidence must the LLM cite before explaining a prediction?
- Which future ADR should decide whether chat content is persisted, summarized, or discarded?
- How should the LLM distinguish unavailable predictions from available but uncertain analysis?

## Owner Approval Required
Project owner approval is required before this ADR can become Accepted or authorize implementation planning.

## Implementation Status
- **Implementation status**: Not started
