# Itinerary Architecture — Phase 6 Stage 3

**Contracts:** `ItineraryGeneratorContract`, `ScheduleOptimizerContract`, day blocks

## Shape

- `ItineraryDayContract` — `dayIndex`, `label`, `blocks[]`
- Generator returns empty `days` by default (`execution: 'none'`)
- Schedule optimizer exposes objectives/conflicts only — no optimization run

## Related planners

| Planner | Role |
|---------|------|
| Transportation | Leg hints |
| Accommodation | Stay hints |
| Activity | Day-indexed activity hints |
| Alternative Generator | Tradeoff labels |
| Scenario Builder | Assumption sets |

No booking, maps, or weather data attached.
