# Decision Pipeline — Phase 6 Stage 4

**Source:** `DECISION_PIPELINE_STAGES` in `src/lib/orchestration/decisionEngine/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_context  
2. load_alternatives  
3. match_preferences  
4. validate_constraints  
5. evaluate_alternatives  
6. score_alternatives  
7. analyze_tradeoffs  
8. optimize_cost  
9. evaluate_risk  
10. rank_alternatives  
11. build_explanation  
12. build_recommendation  
13. score_confidence  
14. append_audit  

Pipeline contract: `DecisionPipelineContract` — declarative stage list only.
