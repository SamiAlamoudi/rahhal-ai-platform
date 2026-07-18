# Trip Planner Contract (Phase AF + AG API)

## Input — `TripPlannerRequest`

| Field | Required | Notes |
|---|---|---|
| `requestId` | yes | Caller-supplied request identifier |
| `userId` | yes | Preference scoping key (not passenger PII store) |
| `destinations` | yes | One or more destinations |
| `origin` | no | Origin city/airport label |
| `startDate` / `endDate` | conditional | Required unless `flexibleDates=true` |
| `flexibleDates` | no | When true, `durationDays` required |
| `durationDays` | conditional | 1–60 |
| `travelers` | yes | At least one adult; max 20 total |
| `budget` | no | Positive amount when provided |
| `currency` | no | `USD` \| `SAR` \| `EUR` \| `AED` \| `GBP` |
| `travelStyle` | no | Mapped into PreferenceEngine styles when valid |
| `explicitPreferences` | no | Interests, pace, budget style, flight/hotel prefs |
| `constraints` | no | Avoid lists, direct flights, pace conflicts rejected |
| `accessibilityNeeds` | no | Metadata only in v1 (not persisted as PII dossier) |
| `preferredLanguage` | no | `ar` \| `en` |
| `includeBookingPreview` | no | Default `false` |
| `idempotencyKey` | yes | Deduplicates pipeline execution |
| `expiresAt` | no | Stale-request protection |
| `inferredPreferences` | no | Non-PII behavioural signals |

## Output — `TripPlannerResult`

| Field | Description |
|---|---|
| `requestId` | Echo of input request id |
| `correlationId` | Diagnostics correlation id |
| `status` | `completed` \| `partial` \| `failed` \| `cancelled` |
| `stage` | Terminal pipeline stage |
| `normalizedPreferences` | PreferenceEngine output + preference sources |
| `recommendations` | RecommendationEngine results (scores/reasons preserved) |
| `itinerary` | ItineraryEngine result or `null` |
| `bookingPreview` | Present only when preview requested and built |
| `totalEstimatedCost` / `currency` | From itinerary cost breakdown when available |
| `overallConfidence` / `confidence` | Pipeline aggregation; engine confidences preserved underneath |
| `warnings` / `assumptions` | User-safe messaging |
| `pipelineTimeline` | Ordered stage events |
| `failure` | Failed stage, code, retryable, correlation id |
| `validationErrors` | Canonical validation errors |
| `partial` | Whether prior-stage outputs were retained |
| `generatedAt` | Timestamp |
| `version` | `1` |

## Booking preview limitations

When `includeBookingPreview=true`:

- Uses `BookingOrchestrator.createDraftFromItinerary`
- Validates itinerary and may mock-reserve for readiness
- Returns `BookingSummary` + `BookingTimeline`
- Sets `paymentCaptured=false`, `bookingConfirmed=false`, `liveProvidersUsed=false`
- Does **not** call `simulatePayment`, `confirmBooking`, or `runPipeline`

When `includeBookingPreview=false`:

- BookingOrchestrator is not invoked
- `bookingPreview` is `null`

## Idempotency behavior

Same valid `idempotencyKey` returns the stored `TripPlannerResult`.

## Cancellation / timeout

- `AbortSignal` cancels cooperatively between stages
- Per-stage and total timeout budgets are enforced
- Cancelled runs do not return booking preview side effects

## Backward compatibility

TripPlannerService is additive. Existing PreferenceEngine, RecommendationEngine, ItineraryEngine, BookingOrchestrator, and ProviderAdapter contracts remain unchanged.

## Phase AG REST DTOs

Stable HTTP DTOs live in `src/lib/ai/tripPlanner/http/dto.ts` and are documented in `TRIP_PLANNER_API.md` / `docs/openapi/trip-planner-api.v1.json`.

| DTO | Role |
|---|---|
| `CreateTripPlanRequestDto` | Transport body for `POST /trip-planner/plans` (no trusted `userId`) |
| `CreateTripPlanResponseDto` | Create / async accept envelope with status URLs |
| `TripPlanResultDto` | Safe result projection (no stacks / raw repos / secrets) |
| `TripPlanStatusDto` | Polling status without internal errors |
| `TripPlanTimelineDto` | Masked ordered pipeline events |
| `TripPlanErrorDto` | Structured `{ error: { code, message, field?, retryable, correlationId } }` |

REST maps authenticated user → `TripPlannerRequest.userId` before calling `TripPlannerService.plan`. Engine contracts are unchanged.

### Ownership

- REST: authenticated user id is authoritative; client `userId` is ignored.
- Legacy `/plan`: still requires `request.userId` to match the authenticated user (AH client compatibility).
- Admin role may read other users' plans; non-owners receive `404`.

### Idempotency (REST)

Header `Idempotency-Key` binds to `(userId, requestHash)`. Body idempotency fields are not trusted for REST create.
