# Live Hotel Search — Conversation Examples (Sprint 3)

Feature flag `ai.live_hotel_search` remains **OFF** by default. Examples describe staged behavior when ON.

---

## Example 1 — Minimal ask

**Traveler:** I want a hotel in Casablanca.

**Rahhal:** What dates?  
(Does **not** ask rooms/amenities/class unless needed.)

**Traveler:** 10–14 September, two adults.

**Rahhal:** Ranked consultant summary with WHY — e.g. breakfast, free cancellation, fits budget — never a raw provider dump.

---

## Example 2 — Arabic with filters

**Traveler:** أبغى فندق في الدار البيضاء غرفتين مع إفطار ومسبح وإلغاء مجاني وسط المدينة

**Extracted:** destination, rooms=2, breakfast, pool, free cancellation, central area.

**Reply shape (illustrative):**
```
لإقامتك في الدار البيضاء من … إلى …، هذه أفضل الخيارات مرتبة لك:
1) Casa Business Suites 5★ — 650 SAR/ليلة. السبب: يشمل الإفطار · إلغاء مجاني · موقع يناسب تفضيلك · …
أقترح نبدأ بالخيار الأول إن ناسبك، أو نفلتر (إفطار / إلغاء مجاني / مسبح).
```

---

## Example 3 — Business traveler

**Traveler:** Business hotel near the meeting area in Dubai, gym and wifi, free cancellation.

**Rahhal:** Ranks with business/gym/wifi/cancellation reasons; asks only for missing check-in/out if unknown.

---

## Example 4 — Provider outage

Live Amadeus returns 429 → conversation continues with mock ranked stays + soft note; traveler can retry.

---

## Non-goals

- No hotel booking forms / UI redesign
- No live payment / order execution in this sprint
