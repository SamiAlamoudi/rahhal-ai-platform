# KNOWN LIMITATIONS — Rahhal 1.0.0

- Live payments frozen (`VITE_PAYMENT_PROVIDER=mock`).
- Live travel providers default OFF; require Edge secrets + ops approval.
- Sprint 72/73 Flight/Hotel Search Engines are wired into conversation tools (Sprint 74); live providers still require Edge secrets + flags (default mock).
- Hotelbeds is an engine-local future stub (not a Provider Runtime ID).
- In-memory idempotency / DLQ / trip store — not multi-instance durable.
- Enterprise Document Center OFF by default when present.
- No OpenTelemetry export — in-process metrics + structured logs.
- Alert sinks mock/composite until production webhook configured.
- Hosting rollback is manual; library arms the trigger.
- Itinerary Refinement (Sprint 84) not yet on `main` — deferred; mock Alpha PASS does not require it.
- Adaptive learning remains local PreferenceStore (not cross-device durable).
- See `docs/ALPHA_READINESS_REPORT.md` (Sprint 89 PASS) and `docs/QA0_PRODUCT_AUDIT.md`.
