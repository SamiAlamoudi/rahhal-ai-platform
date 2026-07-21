# ROADMAP — Post V1

## Shipped on main (through Sprint 73)

1. GA ops stack (Sprints 65–70)
2. Provider Runtime (Sprint 71)
3. Flight Search Engine (Sprint 72)
4. Hotel Search Engine (Sprint 73)

## Recommended next (see QA-0)

1. **Product wiring:** connect Flight/Hotel Search Engines to the primary `/chat` traveler path behind flags (no engine rewrite).
2. Merge / complete production cleanup (dead Sprint 18/19 UI hooks) if still open.
3. Lift payment production freeze after business verification.
4. Durable multi-instance stores (idempotency, trips, DLQ).
5. OpenTelemetry / external APM export.
6. Production alert webhooks.
7. Expanded live provider coverage with per-market SLOs (after secrets + soak).
8. Optional Hotelbeds live adapter (engine stub exists).
