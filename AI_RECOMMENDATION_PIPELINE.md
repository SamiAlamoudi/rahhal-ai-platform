# Recommendation Pipeline — Phase 7 Stage 9

**Source:** `TRAVEL_RECOMMENDATION_PIPELINE_STAGES` in `src/lib/orchestration/travelRecommendationEngine/types.ts`  
**Flag:** `brain.travel_recommendation`

Ordered stages (`execution: 'none'`):

1. attach_search_candidates  
2. attach_traveler_profile  
3. attach_conversation_context  
4. attach_intent  
5. attach_preferences  
6. attach_budget  
7. attach_planning_goals  
8. attach_travel_constraints  
9. attach_historical_signals  
10. apply_business_rules  
11. score_candidates  
12. rank_candidates  
13. explain_ranking  
14. select_top  
15. select_alternatives  
16. score_confidence  
17. validate  
18. snapshot  

Declarative stage list only — no scoring execution, booking, or provider calls.
