# Sprint 88 Task 4 — Golden Evaluations

**Status:** Complete (awaiting review; Task 5 not started)  
**Flags:** `ai.brain.v1` OFF · `ai.brain.v1.preview` OFF by default · no `ai.tie.v1`  

## Goal

Deterministic golden evaluation skeleton for the Brain v1 **preview** path using public contracts only. No production wiring, no Search Handoff, no Provider Gateway execution, no LLM judge.

## Scenarios

| ID | Title | Focus |
| --- | --- | --- |
| G01 | Value First | Preliminary value before ≤1 question; reject question-only |
| G02 | Zero Questions When Enough Is Known | No unnecessary follow-up when slots suffice |
| G03 | Multi-turn Refinement | Affected fields only; preserve context; provenance |
| G04 | Booking Deferral | No passport / identity / payment asks in explore |
| G05 | Safe Fallback | Brain failure → router fallback; no silent failure; no gateway |

## Modules

```text
src/lib/brain/v1/eval/
  types.ts
  runner.ts
  fixtures/g01…g05 + index.ts
  index.ts
```

## Verify

```bash
npm run brain-eval:verify
npm run test:run -- src/lib/__tests__/sprint88.goldenEval.task4.test.ts
```

## Safety

- Evaluator enables ConversationManager / BrainRouter **only inside tests** via explicit `{ enabled: true }` / `bypassDeployGateForTests`.
- Default registry flags remain OFF.
- `RECOVERY_TURN_OWNER` unchanged.
- Early-return / `toolBatch: null` still holds on Brain success paths.
