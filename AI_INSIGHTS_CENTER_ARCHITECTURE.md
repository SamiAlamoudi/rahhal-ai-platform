# Insights Center — Architecture Notes

**Package:** `src/ui/insightsCenter/`

```mermaid
flowchart TB
  Registry[insightsCenterRegistry]
  Root[InsightsCenter]
  Registry -->|gate| Root
  Root --> Filters[InsightsFilters]
  Root --> Stats[StatisticsGrid]
  Root --> Budget[BudgetPanel]
  Root --> Places[PlacesPanel]
  Root --> Health[HealthAndPlaceholders]
  State[insightsCenterState] -.-> Root
  Tokens[insightsTokens] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| Analytics engine / AI reasoning | None |
| Runtime / Booking / Maps / Weather / Notifications | Not wired |
| Backend / realtime | None |
| RTL + light/dark + reduced motion | Yes |
