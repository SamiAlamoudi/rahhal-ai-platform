# Domain naming policy — Bilamo brand vs technical domain

## 1. Bilamo is a product brand

**Bilamo / بيلامو** is the only public-facing product name. It must appear in traveler UI, marketing, metadata, and branded shells.

## 2. Where Bilamo may appear

Allowed:

- Product copy and UI branding components (`Logo`, hero, auth shells)
- Brand assets and design tokens (`brand.name`)
- Metadata / SEO / manifests / `index.html` title
- Marketing and promotional surfaces
- Product-specific presentation adapters under `src/lib/bilamo/**` when they are intentionally brand shells
- Intentionally branded analytics / ops display labels (prefer domain names when possible)

## 3. Core technical code should use domain names

Application, conversation/AI runtime, travel domain, providers, and infrastructure must prefer stable domain-driven identifiers — **not** Rahhal and **not** Bilamo prefixes — whenever a safe rename exists.

Target layering:

```
Bilamo Brand and Product Experience
        ↓
Application Layer
        ↓
Conversation and AI Runtime
        ↓
Travel Domain
        ↓
Providers and Infrastructure
```

## 4. Forbidden brand-coupled domain names (new code)

Do **not** introduce:

- `BilamoOrder`
- `BilamoRevenue`
- `BilamoFlightOffer`
- `BilamoHotelOffer`
- `BilamoBrain`
- `BilamoBookingService`
- `BilamoBookingOrder`

when a stable domain name exists.

`scripts/branding-inventory.mjs` fails CI on these identifiers outside product presentation paths.

## 5. Recommended vocabulary

### AI and conversation

- `ConversationEngine`
- `ReasoningEngine`
- `AgentRuntime`
- `ToolRouter`
- `MemoryService`
- `IntentDetector`
- `EntityExtractor`
- `ClarificationPlanner`
- `ResponseComposer`

### Travel

- `FlightOffer`
- `HotelOffer`
- `TransferOffer`
- `TravelOffer`
- `Trip`
- `Itinerary`
- `Passenger`
- `Reservation`
- `BookingOrder`
- `Quote`
- `Fare`
- `SearchRequest`
- `SearchResult`

### Platform

- `PricingEngine`
- `RecommendationEngine`
- `BookingService`
- `PaymentGateway`
- `NotificationService`
- `AnalyticsService`
- `ProviderAdapter`
- `SearchOrchestrator`
- `PlatformRevenue`

## 6. Legacy Rahhal identifiers

Existing `Rahhal*` / `rahhal*` / `RAHHAL_*` symbols are **compatibility or internal debt**. They are tracked by `scripts/branding-allowlist.json` and migrated via [`BRAND_SEPARATION_MIGRATION_ROADMAP.md`](./BRAND_SEPARATION_MIGRATION_ROADMAP.md). Do not expand their use.

## 7. Guardrails

| Tool | Role |
|------|------|
| `npm run branding:check` | Inventory + CI ban on unauthorized legacy / brand-coupled names |
| `scripts/branding-allowlist.json` | Reviewed compatibility / internal allowlist |
| Code review | Reject new `Rahhal*` exports and new `Bilamo*` domain models |

## 8. Constants preference

Prefer neutral constants over brand swaps:

| Avoid | Prefer |
|-------|--------|
| `RAHHAL_*` → `BILAMO_*` | `CONVERSATION_SYSTEM_PROMPT`, `BOOKING_FEE`, `SERVICE_FEE`, `PLATFORM_VERSION`, `PRODUCT_PRINCIPLES` |
