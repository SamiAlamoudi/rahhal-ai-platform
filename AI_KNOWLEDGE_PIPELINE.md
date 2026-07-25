# Knowledge Pipeline — Phase 6 Stage 6

**Source:** `KNOWLEDGE_PIPELINE_STAGES` in `src/lib/orchestration/knowledgeEngine/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_context  
2. resolve_providers  
3. resolve_sources  
4. list_documents  
5. list_entities  
6. list_categories  
7. attach_graph  
8. resolve_references  
9. retrieve  
10. rank  
11. validate  
12. check_freshness  
13. score_confidence  
14. attach_provenance  
15. hint_cache  
16. append_audit  

Pipeline contract: `KnowledgePipelineContract` — declarative stage list only.
