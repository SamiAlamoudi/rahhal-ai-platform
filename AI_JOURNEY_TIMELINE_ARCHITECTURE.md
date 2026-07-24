# Journey Timeline — Architecture Notes

**Package:** `src/ui/journeyTimeline/`

```mermaid
flowchart TB
  Registry[journeyTimelineRegistry]
  Root[JourneyTimeline]
  Registry -->|gate| Root
  Root --> Layouts[Layout switcher]
  Root --> Progress[JourneyProgress]
  Root --> Board[TimelineBoard]
  Board --> Card[EventCard]
  State[journeyTimelineState] -.-> Root
  Tokens[journeyTokens light/dark] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| AI / Runtime Coordinator | Not wired |
| Booking / Maps / Weather APIs | Not wired (placeholders only) |
| Realtime / notifications / backend | None |
| RTL + light/dark + reduced motion | Yes |
