# Travel Workspace — Architecture Documentation

**Phase 4 Stage 5** · Package `src/ui/travelWorkspace`

```mermaid
flowchart TB
  Registry[travelWorkspaceRegistry<br/>ui.travel_workspace]
  Root[TravelWorkspace]
  Registry -->|gate| Root

  Root --> Overview[TripOverview + TripStatus]
  Root --> Quick[QuickActions]
  Root --> Dash[Dashboard]
  Root --> Timeline[TripTimeline]
  Root --> Cards[Flight/Hotel/Transport/Meeting/Activity/Ticket/QR]
  Root --> Side[Travelers / Documents / Progress / Stats]
  Root --> Misc[Map / Notes / Attachments / Checklists / Shared]

  State[createDemoTravelWorkspaceState] -.-> Root
  Tokens[workspaceTokens light/dark] -.-> Root
```

## Isolation matrix

| Surface | Wired? |
|---------|--------|
| Production routes | No |
| Runtime Coordinator | No |
| Conversation Orchestrator | No |
| Conversation / Voice / Knowledge Centers | No (quick-action buttons only) |
| Planning / AI / Search / Decision / Intelligence / Experience | No |
| Amadeus / booking / payments / APIs | No |

## Quick actions

Buttons emit optional callbacks: Open Chat · Open Voice · Open Knowledge · View Documents · Open Maps · Contact Support · Share Trip · Export PDF — **no runtime embedding**.
