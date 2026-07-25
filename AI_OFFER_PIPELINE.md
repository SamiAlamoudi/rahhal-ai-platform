# Offer Pipeline — Phase 7 Stage 10

**Source:** `TRAVEL_OFFER_PIPELINE_STAGES` in `src/lib/orchestration/travelOfferDecisionEngine/types.ts`  
**Flag:** `brain.offer_decision_engine`

Ordered stages (`execution: 'none'`):

1. attach_recommendation_results  
2. attach_traveler_preferences  
3. attach_price_signals  
4. attach_quality_signals  
5. attach_business_rules  
6. build_offer_candidates  
7. build_offer_bundles  
8. apply_strategy  
9. score_offers  
10. rank_offers  
11. select_best_offer  
12. explain_decision  
13. score_confidence  
14. validate  
15. snapshot  

Declarative stage list only — no scoring execution, booking, payments, or provider calls.
