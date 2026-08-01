# Sprint 80 P2 — Live Flight E2E Validation Report

**Version:** 1.0.0-live-flight-p2-validation
**Generated:** 2026-08-01T01:24:18.886Z
**Mode:** mock
**Scenario:** Riyadh → Casablanca (round trip) (`ruh-cmn-roundtrip`)

## Gate

| Field | Value |
| --- | --- |
| Allowed | true |
| Deploy target | staging |
| Production blocked | false |
| Reason | Allowed for development/staging (feature flags still OFF by default) |

## Authentication

- Token acquired: **true**
- Token refresh exercised: **true**
- Detail: Mock runLive injected (CI / no network)

## Field integrity

| Check | Status |
| --- | --- |
| authentication | present |
| tokenRefresh | present |
| requestMapping | present |
| responseNormalization | present |
| pricingIntegrity | present |
| carrierData | present |
| baggage | null |
| fareFamilies | null |
| cabinClasses | present |

## Pilot vs legacy

| Side | ok | empty | offers | searchEngine | usedLive |
| --- | --- | --- | --- | --- | --- |
| Pilot | true | false | 2 | liveFlightSearch | true |
| Legacy | true | false | 3 | flightSearchEngine | n/a |

## Differences (every recorded delta)

| Path | Pilot | Legacy | Severity | Note |
| --- | --- | --- | --- | --- |
| `searchEngine` | "liveFlightSearch" | "flightSearchEngine" | info | Expected when pilot used live Amadeus vs legacy mock engine |
| `usedLive` | true | null | info | Pilot live marker vs legacy path |
| `offers.length` | 2 | 3 | warn | Inventory count differs between pilot and legacy |
| `offers[0].id` | "amd_p2_1" | "mock_flight_RUH_CMN_0" | info | Inventory-specific value (expected to differ across providers) |
| `offers[0].airline` | "SV" | "Saudia" | info | Inventory-specific value (expected to differ across providers) |
| `offers[0].flightNumber` | "SV" | "SV100" | info | Inventory-specific value (expected to differ across providers) |
| `offers[0].cabin` | "ECONOMY" | "economy" | warn | Field mismatch for cabin |
| `offers[0].durationMinutes` | 390 | 620 | info | Inventory-specific value (expected to differ across providers) |
| `offers[0].price` | 1450 | 2400 | info | Inventory-specific value (expected to differ across providers) |
| `offers[0].baggage` | null | "1 PC" | warn | Field mismatch for baggage |
| `offers[0].fareFamily` | null | "standard" | warn | Field mismatch for fareFamily |
| `offers[0].provider` | "amadeus" | "mock" | info | Inventory-specific value (expected to differ across providers) |
| `offers[0].arrivalTime` | "2026-09-15T14:30:00Z" | "2026-09-15T18:20:00Z" | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].id` | "amd_p2_2" | "mock_flight_RUH_CMN_1" | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].airline` | "AT" | "ANA" | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].flightNumber` | "AT" | "SV101" | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].cabin` | "ECONOMY" | "economy" | warn | Field mismatch for cabin |
| `offers[1].durationMinutes` | 450 | 710 | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].price` | 1180 | 2100 | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].baggage` | null | "1 PC" | warn | Field mismatch for baggage |
| `offers[1].fareFamily` | null | "standard" | warn | Field mismatch for fareFamily |
| `offers[1].provider` | "amadeus" | "mock" | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].departureTime` | "2026-09-15T19:00:00Z" | "2026-09-15T09:30:00Z" | info | Inventory-specific value (expected to differ across providers) |
| `offers[1].arrivalTime` | "2026-09-16T02:30:00Z" | "2026-09-15T21:20:00Z" | info | Inventory-specific value (expected to differ across providers) |
| `usedLive` | true | undefined | info | Present only on pilot payload |
| `cacheHit` | false | undefined | info | Present only on pilot payload |
| `consultantSummaryAr` | "لرحلتك RUH → CMN ذهاب وعودة (عودة 2026-09-22) بتاريخ 2026-09-15، هذه أفضل الخيارات مرتبة لك:\n1) SV — 1450 SAR — مباشرة — 6.5 ساعة. السبب: مدة رحلة قصيرة نسبياً · مباشرة بدون توقف · مريحة ومرنة للإلغاء · قابل للاسترداد.\n2) AT — 1180 SAR — توقف واحد — 7.5 ساعة. السبب: سعر مناسب ضمن الخيارات · توقف واحد فقط.\nأقترح نبدأ بالخيار الأول إن ناسبك، أو نضيّق حسب الميزانية أو شركة الطيران." | undefined | info | Present only on pilot payload |
| `consultantSummaryEn` | "For RUH → CMN round-trip (return 2026-09-22) on 2026-09-15, here are the best options ranked for you:\n1) SV — 1450 SAR — non-stop — 6.5h. Why: Relatively short travel time · Non-stop flight · Convenient and flexible · Refundable fare.\n2) AT — 1180 SAR — 1 stop — 7.5h. Why: Competitive price among options · Only one stop.\nI'd start with option 1 if it fits — or we can filter by budget or airline." | undefined | info | Present only on pilot payload |
| `coverage.baggage` | 0 | 3 | warn | Count of offers with baggage data differs |
| `coverage.fareFamily` | 0 | 3 | warn | Count of offers with fare family data differs |

## Latency

| Metric | ms |
| --- | --- |
| Provider response | 0 |
| Normalization | 1 |
| Total pilot search | 1 |
| Legacy search | 3 |

## Telemetry rates

| Rate | Value |
| --- | --- |
| Success rate | 1 |
| Timeout rate | 0 |
| Auth failure rate | 0 |
| Empty response rate | 0 |
| Provider error rate | 0 |
| Fallback rate | 0 |
| Searches | 1 |

## Feature flags

- `ai.live_flight_provider_pilot` — **OFF by default** (production hard-blocked)
- `ai.conversational_provider_unify` — OFF by default
- `ai.live_flight_search` — OFF by default

## Untouched systems

Voice · STT/TTS · Chat Engine · Memory · Booking · Payments


> Generated in mock mode (Amadeus credentials were not available in this environment). Re-run with staging secrets for live results.
