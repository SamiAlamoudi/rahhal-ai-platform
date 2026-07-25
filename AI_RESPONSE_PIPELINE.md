# LLM Response Pipeline — Phase 6 Stage 8

**Source:** `LLM_RESPONSE_PIPELINE_STAGES` in `src/lib/orchestration/llmAdapter/types.ts`

Ordered response stages (`execution: 'none'`):

1. receive_placeholder  
2. normalize_response  
3. map_tool_calls  
4. map_function_calls  
5. account_tokens  
6. hint_cost  
7. record_error  
8. emit_analytics  
9. append_audit  

## Related contracts

| Contract | Role |
|----------|------|
| `LlmResponseNormalizerContract` | Provider-agnostic shape hint |
| `LlmStreamingContract` | `streamingSupportedHint: false` |
| `LlmTokenAccountingContract` | Zeros; `metered: false` |
| `LlmCostModelContract` | Unit/currency hints; `estimated: false` |
| `LlmErrorModelContract` | Architecture error codes |

No streaming sockets, no HTTP bodies, no token meters.
