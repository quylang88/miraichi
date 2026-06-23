# AI Agent Directory

Overview of the specialized subagent personas configured to collaborate on Miraichi.

## Purpose
This document catalogs the roles, responsibilities, and system configurations of all AI subagents supporting the project.

## Status
- **Status**: Draft

## Scope
Defines the coordination framework for all subagents active in development.

## Agent System Guidelines
- All agent interactions must follow the communication schema in packages/agent-protocol.
- Subagents must not exceed their designated boundaries without handoff to the appropriate specialist.

## Subagent Directory

| Agent Name | Mission | Primary Responsibility | Target docs/agents file |
| :--- | :--- | :--- | :--- |
| **Planner Agent** | Orchestrate project execution | Break down user requests, track schedules, verify state | [planner-agent.md](file:///c:/CODE/miraichi/docs/agents/planner-agent.md) |
| **Architect Agent** | Guard system integrity | Enforce competition-agnostic architecture, review structures | [architect-agent.md](file:///c:/CODE/miraichi/docs/agents/architect-agent.md) |
| **Frontend Agent** | Deliver responsive UI | Code apps/web, style with vanilla CSS, apply design system | [frontend-agent.md](file:///c:/CODE/miraichi/docs/agents/frontend-agent.md) |
| **Backend Agent** | Build robust services | Code apps/api, apps/worker, set up databases and queues | [backend-agent.md](file:///c:/CODE/miraichi/docs/agents/backend-agent.md) |
| **AI/Data Agent** | Develop intelligence layers | Code apps/local-ai, build prediction scripts and prompts | [ai-data-agent.md](file:///c:/CODE/miraichi/docs/agents/ai-data-agent.md) |
| **QA Agent** | Ensure software quality | Write unit/E2E tests, audit security, run sanity checks | [qa-agent.md](file:///c:/CODE/miraichi/docs/agents/qa-agent.md) |
| **DevOps Agent** | Automate operations | Manage ops/, write CI/CD pipelines, Docker, deployments | [devops-agent.md](file:///c:/CODE/miraichi/docs/agents/devops-agent.md) |
| **Product Research Agent** | Align with user needs | Research betting markets, football data strategies, UX | [product-research-agent.md](file:///c:/CODE/miraichi/docs/agents/product-research-agent.md) |
| **Docs Maintainer Agent** | Maintain knowledge base | Keep all documentation up-to-date and syntactically correct | [docs-maintainer-agent.md](file:///c:/CODE/miraichi/docs/agents/docs-maintainer-agent.md) |

## TODO / Next Steps
- [ ] Create detailed prompt configuration profiles for each agent in `docs/agents/`.
