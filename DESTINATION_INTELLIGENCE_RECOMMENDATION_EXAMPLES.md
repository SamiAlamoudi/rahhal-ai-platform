# Destination Intelligence — Recommendation Examples (Sprint 5)

**Draft PR:** [#270](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/270)

Illustrative outputs from the advisor engine (mock weather · curated knowledge).

---

## Budget midrange · culture + food

**Input:** budget 9000 SAR · 6 nights · 2 travelers · interests culture, food · flexible destination

| Rank | Destination | Themes | Why (short) |
|---|---|---|---|
| 1 | Istanbul / Rome / Paris (score-ordered) | culture, food, city | Purpose + seasonality + local spend fit |
| 2–3 | Alternatives from catalog | overlapping themes | Different tone / price band |

Includes: best months note · pros/cons · hidden tip · tourist-trap avoid · daily cost split.

---

## Family

**Input:** tripPurpose family · 2 adults + 2 children · December

**Primary candidates:** Dubai, Istanbul, Maldives/beach-family overlaps  
**Culture snippet:** dress code + safety + weekend days (not a full handbook).

---

## Business

**Input:** tripPurpose business · short stay · spring

**Primary candidates:** Casablanca, Dubai, Tokyo (business theme)  
**Transport:** airport transfer + metro/taxi notes for city cores.

---

## Luxury beach

**Input:** budgetStyle luxury · beach · Feb

**Primary candidates:** Maldives, Dubai  
**Cost:** high daily band · meals/transport/activities explained in SAR.

---

## Comparisons (structured)

| Pair | Difference focus |
|---|---|
| Casablanca vs Marrakech | Business/coastal vs culture/souks |
| Paris vs Rome | Fashion/museums vs Roman history / mid-budget value |
| Tokyo vs Seoul | Depth/organization vs trend/shopping energy |

Each comparison returns bilingual differences + choose-when verdict + per-side scores.
