# Profile Validation — Phase 7 Stage 1

**Source:** `ProfileValidationContract`

## Contract

| Field | Blueprint default |
|-------|-------------------|
| `valid` | `true` |
| `issues` | `[]` |
| `execution` | `'none'` |

## Related quality signals

| Contract | Role |
|----------|------|
| `ProfileStatusContract` | Lifecycle status (`draft` in blueprints) |
| `ProfileVersioningContract` | Version counter (`0`) |
| `ProfileAuditTrailContract` | Audit entries; `persisted: false` |
| `ConsentRegistryContract` | Consent gates for future personalization |

Validation is declarative only — no schema engines, no DB constraints, no OCR checks.
