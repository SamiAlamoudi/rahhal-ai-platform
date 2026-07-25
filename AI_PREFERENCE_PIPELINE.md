# Preference Extraction Pipeline — Phase 7 Stage 4

**Source:** `PREFERENCE_PIPELINE_STAGES` in `src/lib/orchestration/preferenceExtractionEngine/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_conversation  
2. parse_utterances  
3. detect_explicit  
4. detect_implicit  
5. collect_evidence  
6. score_confidence  
7. validate  
8. resolve_conflicts  
9. merge  
10. check_freshness  
11. apply_expiration  
12. emit_updates  
13. append_timeline  
14. append_revision  

Declarative stage list only — no conversation workers, no LLM tool-calling.
