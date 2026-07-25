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
