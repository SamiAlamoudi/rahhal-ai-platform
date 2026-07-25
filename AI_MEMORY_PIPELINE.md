# Memory Pipeline — Phase 6 Stage 5

**Source:** `MEMORY_PIPELINE_STAGES` in `src/lib/orchestration/memoryEngine/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_context  
2. read_session  
3. read_conversation  
4. read_profile  
5. read_preferences  
6. read_destinations  
7. read_trip_history  
8. read_documents  
9. read_relationships  
10. read_entities  
11. resolve_knowledge_refs  
12. apply_retrieval_strategy  
13. rank_memories  
14. merge_memories  
15. apply_lifecycle  
16. apply_retention  
17. score_confidence  
18. append_audit  

Pipeline contract: `MemoryPipelineContract` — declarative stage list only.
