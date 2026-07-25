# Intent Pipeline — Phase 7 Stage 6

**Source:** `INTENT_PIPELINE_STAGES` in `src/lib/orchestration/intentEngine/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_conversation  
2. classify_candidates  
3. score_confidence  
4. validate  
5. apply_priorities  
6. resolve_primary  
7. detect_multi_intent  
8. model_transition  
9. append_history  
10. emit_snapshot  

Declarative stage list only — no workers, no planning/booking side effects.
