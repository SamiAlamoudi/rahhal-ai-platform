# LLM Request / Prompt Pipeline — Phase 6 Stage 8

**Source:** `LLM_REQUEST_PIPELINE_STAGES` in `src/lib/orchestration/llmAdapter/types.ts`

Ordered request stages (`execution: 'none'`):

1. attach_session  
2. select_provider  
3. rank_providers  
4. build_context  
5. build_system_prompt  
6. build_prompt  
7. attach_tool_call_contracts  
8. attach_function_call_contracts  
9. prepare_request  
10. apply_timeout_hint  
11. apply_retry_hint  
12. append_audit  

## Related contracts

| Contract | Role |
|----------|------|
| `LlmContextBuilderContract` | Session context keys (empty in blueprints) |
| `LlmSystemPromptContract` | Template id + locale |
| `LlmPromptBuilderContract` | Prompt shape hint |
| `LlmToolCallContract` | Tool-call schema hint |
| `LlmFunctionCallContract` | Function-call schema hint |

No prompt execution, tokenization, or provider submission.
