# Phase 4 Local AI Guardrails

* **Date**: June 23, 2026
* **Status**: Active Guardrails

---

## 1. Core Mandate
This document governs all architectural choices, designs, and code within `apps/local-ai`. All development must adhere to the owner-approved boundaries. AI agents must not unilaterally code business logic, mathematical probabilities, or model algorithms.

---

## 2. Forbidden Implementations
The following implementation targets are strictly forbidden during Phase 4:

| Category | Forbidden Target | Rationale |
| :--- | :--- | :--- |
| **Algorithms** | ML models, neural networks, heuristic calculations, regressions | Requires owner-approved ADR and research baseline |
| **Probabilities** | Goal metrics, draw percentages, likelihood variables | Part of core business logic under owner governance |
| **Scoring** | Mathematical confidence formulas or value indicators | Must not be hardcoded or decided by AI agents |
| **Betting & Bankroll** | Kelly Criterion, budget distribution, risk cap checks, advice | High liability logic requiring owner-specific ADR |
| **Runtimes** | ONNX Runtime, TensorFlow, PyTorch, Llama.cpp packages | Prevents premature third-party dependency locks |
| **Model Weights** | `.onnx`, `.bin`, `.gguf`, `.tflite` file check-ins | Bloats git history and bypasses runtime selection ADR |
| **Cloud APIs** | OpenAI SDK, Anthropic API, Gemini calls, AWS SageMaker | Violates local-first, zero-cost, and privacy rules |
| **Database/ORMs** | Prisma, Drizzle, Sequelize, SQLite, MongoDB integrations | DB access is strictly deferred; mock repositories only |
| **Competitions** | Hardcoded "World Cup", "FIFA", real teams, real players | Breaks the core competition-agnostic architecture |

---

## 3. Competition Agnosticism Guardrails
* All examples, mock payloads, testing fixtures, and documentation templates must use generic names:
  * Tournaments: `competition-alpha`, `competition-beta`.
  * Seasons: `season-alpha-2026`, `season-beta-2026`.
  * Teams: `team-alpha-home`, `team-alpha-away`.
  * Matches: `match-alpha-001`, `match-beta-002`.
* No real football clubs, real tournaments, or real leagues may be hardcoded or imported.

---

## 4. Mock Engine Constraints
* For the duration of Phase 4, the prediction engine inside `apps/local-ai` must act as a **static mock service**.
* The mock server must return deterministic prediction structures with static `confidenceLabel` strings (e.g. `mock-low`, `mock-medium`, `mock-high`) and static placeholder ratios.
* No mathematical equations, random number generators representing odds evaluation, or logical thresholds mapping odds to team advantages may be written.
