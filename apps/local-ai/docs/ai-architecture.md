# AI Architecture Plan

Inference runtime, model architectures, and LLM orchestration strategies.

## Purpose
Establishes model serving, prompt pipelines, runtime packages (e.g. PyTorch, llama.cpp), and memory configurations.

## Status
- **Status**: Active

## Scope
Directly governs apps/local-ai script setups, ML pipelines, and LLM API integrations.

## Guidelines
- Separate statistical modeling (regression, GBDTs) from LLM agent prompt routing.
- Restrict file inputs to standard structures defined in data-contracts.md.

## TODO / Next Steps
- [ ] Align model formats and runtime framework (e.g., PyTorch vs ONNX).
