# Booking Lifecycle — Phase 7 Stage 11

**Source:** `TRAVEL_BOOKING_LIFECYCLE_ACTIONS` · `TRAVEL_BOOKING_STATE_HINTS` · `BookingLifecycleContract`

## Lifecycle actions

`prepare` · `validate` · `open_session` · `advance_step` · `draft_confirm` · `plan_rollback` · `plan_retry` · `snapshot` · `revise` · `close`

## State hints (transitions — declarative)

| State | Meaning |
|-------|---------|
| `idle` | No session |
| `preparing` | Building request/candidates |
| `validated` | Validation passed (hint) |
| `session_open` | Session opened (hint) |
| `steps_planned` | Steps planned (hint) |
| `confirmation_drafted` | Draft confirmation only |
| `failed_planned` | Failure recorded (not executed) |
| `closed` | Session closed |

## Blueprint defaults

| Contract | Defaults |
|----------|----------|
| `BookingLifecycleContract` | actions + stateHints listed; `currentStateHint: null` |
| `BookingSession` | `stateHint: 'idle'` |
| `BookingStep` | `statusHint: 'pending'` |

No state machine runs in this stage — transitions are architectural hints for future integration.
