# LLM and Local AI Boundary

## Purpose
Clarify the planned boundary between Miraichi's conversational LLM layer and the structured local AI engine.

## Status
- **Status**: Closed
- **Phase**: Phase 1 - Architecture Planning
- **Date**: 2026-06-23

## Scope
This document defines planning principles only. It does not select an LLM provider, model runtime, prompt format, local AI framework, prediction algorithm, API contract, or confidence schema.

## Boundary Principle
The LLM layer should make Miraichi easier to use and understand. The local AI layer should produce structured football analysis and prediction candidates. The LLM may explain available outputs, but it must not invent predictions or imply that a prediction exists before local AI has produced one.

## LLM Responsibilities
- Understand user intent and route requests through approved application boundaries.
- Explain available predictions, uncertainty, and trace information in human-readable language.
- Ask for clarification when user requests are ambiguous.
- Refuse or defer prediction requests when local AI output is unavailable.
- Summarize historical context or responsible-use guidance only from available data and approved content.

## Local AI Responsibilities
- Consume validated, normalized football data.
- Generate structured prediction candidates when required inputs are available.
- Return traceable output that can be reviewed by users, agents, or later quality checks.
- Represent uncertainty in a way that can later become human-readable confidence language.
- Separate analysis output from user conversation and presentation.

## Prediction Availability Rule
If local AI has not produced a prediction for a requested match, market, or context, the LLM must say that no prediction is available yet. It may explain what data or processing is missing, but it must not fill the gap with a guessed prediction, betting suggestion, or implied confidence.

## Traceability Expectations
Future local AI outputs should be explainable enough for review. The exact shape is undecided, but later decisions should consider:
- Input data references.
- Analysis timestamp or freshness signal.
- Prediction target and market context.
- Human-readable uncertainty notes.
- Limitations or data-quality warnings.

## Open Questions
- What minimum evidence must local AI provide before the LLM can explain a prediction?
- How should uncertainty be represented before a final confidence format exists?
- What user-facing wording should distinguish unavailable predictions from low-confidence predictions?
- Which chat interactions should be stored for audit or user continuity?
