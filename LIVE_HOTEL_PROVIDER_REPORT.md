# Live Hotel Provider Report — Integration Sprint 3

**Branch:** `cursor/live-hotel-search-7518`  
**Generated:** 2026-07-25  

---

## Provider interface

Business logic does **not** couple to Amadeus. Conversation tools call:

1. `runConversationAwareHotelSearch`
2. → `runLiveHotelSearch` / Provider Gateway / `TravelProvider.searchHotels`
3. → Amadeus hotel adapter **or** mock fallback

Future providers (Booking.com, Hotelbeds) remain behind Provider Runtime / contracts (`HotelProvider`).

---

## Live hotel capabilities (wired)

| Capability | Status |
|---|---|
| OAuth / token refresh | Reused Amadeus OAuth (`api/amadeus-token`) |
| City / hotel list | Amadeus by-city locations |
| Hotel offers / availability | `v3/shopping/hotel-offers` |
| Price + currency | Normalized |
| Photos | `images[]` when present |
| Amenities | Normalized string list |
| Cancellation | `freeCancellation` / refundable |
| Meal plans / board | `boardType` (breakfast inference) |
| Room types | `roomType` when present |
| Adults / children / rooms | Forwarded |

---

## Normalization + ranking

Ranked conversation stays include: price, rating, stars, location/distance, reviews, amenities, cancellation, breakfast — plus **WHY** reasons in AR/EN.

---

## Error handling

| Failure | Behavior |
|---|---|
| Flag OFF | Mock engine only |
| Rate limit / unavailable / timeout | Live error → mock fallback |
| Empty live results | Fallback mock when enabled |
| Missing optional fields | Soft defaults; never crash |

---

## Caching

| Layer | TTL |
|---|---|
| Conversation bridge | 15 min |
| Hotel Search Engine | 15 min (`hotels` namespace) |
