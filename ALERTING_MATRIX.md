# Alerting Matrix — Phase AA

Severity order: **Critical** → **High** → **Medium** → **Low**

| Condition ID | Severity | Threshold (default) | Affected services | Response |
|--------------|----------|---------------------|-------------------|----------|
| `application_unavailable` | Critical | liveness or health = fail | spa | Rollback or emergency hotfix |
| `readiness_failure` | Critical | readiness = fail | spa, edge_functions | Block traffic; fix env/config |
| `security_secret_validation_failure` | Critical | ≥1 secret validation failure | spa, edge_functions | Rotate secrets; rollback SPA |
| `database_connection_failure` | Critical | ≥3 database.errors | database | Check Supabase; fail over |
| `repeated_auth_failures` | High | ≥5 auth.failures | auth | Brute-force review; rate limits |
| `provider_outage` | High | ≥5 provider.failures OR circuit open | providers | Mock fallback; flag live off |
| `booking_ticketing_spike` | High | ≥3 booking OR ticketing failures | booking, ticketing, payment | Patch v1.0.1; incident |
| `elevated_error_rate` | High | ≥10 frontend.errors | spa | Investigate regressions |
| `queue_backlog` | Medium | backlog ≥25 | queue | Scale workers / drain queue |
| `dead_letter_growth` | Medium | DLQ ≥5 items | queue, notifications | Requeue or fix upstream |

## Patch-release mapping

| Highest alert | `evaluatePatchRelease` action |
|---------------|-------------------------------|
| Critical availability/security | `rollback` |
| Other critical | `emergency_hotfix` |
| High booking/payment/ticket | `v1.0.1_patch` |
| Medium/low only | `no_action_monitoring` |
| None | `no_action_monitoring` |

## Dispatcher

- Default: in-memory `MockAlertDispatcher` (tests + local ops).
- Production: implement `AlertSink` and `setAlertDispatcher(new CompositeAlertDispatcher([...]))`.
