# Trip Planner API Error Codes (Phase AG)

Structured error body:

```json
{
  "error": {
    "code": "INVALID_TRAVEL_DATES",
    "message": "User-safe message",
    "field": "travelDates",
    "retryable": false,
    "correlationId": "…"
  }
}
```

Messages are localized to Arabic or English from `preferredLanguage`, `Accept-Language`, or default English.

## Transport / auth

| Code | HTTP | Retryable | Notes |
|---|---|---|---|
| `INVALID_JSON` | 400 | no | Malformed body |
| `INVALID_CONTENT_TYPE` | 400 | no | Expect `application/json` |
| `REQUEST_TOO_LARGE` | 400 | no | Exceeds max body bytes |
| `INVALID_IDEMPOTENCY_KEY` | 400 | no | Header format invalid |
| `UNAUTHENTICATED` | 401 | no | Missing/invalid auth |
| `FORBIDDEN` | 403 | no | Authenticated but unauthorized (legacy only; REST uses 404 for ownership) |
| `NOT_FOUND` | 404 | no | Missing plan or cross-user (no existence leak) |
| `METHOD_NOT_ALLOWED` | 405 | no | Wrong HTTP method |
| `IDEMPOTENCY_CONFLICT` | 409 | no | Same key, different body |
| `DUPLICATE_ACTIVE` | 409 | no | Same request already running |
| `INVALID_STATE` | 409 | no | Cancel/retry not allowed for current state |
| `RATE_LIMITED` | 429 | yes | Domain rate limit |
| `TIMEOUT` | 504 | yes | Pipeline timeout |
| `SERVICE_UNAVAILABLE` | 503 | yes | Temporary dependency / Edge bridge missing |
| `INTERNAL_ERROR` | 500 | no | Unexpected server error |

## Domain validation (`422`)

| Code | Field (typical) |
|---|---|
| `MISSING_DESTINATION` | `destinations` |
| `INVALID_TRAVEL_DATES` | `travelDates` |
| `INVALID_BUDGET` | `budget` |
| `UNSUPPORTED_CURRENCY` | `currency` |
| `INVALID_TRAVELER_COUNT` | `travelers` |
| `CONFLICTING_CONSTRAINTS` | `constraints` |
| `EXPIRED_REQUEST_CONTEXT` | `expiresAt` |
| `INVALID_DURATION` | `durationDays` |
| `UNSUPPORTED_LANGUAGE` | `preferredLanguage` |

## Legacy thin API codes

The backward-compatible `/plan` and `/result` actions continue to use flat `{ error, code }` bodies (`auth_error`, `invalid_body`, `not_found`, etc.) so existing clients remain unchanged.
