# Trip Planner API Layer (Phase AG)

Provider-neutral HTTP API over the existing `TripPlannerService` (Phase AF).

## Architecture

```
HTTP request
  → authentication (Supabase JWT / bearer resolver)
  → transport validation (method, body size, JSON shape, ownership)
  → TripPlannerService.plan / getStoredResult
  → HTTP response
```

No second orchestration layer. Scoring, ranking, itinerary optimization, and booking preview remain inside the existing engines/service.

## Surfaces

| Surface | Path | Role |
|---|---|---|
| Shared HTTP handler | `src/lib/ai/tripPlanner/http` | Canonical Fetch-compatible API |
| SPA/API client | `src/integrations/api/tripPlannerApiClient.ts` | Default **in-process** transport |
| Edge Function namespace | `supabase/functions/trip-planner` | Auth gateway + optional handler bridge |

## Endpoints

### `GET /health`

Unauthenticated health probe.

Safe defaults in the response:

- `paymentProvider: "mock"`
- `liveProvidersEnabled: false`
- `bookingEnabled: false`

### `POST /` or `POST /plan`

Body:

```json
{
  "action": "plan",
  "request": { /* TripPlannerRequest */ }
}
```

Or a bare `TripPlannerRequest` object.

Requires `Authorization: Bearer <token>`.

Authorization rule: authenticated user id **must** equal `request.userId`.

Response `200`:

```json
{
  "ok": true,
  "action": "plan",
  "result": { /* TripPlannerResult */ }
}
```

Domain failures (`failed` / `partial` / `cancelled`) remain inside `result` (AF contract). Transport errors use `{ error, code }` with 4xx/5xx.

### `GET /result?idempotencyKey=` or `?requestId=`

Authenticated lookup of a stored result. Returns `404` when missing or owned by another user.

## Authentication

Reuses the existing Supabase auth architecture:

- Edge: `supabase.auth.getUser(jwt)`
- In-process: injectable `TripPlannerAuthResolver` (dev token `user:<id>` or Supabase JWT resolver)

## Safe defaults

- Keep `VITE_PAYMENT_PROVIDER=mock`
- Live providers remain OFF
- API never enables real booking, payment, or ticket issuance
- Booking preview only when `includeBookingPreview=true` on the AF request (mock only)

## Edge deployment notes

Set `TRIP_PLANNER_HANDLER_URL` to a host that runs the shared HTTP handler (`handleTripPlannerHttpRequest`). The Edge Function:

1. Authenticates the caller
2. Forwards the request to that host
3. Does **not** reimplement planning logic

Without `TRIP_PLANNER_HANDLER_URL`, Edge still authenticates and validates the envelope, then returns `503 handler_host_required`. Web clients should use the in-process API client.

## Rate limiting

Uses existing `checkDomainRateLimit('search', ...)`.

## Related docs

- `AI_TRIP_PLANNER_PIPELINE.md`
- `TRIP_PLANNER_CONTRACT.md`
