# Sprint 87 — Demo Conversation Transcripts

Generated from Conversation Manager (Brain preview path; foundation flag exercised via enabled override).

Each scenario demonstrates **Value First**, memory, and ≤1 question.

## Scenario 1 — Morocco (Value First)

### Turn 1

**User:** I want to travel to Morocco.

**Assistant:** Excellent choice. Marrakech is lively; Fes is historic; Casablanca is practical; Agadir is beach-calm. First cut: Marrakech, Fes, Casablanca. 2 days Marrakech: souks and gardens · 2 days Fes: medina and crafts · 2 days coast (Agadir or Casablanca) Spring (Mar–May) and autumn (Sep–Nov) are usually the most comfortable seasons. The coast stays milder in summer; inland cities run warmer with cooler nights. Typically 5–10 days (suggested 7). Rough mid-band around 7,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revi… Which city will you depart from?

- Destination: `Morocco`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Revised slots: `destination`

## Scenario 2 — Japan

### Turn 1

**User:** Japan

**Assistant:** Excellent choice. Tokyo is modern; Kyoto is heritage; Osaka is food and energy. First cut: Tokyo, Kyoto, Osaka. 3–4 days Tokyo · 2–3 days Kyoto · Osaka day or Shinkansen hop Spring (sakura) and autumn are excellent; summer is humid; winter suits Hokkaido. Tokyo/Osaka are humid in summer; Kyoto is nicer in spring and autumn. Typically 7–14 days (suggested 10). Rough mid-band around 18,000 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. City plus heritage is the balanced first visit. Which city will you depart from?

- Destination: `Japan`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Revised slots: `destination`

## Scenario 3 — Business trip London

### Turn 1

**User:** Business trip London

**Assistant:** Excellent choice. Focusing the plan on London with a revisable preliminary direction. Central London day · Meetings day with nearby stay · Half flexible day Late spring through early autumn is usually the most pleasant. Changeable weather — light layers and an umbrella help. Typically 3–7 days (suggested 4). Rough mid-band around 13,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. Stay near meetings with easy airport/train access. Which city will you depart from?

- Destination: `London`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `tripStyle=business`
- Revised slots: `destination, cabin, specialRequests`

## Scenario 4 — Weekend Dubai

### Turn 1

**User:** Weekend Dubai

**Assistant:** Excellent choice. Focusing the plan on Dubai with a revisable preliminary direction. Marina / Downtown day · Shopping or light experience day · Flexible morning before departure Best Nov–Mar; summer favors indoor plans. Summers are intense; winter suits walking and beach time. About 3 days fits this trip shape (indicative). Rough mid-band around 2,125 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. Keep the plan to two areas max. Which city will you depart from?

- Destination: `Dubai`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `tripStyle=weekend|duration=3`
- Revised slots: `destination, specialRequests`

## Scenario 5 — Family Switzerland

### Turn 1

**User:** Family Switzerland

**Assistant:** Excellent choice. Zurich is practical; Interlaken is nature; Geneva is lake-calm. First cut: Zurich, Interlaken, Geneva. 2 days arrival city · 2 days lakes / Interlaken · Scenic train day at a family pace Summer for lakes; winter for skiing; spring/autumn are quieter. Mountains run colder than cities — pack layers. Typically 5–10 days (suggested 7). Rough mid-band around 18,400 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. Short train hops beat long daily transfers. Which city will you depart from?

- Destination: `Switzerland`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `tripStyle=family`
- Revised slots: `destination, specialRequests`

## Incremental — Morocco → Agadir

### Turn 1

**User:** I want to travel to Morocco.

**Assistant:** Excellent choice. Marrakech is lively; Fes is historic; Casablanca is practical; Agadir is beach-calm. First cut: Marrakech, Fes, Casablanca. 2 days Marrakech: souks and gardens · 2 days Fes: medina and crafts · 2 days coast (Agadir or Casablanca) Spring (Mar–May) and autumn (Sep–Nov) are usually the most comfortable seasons. The coast stays milder in summer; inland cities run warmer with cooler nights. Typically 5–10 days (suggested 7). Rough mid-band around 7,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revi… Which city will you depart from?

- Destination: `Morocco`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Revised slots: `destination`

### Turn 2

**User:** Actually make it Agadir

**Assistant:** I updated only the affected parts. Focusing the plan on Agadir with a revisable preliminary direction. Arrival day and beach reset · Corniche and local markets · Light activities or a short day trip Comfortable most of the year; spring and autumn are ideal for the beach. Coastal climate is milder than Marrakech in summer. Typically 3–7 days (suggested 5). Rough mid-band around 5,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. Slower coastal pace than Marrakech. Which city will you depart from?

- Destination: `Agadir`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `preferredCity=Agadir`
- Revised slots: `destination, specialRequests`
