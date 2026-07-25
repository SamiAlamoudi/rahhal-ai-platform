# Offer Validation — Phase 7 Stage 10

## Contracts

| Contract | Blueprint defaults |
|----------|-------------------|
| `OfferValidationContract` / `OfferValidation` | `valid: true`, empty issues |
| `OfferLifecycleContract` | ingest · score · rank · decide · explain · validate · snapshot · revise · close |
| `OfferRevisionContract` | empty revisions; `persisted: false` |
| `OfferSnapshotContract` | snapshot linked to decisionId |

## Isolation checks

| Flag | Expected |
|------|----------|
| `wiredIntoRuntime` | false |
| `httpRequests` | false |
| `wiredIntoProviderApis` | false |
| `wiredIntoDatabase` | false |
| `wiredIntoStorage` | false |
| `booking` | false |
| `pricing` | false |
| `payments` | false |
| `wiredIntoLlms` | false |
| `wiredIntoOcr` | false |
| `wiredIntoAuth` | false |
| `recommendationExecuted` | false |
| `distinctFromTravelRecommendation` | true |
| `distinctFromPersonalizationEngine` | true |
| `distinctFromAiRecommendationEngine` | true |

Force blueprint: `tryBuildTravelOfferDecisionBlueprint({ enabled: true })`.
