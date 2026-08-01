# Sprint 88 Task 5 — Shadow Telemetry Skeleton

**Status:** Complete (awaiting review; Task 6 not started)  
**Flags:** `ai.brain.v1` OFF · `ai.brain.v1.preview` OFF · no `ai.tie.v1`  

## Goal

Telemetry **infrastructure** for Brain v1 preview evaluation metadata only.

- No production registration  
- No OpenTelemetry / network / persistence  
- Not wired into BrainRouter, `planTurn`, or ConversationManager  

## Event contract (`ShadowPreviewTelemetryEvent`)

| Field | Notes |
| --- | --- |
| `traceId` | Required |
| `conversationId` | Optional |
| `timestamp` | ISO string |
| `scenarioId` | Golden / eval id or null |
| `plannerVersion` | e.g. preview contract version |
| `previewEnabled` | boolean |
| `fallbackTriggered` | boolean |
| `executionStage` | evaluate / preview_route / fallback / complete |
| `latencyBucket` | Coarse bucket only |
| `resultStatus` | ok / fallback / error / skipped_disabled |
| `errorCategory` | Optional sanitized class |

## Forbidden in telemetry

User messages, passport, names, emails, phones, payment, booking identifiers, provider payloads, search queries.

## Modules

```text
src/lib/brain/v1/preview/telemetry/
  types.ts
  redaction.ts
  emitter.ts
  inMemorySink.ts
  index.ts
```

## Verify

```bash
npm run brain-shadow:verify
```
