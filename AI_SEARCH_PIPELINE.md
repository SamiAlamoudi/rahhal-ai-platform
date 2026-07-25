# Search Pipeline — Phase 7 Stage 8

**Source:** `SEARCH_PIPELINE_STAGES` in `src/lib/orchestration/travelSearchOrchestrator/types.ts`  
**Flag:** `brain.search_orchestrator`

Ordered stages (`execution: 'none'`):

1. attach_travel_plan  
2. attach_traveler_profile  
3. attach_conversation_context  
4. attach_intent  
5. attach_preferences  
6. attach_budget  
7. attach_dates  
8. attach_destination  
9. build_search_request  
10. map_provider_requests  
11. apply_strategy  
12. normalize_shapes  
13. hint_aggregation  
14. hint_ranking  
15. score_confidence  
16. validate  
17. snapshot  

Declarative stage list only — no HTTP, no provider dispatch.
