# Sprint 39 — Universal Travel Documents & Visa Intelligence Platform

Destination rules, passport/visa/vaccination intelligence, document alerts, and conversation explanations across every travel service.

## Non-goals

- Do not rewrite planner, booking, payments, refunds, disruption, or loyalty stacks
- Destination rules are deterministic sandbox data — future government integrations plug in via adapters
- No live immigration APIs in this sprint

## Architecture

```
Conversation / booking warnings
  → TravelDocumentsPlatform.evaluate
       ├─ DestinationRulesEngine
       ├─ PassportIntelligence
       ├─ VisaIntelligence
       ├─ VaccinationRules
       ├─ DocumentAlerts
       └─ TravelDocumentsExplainer + Events + Metrics
```

## Covered document kinds

Passport · Visa · Transit visa · Entry permit · Exit requirements · Residence permit · Vaccination · Health certificate · Travel insurance · Customs declaration · Immigration rules · Digital arrival cards · Airport document checks

## Services

Flights · Hotels · Cars · Activities · Cruises · Rail · Bus · Future providers

## Conversation examples

- "Can I travel to Japan?"
- "Do I need a visa?"
- "My passport expires in 5 months."
- "Can I transit through London?"
- "What documents do I need?"

## Feature flag

| ID | Default | Depends on |
|----|---------|------------|
| `brain.travel_documents` | **OFF** | `brain.loyalty_platform` |

## Modules

`src/lib/travelDocuments/`

## Tests

`src/lib/__tests__/travelDocuments.sprint39.test.ts`
