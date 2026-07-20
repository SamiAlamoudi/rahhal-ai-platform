# Sprint 42 — Conversation Experience & Booking UX

Production conversation experience for Rahhal. **Presentation layer only** — reuses Sprint 28/32–35 engines without creating new backend engines.

## Non-goals (strict)

- Do not create new AI / booking / payment / trip / refund / disruption / loyalty / visa / marketplace / finance engines
- Do not replace Sprint 32 `ConversationController`, Sprint 33 `TravelExecutionEngine`, Sprint 34 `PaymentOrchestrator`, or Sprint 35 `PostBookingService`
- Do not change hosted `src/lib/payment/` Moyasar checkout freeze behavior
- Do not enable live PSPs (`VITE_PAYMENT_PROVIDER` stays `mock`)
- Do not invent voice engine changes (voice-ready architecture only)

## Architecture

```
ChatPage / MessageBubble
  → ConversationExperiencePanel (when ui.conversation_experience ON)
       ├─ Travel cards (flight / hotel / car / activity / visa / insurance)
       ├─ SmartActionsBar → existing chatEngine / conversation commands
       ├─ BookingActionsBar → ConversationBookingBridge
       │     ├─ TravelExecutionEngine.reserve (Sprint 33)
       │     ├─ PaymentOrchestrator.pay (Sprint 34)
       │     └─ PostBookingService.createFromPayment / cancel / refund / docs (Sprint 35)
       ├─ TripTimelinePanel ← TripLifecycleTimeline + execution timeline
       ├─ LiveNotificationsBanner ← ConversationLiveNotificationBus (Sprint 35 triggers)
       ├─ MemoryChips ← Sprint 28 memory shapes on providerMeta
       └─ MapPreview (OSM presentation helpers; no new maps engine)
```

| Module | Responsibility |
|--------|----------------|
| `conversationExperienceUi/*` | Presentation adapters + booking bridge |
| `components/chat/experience/*` | Cards, actions, timeline, notifications, maps, virtualization |
| `MessageBubble` / `ChatPage` | Wire structured meta + theme + live updates |

## Feature flag (default **OFF**)

| Alias | Registry ID | Depends on |
|-------|-------------|------------|
| `conversation_experience` | `ui.conversation_experience` | `brain.conversation_ui` |

When OFF, ChatPage keeps the previous markdown + Travel Agent itinerary actions path.

## UX capabilities

- Mobile-first / desktop responsive conversation shell
- Streaming + typing indicator
- Markdown / code blocks (existing)
- Attachments + image/document previews
- Rich travel cards with Book / Reserve / Purchase actions
- In-conversation Reserve · Pay · Cancel · Refund · View Documents · Open Trip
- Trip timeline statuses: Upcoming / Booked / Paid / Checked-in / Completed / Cancelled / Refunded
- Live notifications (delay, gate, refund, supplier, visa, documents) without page refresh
- Map previews (hotel, airport, activity, car pickup, multi-stop)
- Smart action chips + remembered preference chips
- Light / dark / high-contrast themes, RTL, keyboard + screen-reader labels
- Lazy images, memoized cards, virtualized message list for long threads

## Modules

- `src/lib/chat/conversationExperienceUi/`
- `src/components/chat/experience/`

## Tests

`src/lib/__tests__/conversationExperience.sprint42.test.ts`
