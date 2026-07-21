# Known Limitations (V1)

1. **Live payments frozen** — mock only.
2. **Live travel providers default OFF** — opt-in with Edge secrets.
3. **In-memory ops stores** — idempotency, DLQ, trip session stores are process-local.
4. **No OpenTelemetry / Prometheus export** — in-process metrics + structured logs.
5. **Alert sinks mock** until production webhook configured.
6. **Schema validation** is lightweight (no Zod); domain validators at boundaries.
7. **Enterprise Document Center** may be flag-gated OFF when present on a branch.
8. **CSP Amadeus connect-src** may need alignment if browser-side live search is enabled later.

These are accepted for Production V1 controlled release.
