# Reasoning Pipeline — Phase 6 Stage 2

**Package:** `src/lib/orchestration/conversationOrchestrator/`

## Contract

`ReasoningPipelineContract` with ordered steps:

1. `collect_context` → `context_bundle`
2. `score_confidence` → `confidence`
3. `plan_response_contract` → `response_pipeline`

`execution` is always `'none'`.

## Companion engines (also non-executing)

| Engine | Contract | Notes |
|--------|----------|-------|
| Clarification | `ClarificationEngineContract` | missing slots only |
| Question Generator | `QuestionGeneratorContract` | question strings |
| Confidence | `ConfidenceEngineContract` | score + band |
| Response Pipeline | `ResponsePipelineContract` | outline + module hints |

No LLM prompts, tokens, or provider SDKs.
