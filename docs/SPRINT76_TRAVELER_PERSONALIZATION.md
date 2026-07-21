# Sprint 76 — Traveler Personalization Intelligence

**Type:** Additive enrichment layer  
**Depends on:** Conversation Flow · Flight/Hotel Search Engines · Budget Intelligence · Booking Intelligence · Provider Runtime

## Goal

Let Rahhal remember traveler preferences across conversations and improve ranking with gradual confidence — conversation only, no forms.

## Architecture (additive)

```
User utterance
    ↓
Preference parse + gradual learning (mock profile store)
    ↓
Flight / Hotel Search Engines (optional offers)
    ↓
Budget Intelligence (Sprint 75)
    ↓
Traveler Personalization (Sprint 76)  ← NEW
    ├── preference-weighted flight/hotel ranking
    └── diagnostics (profile · confidence · adjustments · learning)
    ↓
Booking Intelligence → Conversation Brain
```

No RahhalBrain redesign. No search engine replacement. No database integration (mock storage abstraction only).

## Traveler profile

Preferred airlines · alliances · cabin · seat · meals · hotel chains · min stars · room type · smoking · budget history · trip style (business / leisure / family / luxury / adventure) · favorite destinations · preferred departure airports · loyalty programs (placeholder)

Each preference stores a **confidence score** (0–1). Repeats reinforce; conflicts decay before replace.

## Conversation understanding

- “I always fly Qatar Airways.”
- “I prefer Marriott hotels.”
- “I like window seats.”
- “Business class only.”
- “I prefer direct flights.”
- “I never stay below 4 stars.”
- “My wife prefers king beds.”
- “I normally travel for business.”
- “I avoid…” / “Never book…” / “I don’t like…”

## Diagnostics

`travelerProfileUsed` · `matchedPreferences` · `confidenceScores` · `rankingAdjustments` · `learningEvents` · `missingProfile`

## Module

`src/lib/agent/travelerPersonalization/`

Feature flag: `ai.traveler_personalization` (default **ON**, depends on `ai.autonomous_agent`)

Verify: `npm run personalization:verify`

## Example conversation

> User: I always fly Qatar Airways.  
> Rahhal: (learns airline preference, confidence ~0.35)  
> User: I prefer Marriott hotels and direct flights. Plan Riyadh to Dubai next month, budget SAR 6000.  
> Rahhal: searches → Budget Intelligence allocates → Personalization boosts Qatar + Marriott + direct → reply includes preference-aware ranking facts.

## Known limitations

- Mock in-memory store only (abstraction ready for future persistence).
- Loyalty programs are placeholders (names only).
- Personalization ranking runs after Budget Intelligence; does not rewrite Budget Score internals.

## Next recommendations

1. Persist profiles via Supabase behind `TravelerProfileStore`.
2. Feed personalization deltas into Booking Intelligence fusion weights.
3. Multi-traveler household profiles (spouse seat/bed prefs).
