# ADR-0019: Prediction Engine Runtime and Algorithm Selection Boundary

* **Status**: Accepted
* **Date**: 2026-06-23
* **Accepted Date**: 2026-06-23
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Not started
* **Note**: This ADR guides Phase 4 mock local-ai planning and does not authorize real prediction algorithms, probability formulas, betting recommendations, bankroll logic, risk logic, model runtimes, or LLM provider integration. (Note: This ADR defers selection of production runtimes and model weights.)

---

## 1. Context
We must plan how the prediction engine will execute models. However, selecting runtime frameworks (such as ONNX, TensorFlow, PyTorch) or importing model weights too early risks premature technology lock-in, configuration complexity, and potential license/runtime incompatibilities during skeleton phase development.

## 2. Options Considered
* **Option A**: Integrate PyTorch/ONNX libraries immediately with mock weights.
* **Option B**: Code heuristic mathematical prediction calculations directly into worker scripts.
* **Option C (Recommended)**: Defer final runtime selection and implement a static mock prediction engine.

## 3. Decision & Recommendation
Recommend **Option C**. The final prediction runtime, models, weights, and algorithms are completely deferred until a later owner-approved ADR. 

During Phase 4, the system may implement a mock prediction engine that returns traceable mock envelopes only. It must not return real outcome predictions, betting picks, probability percentages, or confidence scores. The safest default is `predictionAvailable: false` or `engineMode: mock`.

## 4. Consequences
* The codebase remains zero-dependency and lightweight.
* Developer setup avoids complex machine learning package compilation.
* Model execution is simulated safely via predictable, mock outputs.

## 5. Risks
* Defers identification of hardware resource constraints or ONNX/Python performance limitations.

## 6. Open Questions
* Which runtime (Node.js ONNX bindings vs decoupled Python daemon) offers the lowest latency and easiest deployment?

## 7. Explicit Exclusions
* This ADR does NOT authorize the installation of ONNX Runtime, PyTorch, or TensorFlow.
* This ADR does NOT authorize checking model weight files (`.onnx`, `.bin`, `.gguf`) into the repository.
