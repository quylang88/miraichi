# Agent Directory

## Required Project Rules

- Read `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` and `.agent/skills/miraichi-project-guardrails/SKILL.md` before planning, coding, testing, staging, production promotion, or maintenance.
- Use `.agent/skills/miraichi-phase-transition-recommendation/SKILL.md` when closing, reviewing, or handing off a phase.
- Treat `PROJECT_PLAN.md` as the active phase source of truth.
- Preserve competition-agnostic contracts and owner-only scope.
- Do not treat local verification as production approval.

## Roles

| Role | Responsibility | Reference |
| --- | --- | --- |
| Planner | Break down approved scope and track gates | `docs/agents/planner-agent.md` |
| Architect | Protect system and competition boundaries | `docs/agents/architect-agent.md` |
| Frontend | Maintain the four-tab PWA | `docs/agents/frontend-agent.md` |
| Backend | Maintain API, worker, serving store, and persistence | `docs/agents/backend-agent.md` |
| QA | Own unit, integration, E2E, and security checks | `docs/agents/qa-agent.md` |
| DevOps | Maintain CI/CD, staging, and deployment operations | `docs/agents/devops-agent.md` |
| Product Research | Research factual data sources and owner workflows | `docs/agents/product-research-agent.md` |
| Docs Maintainer | Keep current documentation and ADR indexes accurate | `docs/agents/docs-maintainer-agent.md` |

All agent handoffs use `packages/agent-protocol`.
