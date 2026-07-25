# Maps & Live Mobility — Provider Diagram (Sprint 8)

**Draft PR:** _(pending)_

---

## Map Provider Abstraction

```mermaid
flowchart LR
  A[planTurn / traveler ask] --> B{ai.integration_maps_mobility}
  B -->|OFF| Z[No-op]
  B -->|ON| C[MapProvider interface]
  C --> D[MockMapProvider default]
  C --> E[LiveGoogleMapsProvider optional]
  E --> F{Injected GoogleMapsApiClient?}
  F -->|No| D
  F -->|Yes| G[geocode / places / distance matrix]
  D --> H[Spatial context + routes + nearby]
  G --> H
  H --> I[Consultant summary + meta]
```

---

## Capabilities

| Capability | Mock | Live (injected) |
|---|---|---|
| Geocode | yes | yes (fallback mock) |
| Reverse geocode | yes | yes |
| Nearby | curated catalog | place search |
| Route + modes | haversine ETA | distance matrix |
| Leave-by | yes | yes |
| GPS hardware | no | no |
| UI map canvas | no | no |
