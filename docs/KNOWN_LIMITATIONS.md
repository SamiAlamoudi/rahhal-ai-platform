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
- **Alpha (Sprint 88):** Constitution library not wired into `planTurn`; Package Builder often skips when offer pools thin; Itinerary Refinement (S84) not on main; intent extraction can corrupt destination on edit phrases (`only` / `instead` / month names). See `docs/ALPHA_READINESS_REPORT.md` and `docs/WEAKNESSES.md`.
- See `docs/QA0_PRODUCT_AUDIT.md` for full QA-0 findings.
