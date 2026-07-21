# API STATUS

| Surface | Status | Notes |
| --- | --- | --- |
| Supabase Auth | Ready | Anon key client-side only |
| Ops health probes | Ready | liveness / readiness / health |
| Provider Runtime | Ready | Sprint 71; mock default; live gated by flags + secrets |
| Flight Search Engine | Ready | Sprint 72; Amadeus/Duffel via runtime → mock fallback |
| Hotel Search Engine | Ready | Sprint 73; Booking.com via runtime → mock fallback |
| Provider adapters (legacy aggregation) | Ready | Mock default; live gated |
| Payments | Frozen mock | Live capture blocked until freeze lift |
| Notifications | Ready | Mock channel providers + retry |
| Trip Management | Ready | Sprint 62 |
| Document Center | Ready | Legacy + optional enterprise v2 |
| Beta ops | Ready | Sprint 67–69 |
| Deployment | Ready | Sprint 68 |
| GA release verify | Ready | Sprint 70 |
