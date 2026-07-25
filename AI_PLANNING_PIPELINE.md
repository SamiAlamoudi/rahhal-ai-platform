# Travel Planning Pipeline — Phase 7 Stage 7

**Source:** `TRAVEL_PLANNING_PIPELINE_STAGES` in `src/lib/orchestration/travelPlanningEngine/types.ts`  
**Flag:** `brain.travel_planning`

Ordered stages (`execution: 'none'`):

1. attach_traveler_profile  
2. attach_conversation_context  
3. attach_intent  
4. attach_preferences  
5. attach_budget  
6. attach_dates  
7. attach_destination  
8. define_goals  
9. apply_constraints  
10. apply_priorities  
11. apply_strategy  
12. build_plan_structure  
13. generate_alternatives  
14. hint_optimization  
15. score_confidence  
16. validate  
17. version  
18. snapshot  

Declarative stage list only — no booking, pricing, or provider calls.

---

# Planning Pipeline — Phase 6 Stage 3

**Source:** `PLANNING_PIPELINE_STAGES` in `src/lib/orchestration/planningEngine/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_context  
2. match_preferences  
3. apply_constraints  
4. select_destination  
5. plan_transport  
6. plan_accommodation  
7. plan_activities  
8. build_itinerary  
9. optimize_schedule  
10. plan_budget  
11. analyze_risk  
12. generate_alternatives  
13. build_scenarios  
14. score_confidence  

Pipeline contract: `PlanningPipelineContract` — declarative stage list only.
