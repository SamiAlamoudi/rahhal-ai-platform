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
