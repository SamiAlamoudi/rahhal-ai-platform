# Execution Pipeline — Phase 6 Stage 9

**Source:** `RUNTIME_PIPELINE_STAGES` in `src/lib/orchestration/runtimeOrchestrator/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_session  
2. load_context  
3. coordinate_conversation  
4. coordinate_planning  
5. coordinate_decision  
6. coordinate_memory  
7. coordinate_knowledge  
8. coordinate_tools  
9. coordinate_llm_adapter  
10. apply_guards  
11. apply_middleware  
12. invoke_hooks  
13. check_timeout  
14. apply_retry  
15. emit_metrics  
16. append_trace  
17. append_audit  
18. complete_or_recover  

Pipeline contract: `ExecutionPipelineContract` — declarative stage list only.  
No workers, schedulers, or live engine invocation.
