# Customer Support Runbook — Post-Launch

## Triage flow

1. Collect **correlation ID** (from error screen or logs).
2. Check incident list (`IncidentManager.listOpen()`).
3. Submit feedback via `FeedbackManager.submit()` if bug/usability — no UI changes in Phase AA; use repository/API layer or internal tooling.
4. Escalate using severity from `ALERTING_MATRIX.md`.

## Feedback types

| Kind | Priority default | Action |
|------|------------------|--------|
| Bug | High | Link to incident; hotfix/patch track |
| Usability | Medium | Product backlog (no v1.1.0 planning without approval) |
| Feature request | Low | Log only; feature freeze |
| Rating | Low | Analytics |

## Duplicate prevention

Feedback dedupes on `dedupeKey` (user + kind + summary). Incidents dedupe on open `alertConditionId`.

## PII rules

- Store `contactEmailMasked` only (`maskEmail`).
- Never paste passports, card data, or tokens into tickets.
- Use `FeedbackManager.toSupportView()` for safe handoff.

## Mock payment posture

Customers complete **mock** checkout only. If payment fails:

1. Check `payment.mock_failures` metric.
2. Verify `VITE_PAYMENT_PROVIDER=mock`.
3. Do not enable Moyasar/live rails without explicit approval.

## Escalation

| User impact | Escalate to |
|-------------|-------------|
| Cannot sign in (many users) | High — auth incident |
| Booking stuck after mock pay | High — booking/ticketing |
| Single user glitch | Medium — feedback + monitor |
| Feature ask | Low — feedback only |

## References

- `MONITORING_RUNBOOK.md`
- `HOTFIX_PROCESS.md`
- `ROLLBACK_PLAN.md`
- `INCIDENT_TEMPLATE.md`
