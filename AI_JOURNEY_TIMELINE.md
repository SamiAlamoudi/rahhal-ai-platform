# AI Journey Timeline — Phase 5 Stage 1

**Status:** Additive presentation · Flag `ui.journey_timeline` **default OFF**  
**Depends on:** `ui.application_shell`  
**Freeze:** Production · AI · Runtime Coordinator · Booking/Maps/Weather APIs · realtime · notifications · prior PRs.

Premium journey timeline from departure through return — **UI only**.

## Timeline steps

Departure · Airport · Check-in · Security · Boarding · Flight · Arrival · Transportation · Hotel · Meetings · Lunch · Dinner · Activities · Return

## Statuses

Completed · Current · Upcoming · Delayed · Cancelled · Recommended

## Event cards

Flights · Hotels · Transportation · Documents · Visa · Insurance · Weather/Currency/Maps **placeholders** · Meeting · Restaurant · Activities

## Smart layouts

Vertical · Horizontal · Compact · Daily · Weekly

## Progress

Journey progress bar · trip completion · current step · remaining time · step rail

```mermaid
flowchart TD
  Flag{ui.journey_timeline}
  Flag -->|OFF| Null[Not rendered]
  Flag -->|ON demo/tests| JT[JourneyTimeline]
  JT --> Progress[JourneyProgress]
  JT --> Board[TimelineBoard]
  Board --> Cards[EventCard]
  JT -.->|never| APIs[Maps / Weather / Booking / AI]
```

Force-render: `<JourneyTimeline enabled />`.
