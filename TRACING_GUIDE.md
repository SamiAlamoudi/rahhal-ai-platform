# Tracing Guide

## Domains

Traces cover the full product lifecycle (additive spans — engines not modified):

1. conversation  
2. planner  
3. journey  
4. providers  
5. maps  
6. flights  
7. hotels  
8. payments  
9. action_engine  

## APIs

- `startTrace` / `endTrace`
- `startSpan` / `endSpan` (stores per-step latency)
- `recordLifecycleSkeleton` — demo/test full path without invoking engines

## Correlation

Spans inherit `requestId` / `conversationId` from `CorrelationIdManager`.

## Future

OpenTelemetry / vendor exporters are out of scope for this sprint.
