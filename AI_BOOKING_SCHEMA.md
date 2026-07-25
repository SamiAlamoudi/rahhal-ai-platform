# Booking Schema — Phase 7 Stage 11

**Source:** output contracts in `src/lib/orchestration/travelBookingOrchestrator/types.ts`

## Output contracts

| Contract | Fields (hints) |
|----------|----------------|
| `BookingRequest` | requestId · sourceOfferDecisionHint · providerKinds · `providerCalled: false` |
| `BookingCandidate` | candidateId · providerKindHint · labelHint |
| `BookingSession` | sessionId · requestId · stateHint |
| `BookingStep` | stepId · sessionId · stepHint · statusHint |
| `BookingValidation` | requestId · valid · issues |
| `BookingConfirmationDraft` | draftId · sessionId · confirmationHint · `confirmed: false` |
| `BookingFailure` | failureId · sessionId · reasonHint · recoverableHint |
| `BookingRevision` | revisionId · requestId · reasonHint |
| `BookingSnapshot` | snapshotId · atIso · sessionId |
| `BookingConfidence` | requestId · scoreHint · bandHint |

## Input hints

`offer_decision` · `traveler_profile` · `passengers` · `payment_intent_placeholder` · `provider_capabilities` · `business_rules`

Schema is TypeScript interfaces only — no ORM, migrations, or persistence.
