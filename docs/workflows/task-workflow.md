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
4. **Task File**: Track progress in `task.md` or the active implementation plan.
5. **Task Completion**: Mark items as complete only after the QA agent or verification gate confirms the required tests passed.

## TODO / Next Steps
- [ ] Create automated checks linking task files to commit hooks.
