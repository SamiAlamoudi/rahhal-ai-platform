# Technical Roadmap (Architecture)

Ordered follow-ups after Recovery Phase 1 + engineering audit. **No feature work** in these tracks.

## Near-term (cleanup / hardening)

1. **Thin ChatPage static imports** so quarantined chatgpt/conversationExperience paths are not always linked.
2. **Collapse dual packages** after call-site + test-isolation audit:
   - `payment` vs `payments`
   - `execution` vs `brain/execution`
   - `chat/voice` vs `voiceConversation` (archive Sprint 18 if unused)
3. **Thin remaining fat barrels** (`lib/brain/index.ts`, `integrations/index.ts`) into `public` vs `internal` entrypoints.
4. **Server-proxy RapidAPI** keys (remove client-bundled hotel secrets).
5. **Centralize money formatters** behind `lib/payment/money.ts` where formats already match.
6. **Shared city catalog adapter** between Decision Engine packs and Planning Draft priors (no behavior change).

## Mid-term

7. Authenticate + rate-limit Edge provider proxies; tighten CORS.
8. Server-side admin authorization for sensitive mutations.
9. Split ChatPage agent chunk (further route/package code-splitting).
10. Move remaining quarantined packages under `/archive` with opt-in vitest projects when tests no longer need them in `src/`.

## Related

- [`ENGINEERING_AUDIT_REPORT.md`](ENGINEERING_AUDIT_REPORT.md)
- [`TECHNICAL_DEBT.md`](TECHNICAL_DEBT.md)
- [`RECOVERY_PHASE_1_REPORT.md`](RECOVERY_PHASE_1_REPORT.md)
