# Intent Transitions — Phase 7 Stage 6

## Transition model

`IntentTransitionModelContract` declares allowed transitions (architecture placeholders):

| From | To | Reason hint |
|------|----|-------------|
| `general_conversation` | `plan_trip` | architecture_placeholder |
| `plan_trip` | `book_flight` | architecture_placeholder |
| `plan_trip` | `book_hotel` | architecture_placeholder |
| `null` | `intent_switching` | switch_detected_hint |

## Related

| Contract | Role |
|----------|------|
| `IntentHistoryContract` | History entries; `persisted: false` |
| `IntentSnapshotContract` | `primaryIntent: null` in blueprints |
| Priority rules | prefer_emergency_support · prefer_booking_over_general · prefer_explicit_over_implicit |
| Resolution rules | resolve_primary_by_confidence · keep_secondary_as_multi_intent · deny_unvalidated |

No live intent switching or booking starts.
