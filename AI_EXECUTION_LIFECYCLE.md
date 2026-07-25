# Execution Lifecycle — Phase 6 Stage 9

**Source:** `RUNTIME_LIFECYCLE_ACTIONS` / `ExecutionLifecycleContract`

## Defined actions

| Action | Meaning (architecture) |
|--------|------------------------|
| `start` | Begin pipeline session (hint only) |
| `pause` | Suspend coordination |
| `resume` | Continue after pause |
| `cancel` | Abort in-flight pipeline |
| `rollback` | Revert to prior safe checkpoint hint |
| `recovery` | Apply recovery strategy hints |
| `completion` | Mark pipeline finished |

Blueprints keep `currentActionHint: null` and `session.opened: false`.

## State machine

`idle` → `starting` → `running` ⇄ `paused` → `recovering` | `rolling_back` | `cancelling` → `completed` | `failed` → `closed`

Transitions are metadata only — no timers, workers, or live sessions.
