# Booking Validation — Phase 7 Stage 11

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `BookingValidationContract` / `BookingValidation` | `valid: true`, empty issues |
| `BookingConfirmationDraft` | `confirmed: false` |
| `BookingConfidence` | `bandHint: 'medium'`, `scoreHint: 0` |
| `BookingRevisionContract` | empty revisions; `persisted: false` |
| `BookingSnapshotContract` | snapshot linked to sessionId |

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoRuntime` | false |
| `httpRequests` | false |
| `wiredIntoProviderApis` | false |
| `bookingExecuted` | false |
| `reservationsCreated` | false |
| `payments` | false |
| `notifications` | false |
| `emails` | false |
| `wiredIntoLlms` | false |
| `wiredIntoDatabase` | false |
| `wiredIntoStorage` | false |
| `wiredIntoOcr` | false |
| `wiredIntoAuth` | false |
| `distinctFromBookingOrchestratorFlag` | true |
| `distinctFromLibBookingOrchestrator` | true |
| `distinctFromCoreBookingOrchestrator` | true |
| `distinctFromOfferDecisionEngine` | true |

Force blueprint: `tryBuildTravelBookingOrchestratorBlueprint({ enabled: true })`.
