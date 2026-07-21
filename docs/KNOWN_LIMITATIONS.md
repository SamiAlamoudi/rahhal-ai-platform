# KNOWN LIMITATIONS — Rahhal 1.0.0

- Live payments frozen (`VITE_PAYMENT_PROVIDER=mock`).
- Live travel providers default OFF; require Edge secrets + ops approval.
- In-memory idempotency / DLQ / trip store — not multi-instance durable.
- Enterprise Document Center OFF by default when present.
- No OpenTelemetry export — in-process metrics + structured logs.
- Alert sinks mock/composite until production webhook configured.
- Hosting rollback is manual; library arms the trigger.
