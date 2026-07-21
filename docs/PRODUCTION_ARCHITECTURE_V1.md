# Production Architecture (V1)

Rahhal is a React 19 + Vite SPA (Arabic RTL) with Supabase Auth/Postgres. Travel planning, ranking, booking execution, and trip management are client-side engines against **mock** provider adapters by default.

```
Browser (SPA)
  ├─ Conversation / Rahhal Brain
  ├─ Search + Ranking (Booking Intelligence)
  ├─ Booking Execution → Live Provider SDKs (opt-in)
  ├─ Trip Management (consumer of Booking Execution)
  ├─ Document Center (payments DocumentCenter; enterprise optional)
  └─ Ops (logging, metrics, health, security, reliability)
        └─ Sprint 65 production gates

Supabase (Auth + RLS + optional Edge ops-health)
External providers (Amadeus / Booking.com / Duffel) — secrets server-side only
```

**Non-goals for V1:** live card capture, multi-instance durable stores, OpenTelemetry export.

See also: `docs/PRODUCTION_READINESS.md`, `src/lib/ops/`.
