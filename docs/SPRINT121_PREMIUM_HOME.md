# Sprint 121 — Premium Home Experience (Production)

**Type:** Presentation only (`src/ui/home` + `ProductionHomeScreen` polish)  
**Does not** modify AI engines, orchestration, pipeline, itinerary, memory, search, or backend APIs.

## Objective

Ship the first real production Home experience for Rahhal — a premium AI travel product surface — using Sprint 119 UI foundation and Sprint 120 production data integration.

## Structure

```
src/ui/home/
  homeTheme.ts              # tokens helpers, section inventory, motion
  HomeSection.tsx           # reusable section shell
  HomeSkeleton.tsx          # loading state
  HeroSection.tsx           # brand-first AI greeting
  ConversationEntry.tsx
  ContinueConversation.tsx
  RecentTripsCard.tsx
  UpcomingTrips.tsx
  SuggestedDestinations.tsx
  TravelInspiration.tsx
  RecommendedActions.tsx
  QuickActions.tsx
  SmartSearchEntry.tsx
  FeaturedExperiences.tsx
  feature.ts
  index.ts

src/ui/integration/ProductionHomeScreen.tsx
  → composes home sections with loadProductionHomeData()
```

## Sections

| Section | Source data |
|---------|-------------|
| Hero AI greeting | `greeting`, `memoryInsights[0]` |
| Conversation entry | navigation to `/chat` |
| Continue conversation | `continueConversation` |
| Recent trips | `recentTrips` |
| Upcoming trips | `upcomingTrips` |
| Suggested destinations | `suggestedDestinations` |
| Travel inspiration | `memoryInsights`, `travelHistory.notes` |
| Recommended actions | `personalizedRecommendations` |
| Quick actions | fixed routes + `recentConversations` |
| Smart search entry | navigation to `/search` |
| Featured experiences | `travelHistory` fields only |

Empty / loading / error states reuse Sprint 119 `EmptyState`, `HomeSkeleton`, `ErrorState`, `RetryState`.

## Architecture rules

- Presentation only — no mock APIs, no fake content, no hardcoded business logic.
- Compose existing `loadProductionHomeData` / Memory / Trips / Chat surfaces.
- Do not change navigation routes (`/chat`, `/search`, `/my-trips`).
- Avoid importing the `src/ui` barrel from `src/ui/home` or `src/ui/integration` (circular-deps safe).

## Feature flag

`ui.premium_home` — **default OFF** (depends on `ui.production_integration`).

Home routing remains gated by `ui.production_integration`. Premium sections are the Production Home presentation layer.

## Verify

```bash
npm run ui:verify
```
