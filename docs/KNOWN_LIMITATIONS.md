# KNOWN LIMITATIONS — Rahhal 1.0.0

- Live payments frozen (`VITE_PAYMENT_PROVIDER=mock`).
- Live travel providers default OFF; require Edge secrets + ops approval.
- Provider Runtime / Flight / Hotel search engines are library-ready; primary chat UX may still use legacy aggregation paths until product wiring.
- Hotelbeds is an engine-local future stub (not a Provider Runtime ID).
- In-memory idempotency / DLQ / trip store — not multi-instance durable.
- Enterprise Document Center OFF by default when present.
- No OpenTelemetry export — in-process metrics + structured logs.
- Alert sinks mock/composite until production webhook configured.
- Hosting rollback is manual; library arms the trigger.
- `src/domains/**` façades are documented public-API maps; app routes import libraries directly today.
