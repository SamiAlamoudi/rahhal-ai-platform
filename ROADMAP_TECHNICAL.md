# Technical Roadmap (Architecture)

Ordered follow-ups after the DDD façade + zero-cycle pass. **No feature work** in these tracks.

## Near-term (architecture)

1. **Migrate UI imports** from deep `src/lib/...` to `src/domains/<domain>` barrels ( mechanize with codemod ).
2. **Physical moves** of implementation packages under `src/domains/<domain>/internal/` (keep shims at old paths).
3. **Collapse dual packages** after call-site audit:
   - `payment` vs `payments`
   - `execution` vs `brain/execution`
   - `chat/voice` vs `voiceConversation` (archive Sprint 18 if unused)
4. **Thin remaining fat barrels** (`lib/brain/index.ts`, `integrations/index.ts`) into `public` vs `internal` entrypoints.
5. **Server-proxy RapidAPI** keys (remove client-bundled hotel secrets).

## Mid-term

6. Authenticate + rate-limit Edge provider proxies; tighten CORS.
7. Server-side admin authorization for sensitive mutations.
8. Split ChatPage agent chunk (further route/domain code-splitting).
9. Unify conversation SoT documentation into a single “active path” matrix enforced in CI (lint import paths).
10. Contract registry bootstrap fully owned by infrastructure (no utils → integrations edges).

## Long-term (platform scale)

11. Extract domains into packages (`@rahhal/ai`, `@rahhal/booking`, …) if monorepo needed.
12. Event bus / outbox for booking ↔ payments ↔ notifications at high QPS.
13. Read replicas / caching tier for search aggregation.
14. Multi-region Edge Functions + queue workers for provider fan-out.
15. Agent evaluation harness + safety policy engine as first-class services.

## Explicitly out of scope here

- Enabling live payments or live providers by default
- LLM vendor lock-in
- Branding rename
- UI redesign
