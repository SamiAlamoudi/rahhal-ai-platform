# Action Execution — Flow Diagram (Sprint 11)

**Branch:** `cursor/action-execution-layer-7518`  
**Draft PR:** [#275](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/275)  
**Flag:** `ai.integration_action_execution` (default OFF)

```
Traveler utterance
        │
        ▼
┌───────────────┐
│    Intent     │  book_flight / reserve_hotel / save / share /
│               │  cancel_booking / modify_booking · confirm / decline
└───────┬───────┘
        ▼
┌───────────────┐
│  Validation   │  trip plan / flight / hotel presence checks
└───────┬───────┘
        ▼
┌───────────────┐
│ Confirmation  │  required for booking · cancellation ·
│     Gate      │  modification · payment
└───────┬───────┘
        │
   ┌────┴────┐
   │         │
 pending   confirmed
 (preview)  / no gate
   │         │
   ▼         ▼
 dry_run /   mock provider execution
 preview     (Provider Runtime mock only)
   │         │
   └────┬────┘
        ▼
┌───────────────┐
│    Result     │  reference · orderId · liveBlocked
└───────┬───────┘
        ▼
┌───────────────┐
│  Conversation │  AR/EN consultant summary
│    Summary    │  + execution memory update
└───────────────┘
```

**Live path:** prepared (`amadeusBooking` / hotel / car / payment) but **always blocked** until a future sprint.
