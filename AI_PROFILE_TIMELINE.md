# Profile Timeline — Phase 7 Stage 1

**Source:** `ProfileTimelineContract` / `ProfileTimelineEventKind`

## Event kinds

| Kind | Meaning (architecture) |
|------|------------------------|
| `profile_created` | Profile blueprint opened |
| `identity_updated` | Identity section change hint |
| `preferences_updated` | Preferences change hint |
| `document_registered` | Document registry hint |
| `consent_recorded` | Consent entry hint |
| `version_bumped` | Versioning hint |
| `validation_ran` | Validation pass hint |
| `status_changed` | Status transition hint |
| `audit_appended` | Audit linkage hint |

Blueprints seed a single `profile_created` timeline event.  
No realtime feeds, no persistence, no UI wiring beyond architecture docs.
