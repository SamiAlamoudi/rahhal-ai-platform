# Sprint 119 — Rahhal Experience Phase 1 (UI Foundation)

**Type:** Presentation architecture only (`src/ui`)  
**Not an AI engine sprint** — no Decision Engine / Providers / Pipeline / Streaming / Editing changes.

## Objective

Expose existing Rahhal AI capabilities later through a premium UI foundation. Phase 1 ships **architecture + design tokens + presentational shells** only.

## Structure

```
src/ui/
  tokens/     Design tokens (spacing, radius, typography, elevation, animation, sizes)
  layout/     HomeExperience + section shells
  chat/       ConversationScreen + bubbles + input + placeholders
  cards/      Flight/Hotel/Package/Itinerary/Activity/Recommendation/Warning/Savings/Confidence/Comparison
  timeline/   Timeline, TimelineItem, TimelineDay, TimelineEvent, TimelineStatus
  loading/    Skeleton, Progress, StreamingPlaceholder, Empty/Error/Retry
  common/     UiSurface, UiStack, UiText, UiButton
  feature.ts  ui.experience_v1
  index.ts
```

## Home experience (architecture only)

Sections (slot-based — **no mock data generation**):

- Greeting
- Recent Trips
- Suggested Destinations
- Continue Conversation
- Upcoming Trips
- Quick Actions

## Architecture rules

- Presentation only
- No business logic
- No API / provider / engine access
- Reusable components
- Tokenized spacing / type / elevation / motion (no hardcoded call-site magic values)

## Feature flag

`ui.experience_v1` — **default OFF**

## Verify

```bash
npm run ui:verify
```
