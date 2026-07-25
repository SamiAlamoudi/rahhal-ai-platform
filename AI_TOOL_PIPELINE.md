# Tool Pipeline — Phase 6 Stage 7

**Source:** `TOOL_PIPELINE_STAGES` in `src/lib/orchestration/toolEngine/types.ts`

Ordered stages (`execution: 'none'`):

1. attach_context  
2. discover_tools  
3. resolve_tool  
4. check_permissions  
5. apply_policies  
6. inject_context  
7. validate_input  
8. enqueue  
9. route  
10. dispatch  
11. await_or_timeout  
12. apply_retry  
13. check_circuit  
14. validate_output  
15. normalize_result  
16. record_error  
17. emit_analytics  
18. append_audit  

Pipeline contract: `ToolExecutionPipelineContract` — declarative stage list only.  
No queue workers, no HTTP, no LLM tool-calling.
