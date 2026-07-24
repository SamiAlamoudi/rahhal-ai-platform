# Operations Center — Architecture Notes

**Package:** `src/ui/operationsCenter/`

```mermaid
flowchart TB
  Registry[operationsCenterRegistry]
  Root[OperationsCenter]
  Registry -->|gate| Root
  Root --> Toolbar[OperationsToolbar]
  Root --> Overview[OperationsOverview]
  Root --> Queues[QueuesAndIncidents]
  Root --> Providers[ProvidersAndWorkload]
  State[operationsCenterState] -.-> Root
  Tokens[operationsCenterTokens] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| Runtime / AI / Realtime | Not wired |
| Database / Firebase / Notifications | Not wired |
| Booking APIs / Maps / Payments / Auth | Not wired |
| RTL + light/dark + reduced motion | Yes |
