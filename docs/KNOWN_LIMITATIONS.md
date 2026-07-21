# KNOWN LIMITATIONS — Rahhal 1.0.0

- Live payments frozen (`VITE_PAYMENT_PROVIDER=mock`).
- Live travel providers default OFF; require Edge secrets + ops approval.
- Sprint 72/73 Flight/Hotel Search Engines are library-ready; primary `/chat` still uses Aggregation + Booking Intelligence until product wiring (Sprint 74+).
- Hotelbeds is an engine-local future stub (not a Provider Runtime ID).
- In-memory idempotency / DLQ / trip store — not multi-instance durable.
- Enterprise Document Center OFF by default when present.
- No OpenTelemetry export — in-process metrics + structured logs.
- Alert sinks mock/composite until production webhook configured.
- Hosting rollback is manual; library arms the trigger.
- See `docs/QA0_PRODUCT_AUDIT.md` for full QA-0 findings.
