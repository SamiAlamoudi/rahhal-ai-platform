# Multi Provider Architecture

Rahhal must **never depend on a single travel supplier**.

## Architecture

```text
TravelConversation / SearchWorkspace  (unchanged)
  └─ orchestrateLiveSearch
       └─ FlightService / HotelService / RentalCarService / ActivityService
            └─ executeProviderChain(domain)
                 └─ MultiProviderRegistry (ordered adapters)
                      ├─ Duffel          (prepared)
                      ├─ Travelport      (prepared)
                      ├─ Sabre           (prepared)
                      ├─ Amadeus Ent.    (live when configured)
                      └─ Mock            (always)

Admin Dashboard
  └─ MultiProviderHealthCard ← ProviderHealthMonitor
```

## Provider registry

| Domain | Default chain |
|--------|----------------|
| Flight | `duffel → travelport → sabre → amadeus_enterprise → mock` |
| Hotel | `booking → expedia → hotelbeds → mock` |
| Cars | `rentalcars → mock` |
| Activities | `viator → getyourguide → mock` |
| Transfers | `mock` |

Configure via:

```bash
VITE_MULTI_PROVIDER_ENABLED=true
VITE_FLIGHT_PROVIDER_CHAIN=duffel,travelport,sabre,amadeus_enterprise,mock
```

## Fallback flow

```text
Try provider N
  ├─ success + offers → return (source: real | mock | fallback)
  └─ failure?
       ├─ timeout
       ├─ authentication
       ├─ quota / rate-limit
       ├─ unavailable / not_configured
       └─ empty / error
            → automatically try provider N+1
```

Prepared (not-yet-credentialed) adapters fail closed with `not_configured` and are skipped without marking the search as a hard fallback.

## Health monitor

Exposed fields per provider:

| Field | Meaning |
|-------|---------|
| Connected | Last successful response |
| Latency | Last attempt latency (ms) |
| Errors | Failure count |
| Fallback count | Times this slot caused chain advance |
| Quota status | `ok` \| `limited` \| `exhausted` \| `unknown` |

Admin: **Multi Provider Health** card.  
Programmatic: `getProviderHealthMonitor().report()`.

## Prepared adapters

| Supplier | Status |
|----------|--------|
| Duffel | Prepared stub — wire credentials next |
| Travelport | Prepared stub |
| Sabre | Prepared stub |
| Amadeus Enterprise | Live via existing Amadeus Edge token proxy |
| Booking.com | Live when RapidAPI key set |
| RentalCars | Live when API key set |
| Viator / GetYourGuide | Prepared stubs |
| Mock | Always available safety net |

## Next production provider recommendation

**Duffel** for flights — modern NDC/GDS aggregation API, cleaner auth than classic GDS, strong sandbox, and already present as a mock id in the agent aggregation layer. Wire Duffel live credentials into the prepared `duffel` slot first; keep Amadeus Enterprise as secondary and Mock as terminal fallback.

## Conversation / session

`TravelConversation` and `travelSession` are **unchanged**. Multi-provider runs underneath `orchestrateLiveSearch` only.
