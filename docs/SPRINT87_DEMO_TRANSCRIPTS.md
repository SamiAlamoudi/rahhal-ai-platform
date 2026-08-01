# Sprint 87 — Demo Conversation Transcripts

Generated from Conversation Manager (Brain preview path; foundation flag exercised via enabled override).

Each scenario demonstrates **Value First**, memory, and ≤1 question.

## Scenario 1 — Morocco (Value First)

### Turn 1

**User:** I want to travel to Morocco.

**Assistant:** Excellent choice. Based on destination scores: Marrakech (nightlife, shopping); Agadir (beaches); Fes (shopping, culture); Casablanca (shopping). First cut: Marrakech, Agadir, Fes. 2 days Marrakech: souks and gardens · 2 days Agadir: beach reset · 3 days Fes: medina and crafts Spring (Mar–May) and autumn (Sep–Nov) are usually the most comfortable seasons. The coast stays milder in summer; inland cities run warmer with cooler nights. Typically 5–10 days (suggested 7). Rough mid-band around 7,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — ind… Which city will you depart from?

- Destination: `Morocco`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Revised slots: `destination`

## Scenario 2 — Japan

### Turn 1

**User:** Japan

**Assistant:** Excellent choice. Based on destination scores: Tokyo (nightlife, shopping); Kyoto (culture); Osaka (nightlife, shopping). First cut: Tokyo, Kyoto, Osaka. 4 days Tokyo: neighborhoods and modern landmarks · 3 days Kyoto: temples and gardens · 3 days Osaka: street food and city energy Spring (sakura) and autumn are excellent; summer is humid; winter suits Hokkaido. Tokyo/Osaka are humid in summer; Kyoto is nicer in spring and autumn. Typically 7–14 days (suggested 10). Rough mid-band around 18,000 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — ind… Which city will you depart from?

- Destination: `Japan`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Revised slots: `destination`

## Scenario 3 — Business trip London

### Turn 1

**User:** Business trip London

**Assistant:** Excellent choice. London fits this trip focus (business access, nightlife). 4 days London: meetings with nearby stay Late spring through early autumn is usually the most pleasant. Changeable weather — light layers and an umbrella help. Typically 3–7 days (suggested 4). Rough mid-band around 13,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. Business fit score 10/10 — prioritize London. Which city will you depart from?

- Destination: `London`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `tripStyle=business`
- Revised slots: `destination, cabin, specialRequests`

## Scenario 4 — Weekend Dubai

### Turn 1

**User:** Weekend Dubai

**Assistant:** Excellent choice. Dubai fits this trip focus (business access, beaches). 3 days Dubai: Marina / Downtown Best Nov–Mar; summer favors indoor plans. Summers are intense; winter suits walking and beach time. About 3 days fits this trip shape (indicative). Rough mid-band around 2,125 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. Short-trip shape: keep to 1 area max (shopping 10/10, nightlife 9/10). Which city will you depart from?

- Destination: `Dubai`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `tripStyle=weekend|duration=3`
- Revised slots: `destination, specialRequests`

## Scenario 5 — Family Switzerland

### Turn 1

**User:** Family Switzerland

**Assistant:** Excellent choice. Based on destination scores: Interlaken (family-friendly, mountains); Geneva (family-friendly, culture); Zurich (family-friendly, culture). First cut: Interlaken, Geneva, Zurich. 2 days Interlaken: lakes and alpine views · 2 days Geneva: lake-calm day · 3 days Zurich: arrival city pace Summer for lakes; winter for skiing; spring/autumn are quieter. Mountains run colder than cities — pack layers. Typically 5–10 days (suggested 7). Rough mid-band around 18,400 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and y… Which city will you depart from?

- Destination: `Switzerland`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `tripStyle=family`
- Revised slots: `destination, specialRequests`

## Incremental — Morocco → Agadir

### Turn 1

**User:** I want to travel to Morocco.

**Assistant:** Excellent choice. Based on destination scores: Marrakech (nightlife, shopping); Agadir (beaches); Fes (shopping, culture); Casablanca (shopping). First cut: Marrakech, Agadir, Fes. 2 days Marrakech: souks and gardens · 2 days Agadir: beach reset · 3 days Fes: medina and crafts Spring (Mar–May) and autumn (Sep–Nov) are usually the most comfortable seasons. The coast stays milder in summer; inland cities run warmer with cooler nights. Typically 5–10 days (suggested 7). Rough mid-band around 7,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — ind… Which city will you depart from?

- Destination: `Morocco`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Revised slots: `destination`

### Turn 2

**User:** Actually make it Agadir

**Assistant:** I updated only the affected parts. Agadir fits this trip focus (beaches). 5 days Agadir: beach reset Comfortable most of the year; spring and autumn are ideal for the beach. Coastal climate is milder than Marrakech in summer. Typically 3–7 days (suggested 5). Rough mid-band around 5,500 SAR per person — Preliminary indicative estimate — not a live quote. I can start with a preliminary plan now, temporarily assuming one adult and flexible dates and a balanced mid-range budget and mid-range stays — indicative only, and you can revise any assumption later. Leisure balance — culture 4/10, beaches 9/10, mountains 3/10. Which city will you depart from?

- Destination: `Agadir`
- Provided value: `true`
- Question count: `1`
- Question slot: `origin`
- Special: `preferredCity=Agadir`
- Revised slots: `destination, specialRequests`
