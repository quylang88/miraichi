# Task Creation Workflow

Procedures for organizing developer and agent tasks.

## Purpose
Establishes how goals are broken down and monitored.

## Status
- **Status**: Draft

## Scope
Governs task tracking and planning files.

## Workflow Rules
1. **Lifecycle Selection**: Every request must identify its phase from `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
2. **Goal Breakdown**: Every request must be parsed into subtasks before coding begins.
3. **TDD Slices**: Implementation subtasks must be small `phase:code-slice` units with a failing unit test before production code.
4. **Unit-First Verification**: A normal code slice needs the failing unit test, passing unit test, and relevant local checks only.
5. **Large Boundary Verification**: Run integration and endpoint E2E only after a large feature boundary is complete, such as one full production tab, local AI training, an LLM workflow, or an endpoint-backed capability.
6. **Task File**: Track progress in `task.md` or the active implementation plan.
7. **Task Completion**: Mark items as complete only after the QA agent or verification gate confirms the required tests passed.

## TODO / Next Steps
- [ ] Create automated checks linking task files to commit hooks.
