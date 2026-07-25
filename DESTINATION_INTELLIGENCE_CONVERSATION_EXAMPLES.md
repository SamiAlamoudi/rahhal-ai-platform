# Destination Intelligence — Conversation Examples (Sprint 5)

Flag `ai.integration_destination_intelligence` remains **OFF** by default.

---

## Example 1 — Open-ended (no booking)

**Traveler:** Where should I travel?

**Rahhal (flag ON):**
```
I’d start with Istanbul — matches your interest in culture & food. Best months: 4, 5, 6, 9, 10.
Weather: Flexible layers recommended.
Local spend ~… SAR/person/day …
Tip: … · Avoid: …
Alternative: Rome if you want a different tone (…/100).
```

No flight/hotel search required. Traveler can continue into planning later.

---

## Example 2 — Arabic open-ended

**Traveler:** أين أسافر؟ ميزانيتي متوسطة وأحب الشاطئ

**Rahhal:** يقترح وجهة شاطئية ملائمة للميزانية مع بديل، ملخص طقس، ونصيحة محلية قصيرة — بدون موسوعة.

---

## Example 3 — Comparison

**Traveler:** Casablanca vs Marrakech

**Rahhal:**
```
Casablanca vs Marrakech: Casablanca is a modern business + coastal hub; Marrakech is culture, souks, and atmosphere.
Choose Casablanca for business… Choose Marrakech for culture… Score: …
```

Same pattern for `Paris vs Rome` and `Tokyo vs Seoul`.

---

## Example 4 — Family / Business / Luxury cues

| Traveler cue | Matching emphasis |
|---|---|
| Family + kids | `family` / beach / culture themes; Dubai & Istanbul score high |
| Business Casablanca | `business` theme + city logistics |
| Luxury beach | Maldives / Dubai luxury themes + high daily band |

---

## Example 5 — Flag OFF (regression)

**Traveler:** Where should I travel?

**Behavior:** Legacy `ai.travel_reasoning` / intake path unchanged. Destination Intelligence package is not loaded for the turn when the gate is false.
