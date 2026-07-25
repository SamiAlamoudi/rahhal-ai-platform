# Live Flight Search — Conversation Examples (Sprint 2)

Feature flag `ai.live_flight_search` remains **OFF** by default. Examples below describe the intended staged behavior when ON.

---

## Example 1 — Natural Morocco trip

**Traveler:** I want to travel to Morocco next week.

**Rahhal (extract):**
- Destination: Morocco → RAK/CMN resolution
- Dates: +7 days, `datesFlexible=true`
- Asks only if origin / travelers missing

**After origin + travelers known → flights tool:**
- Live Amadeus search (or mock fallback)
- Ranked options with WHY
- Consultant summary (Arabic or English), never raw JSON

---

## Example 2 — Arabic Gulf dialect + preferences

**Traveler:** أبغى أسافر المغرب الأسبوع القادم درجة رجال الأعمال على الخطوط السعودية صباحاً مع طفلين

**Extracted:**
- Destination: المغرب
- Cabin: business
- Airline: SV
- Departure window: morning
- Children: 2
- Flexible dates: true

**Reply shape (illustrative):**
```
لرحلتك RUH → RAK ذهاب فقط بتاريخ 2026-08-01، هذه أفضل الخيارات مرتبة لك:
1) SV — … — مباشرة — … السبب: شركة الطيران المفضلة لديك · وقت إقلاع يناسب تفضيلك · …
أقترح نبدأ بالخيار الأول إن ناسبك، أو نضيّق حسب الميزانية أو شركة الطيران.
```

---

## Example 3 — Missing information only

**Traveler:** Book me flights to Dubai.

**Rahhal:** Asks origin and dates (and travelers if unknown) — not an interview checklist. Hotel/visa not forced for flights-only intent.

---

## Example 4 — Provider outage

Live Amadeus returns 503 → conversation continues with mock ranked offers + soft note that live inventory is temporarily unavailable; traveler can retry.

---

## Non-goals (this sprint)

- No UI redesign / no search forms required for `/chat`
- No live hotel provider
- No booking/payment execution
