# Booking Hub — Architecture Notes

**Package:** `src/ui/bookingHub/`

```mermaid
flowchart TB
  Registry[bookingHubRegistry]
  Root[BookingHub]
  Registry -->|gate| Root
  Root --> Toolbar[BookingToolbar]
  Root --> Overview[BookingOverview]
  Root --> Services[ServicesPanel]
  Root --> Docs[DocumentsFinance]
  Root --> Timeline[TimelineProviders]
  State[bookingHubState] -.-> Root
  Tokens[bookingHubTokens] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| Booking APIs / Amadeus / Payments / Maps | Not wired |
| AI / Runtime / Database / Firebase | Not wired |
| Realtime / Notifications | Not wired |
| RTL + light/dark + reduced motion | Yes |
