# Context Pipeline — Phase 7 Stage 5

**Source:** `CONTEXT_PIPELINE_STAGES` in `src/lib/orchestration/travelerContextEngine/types.ts`  
**Flag:** `brain.context_engine`

Ordered stages (`execution: 'none'`):

1. attach_session  
2. load_conversation_state  
3. resolve_current_intent  
4. resolve_current_goals  
5. attach_traveler_preferences  
6. attach_constraints  
7. attach_environment  
8. attach_time_location  
9. attach_budget  
10. attach_documents  
11. build_trip_context  
12. merge_contexts  
13. apply_priorities  
14. score_confidence  
15. check_freshness  
16. validate  
17. emit_snapshot  

Declarative stage list only — no live assembly, no Memory reads, no LLM.

---

# Context Pipeline — Phase 6 Stage 2

**Package:** `src/lib/orchestration/conversationOrchestrator/pipelines.ts`

## Stages (contracts only)

1. **Intent Pipeline** — `IntentPipelineContract` (`execution: 'none'`)
2. **Context Builder** — slices per UI module (`ContextBuilderContract`)
3. **Memory Reader** — requested keys, empty entries, no DB
4. **Memory Writer** — proposed writes, `persisted: false`
5. **Domain contexts**
   - Planning Context → travel workspace / timeline / decision
   - Decision Context → decision / insights centers
   - Traveler Context → traveler profile / memory center
   - Booking Context → booking hub / operations
   - Workspace Context → workspace / executive / command palette

## Rules

- Pure builders return typed contracts
- No network, storage, or model inference
- Module targets are declarative hints only
