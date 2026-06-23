---
name: miraichi-agent-handoff
description: Coordinates agent-to-agent task delegation and transitions using structured handoff schemas.
metadata:
  project: Miraichi
  owner: quylang88
  version: "0.1.0"
---

# Agent Handoff Skill

## Purpose
Ensures seamless state tracking, error reporting, and task delegation during agent transitions.

## When to Use This Skill
Use this skill when handing off tasks, invoking specialist subagents, or requesting design reviews.

## Inputs
- Execution state, modified files, open questions, and next steps descriptions.

## Process
1. Evaluate if target task boundaries exceed current agent capabilities.
2. Compile current execution state, listing decisions and modified paths.
3. Construct handoff message according to the protocol in packages/agent-protocol.

## Output Format
- Standard JSON handoff payload or task state files.

## Rules
- Every task must have owner agent, input, output, scope, and Definition of Done.
- Every handoff must include current state, decisions made, files changed, open questions, and next action.
- Agents must not silently expand scope.
- Agents must ask for review when scope changes.

## What Not to Do
- Never hand off tasks without specifying the next immediate action and verification rules.

## Definition of Done
- Handoff payload is generated and verified by the receiving agent.
