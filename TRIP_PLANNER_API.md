# Trip Planner API Layer v1 (Phase AG)

Provider-neutral HTTP API over the existing `TripPlannerService` (Phase AF).

## Architecture

```
HTTP request
  → authentication (Supabase JWT / bearer resolver)
  → transport validation (content-type, size, JSON, Idempotency-Key)
  → ownership from authenticated user (body userId ignored on REST)
  → TripPlannerService.plan (via thin plan store)
  → HTTP response DTOs
```

No second orchestration layer. Scoring, ranking, itinerary optimization, booking preview, timeout, cancellation, and confidence remain inside the existing engines/service.

## Surfaces

| Surface | Path | Role |
|---|---|---|
| Shared HTTP handler | `src/lib/ai/tripPlanner/http` | Canonical Fetch-compatible API |
| REST namespace | `/trip-planner/plans` | Stable external contract |
| Legacy actions | `/plan`, `/result`, `/health` | Backward-compatible thin actions (AH client) |
| Edge Function | `supabase/functions/trip-planner` | Auth gateway + optional handler bridge |
| SPA/API client | `src/integrations/api/tripPlannerApiClient.ts` | Default **in-process** legacy transport |

## REST endpoints

Base path: `/trip-planner/plans`

### `POST /trip-planner/plans`

Starts a trip-planning request.

**Auth:** required.

**Headers:**

- `Authorization: Bearer <token>` (required)
- `Content-Type: application/json` (required)
- `Idempotency-Key` (optional; 8–128 chars `[A-Za-z0-9._:-]`; recommended)
- `Prefer: respond-async` (optional → `202`)
- `Accept-Language: ar|en` (optional error locale)
- `x-correlation-id` (optional; validated format)

**Body:** `CreateTripPlanRequestDto` (see OpenAPI / contract). Ownership uses the authenticated user id — never trust `userId` from the body. Payment fields are rejected.

**Responses:**

| Status | When |
|---|---|
| `201` | Plan created and completed (or partial success) synchronously |
| `202` | Accepted async (`Prefer: respond-async` / `?async=1`) or still processing |
| `400` | Malformed JSON, bad content-type, invalid idempotency key, payment fields |
| `401` | Unauthenticated |
| `409` | Idempotency conflict or duplicate active execution |
| `422` | Domain validation errors |
| `429` | Rate limited (create domain) |
| `504` | Pipeline timeout |
| `503` | Temporary dependency unavailability |
| `500` | Unexpected failure |

Mock example (`201`):

```http
POST /trip-planner/plans
Authorization: Bearer user:user_demo
Content-Type: application/json
Idempotency-Key: idem_demo_001

{
  "destinations": ["Istanbul"],
  "origin": "Riyadh",
  "startDate": "2027-05-01",
  "endDate": "2027-05-05",
  "travelers": { "adults": 2, "travelerType": "couple" },
  "budget": { "amount": 9000, "currency": "SAR" },
  "currency": "SAR",
  "preferredLanguage": "en",
  "includeBookingPreview": false
}
```

```json
{
  "planId": "…",
  "status": "completed",
  "currentStage": "Completed",
  "progress": 100,
  "correlationId": "…",
  "statusUrl": "/trip-planner/plans/…/status",
  "resultUrl": "/trip-planner/plans/…",
  "result": { "planId": "…", "status": "completed", "version": 1 }
}
```

### `GET /trip-planner/plans/:planId`

Returns `TripPlanResultDto`. Owner or admin only. Cross-user access returns `404` (no existence leak). Returns safe partial results when the pipeline failed after earlier stages. `202` when still processing.

### `GET /trip-planner/plans/:planId/status`

Returns:

```json
{
  "planId": "…",
  "status": "running",
  "currentStage": "RecommendationsGenerated",
  "progress": 45,
  "startedAt": "…",
  "updatedAt": "…",
  "completedAt": null,
  "retryable": false,
  "correlationId": "…"
}
```

No internal errors or stack traces. Rate-limited (status polling domain).

### `GET /trip-planner/plans/:planId/timeline`

Ordered, timestamped pipeline events. Metadata is masked (no secrets / PII).

### `POST /trip-planner/plans/:planId/cancel`

Cancels an active request via `AbortSignal`. Idempotent. No booking or payment side effects.

### `POST /trip-planner/plans/:planId/retry`

Retries only when the stored failure is explicitly retryable. Reuses the original validated request (fresh engine idempotency key). Rejects completed or cancelled plans (`409`).

## Progress calculation

| Stage | Progress |
|---|---|
| Received | 5 |
| Validating | 10 |
| PreferencesPrepared | 25 |
| RecommendationsGenerated | 45 |
| ItineraryGenerated | 70 (100 when booking preview disabled) |
| BookingPreviewGenerated | 90 |
| Completed | 100 |
| Failed / Cancelled | last completed-stage percentage |

## Idempotency

- Read `Idempotency-Key` from the **header** only (body value ignored).
- Bound to authenticated user + canonical request hash.
- Same key + same request → replay original status/result.
- Same key + different request → `409 IDEMPOTENCY_CONFLICT`.

## Authentication and authorization

- Reuses existing Supabase JWT / injectable bearer resolver.
- REST ownership always from authenticated user.
- Admin (`role=admin` or `Bearer user:<id>:admin` in dev) may read other users' plans.
- Non-owners get `404` for plan-scoped reads (no existence leak).

## Rate limits

Separate domains (in-memory, no paid service):

| Domain | Default / window |
|---|---|
| `trip_planner_create` | 20 |
| `trip_planner_status` | 120 |
| `trip_planner_retry` | 10 |
| `trip_planner_cancel` | 30 |

## Safe defaults

- `VITE_PAYMENT_PROVIDER=mock`
- Live providers OFF
- No real booking, payment, or ticket issuance
- Booking preview only when `includeBookingPreview=true` (mock orchestrator only)
- Secrets stay server-side; provider configuration is not exposed

## Polling guidance

1. Prefer sync create when latency budgets allow (`201`).
2. For async: `Prefer: respond-async` → poll `GET .../status` with backoff.
3. When `status` is terminal (`completed` / `partial` / `failed` / `cancelled`), fetch `GET .../:planId`.
4. Respect `429` and `retryable` flags.

## Machine-readable schema

See `docs/openapi/trip-planner-api.v1.json` (dependency-free OpenAPI 3.0 document).

## Related docs

- `TRIP_PLANNER_CONTRACT.md`
- `API_ERROR_CODES.md`
- `AI_TRIP_PLANNER_PIPELINE.md`
