# Sprint 88 Task 2 — Preview Contracts (BrainRouter+)

**Status:** Complete (interfaces / contracts only)  
**Checkpoint prior:** tag `sprint88-task1-complete`  
**Flags:** `ai.brain.v1` OFF; `ai.brain.v1.preview` OFF  

## Goal

Publish type contracts for Preview Orchestrator evolution and future domain search **without** changing production behavior, provider wiring, UI, or Search Handoff implementation.

## Modules

```text
src/lib/brain/v1/contracts/
  previewContracts.ts      — stage + SearchHandoffHint + contract version
  domainIntelligence.ts    — DomainIntelligence<TQuery, TOffer>
  rankingConfig.ts         — configurable ranking weight keys
  normalizedOffer.ts       — offer normalization checklist shape
  index.ts
```

## Guarantees

| Guarantee | Status |
| --- | --- |
| BrainRouter runtime unchanged | Yes — does not populate new meta fields yet |
| Default-OFF behavior unchanged | Yes |
| No provider / gateway execute | Yes — `domainIntelligenceNotImplemented` |
| No Search Handoff impl | Yes — hints document ADR lock only |
| No `ai.tie.v1` | Yes |
| Ranking weights configurable (not geo-hardcoded) | Yes — `RankingConfig` / `mergeRankingConfig` |

## Clarification gate (from Task 1 ADR)

`SearchHandoffHint` includes `blocked_insufficient_information` with  
`mustNotInvokeSearchOrGateway: true`. Sprint 90 must enforce this before any search.

## Verify

```bash
npm run test:run -- src/lib/__tests__/sprint88.previewContracts.task2.test.ts
npm run test:run
```
