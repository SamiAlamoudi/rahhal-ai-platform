# Travel Context — Phase 7 Stage 5

## Facets

| Contract | Role |
|----------|------|
| `TravelContextContract` | Facet catalog for trip-related slices |
| `CurrentTripContextContract` | Current trip (`tripIdHint: null` in blueprints) |
| `DestinationContextContract` | Destination hints |
| `TransportationContextContract` | Mode hints |
| `AccommodationContextContract` | Lodging hints |
| `ActivityContextContract` | Activity hints |
| `VisaContextContract` | Available-document hints |
| `WeatherContextContract` | Weather hints |
| `CompanionContextContract` | Companion hints |
| `TimelineContextContract` | Date hints |
| `BudgetContextContract` | Currency hint; `amountHint: null` |

Travel context is **live situation** data — not Memory history.
