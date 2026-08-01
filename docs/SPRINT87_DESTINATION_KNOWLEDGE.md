# Sprint 87 — Destination Knowledge Layer

## Purpose

Brain Preview reasons from **structured destination data**, not hardcoded city recommendation essays.

## Schema (`DestinationKnowledge`)

| Field | Role |
| --- | --- |
| country / countryAr | Country identity |
| cities[] | City records with trait labels + scores |
| bestSeason / climate | Season & climate copy (facts) |
| averageBudgetSar | Indicative low/mid/high |
| tripDuration | min / max / recommended days |
| familyScore / honeymoonScore / businessScore | Suitability 0–10 |
| beaches / mountains / nightlife / shopping / culture | Intensity 0–10 |
| transportation | How travelers move |
| visaNotes | Non-assumed visa guidance |
| airports[] | Codes + names (+ primary) |

## How the Brain uses it

`reasonFromDestinationKnowledge()`:

1. Resolves destination aliases → knowledge key  
2. Infers trip style (family / business / weekend / …)  
3. **Ranks cities by weighted scores** (not fixed lists)  
4. Builds contrast, itinerary sketch, style note, budget adjustment  
5. ValueFirstPlanner / TravelReasoner consume that derived reasoning  

## Add a future country (data only)

1. Create `src/lib/brain/v1/destinationKnowledge/data/<key>.ts` exporting a `DestinationKnowledge`  
2. Register it in `data/index.ts` via `registerDestinationKnowledgeMany([...])`  
3. No changes to ConversationManager / ValueFirstPlanner / ClarificationPolicy  

## Production

Unchanged. Layer is used only when Brain Preview / Conversation Manager is exercised with enabled override; production flag remains OFF.
