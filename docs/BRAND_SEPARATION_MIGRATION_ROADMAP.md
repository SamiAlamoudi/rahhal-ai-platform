# Brand separation — staged migration roadmap

> Active product brand: **Bilamo**. This document plans **future** PRs only.
> High-risk migrations are **not** executed in the Brand Separation foundation PR.

Companion docs: [`DOMAIN_NAMING_POLICY.md`](./DOMAIN_NAMING_POLICY.md), [`BRANDING_TODO.md`](./BRANDING_TODO.md).

---

## Compatibility inventory (retained)

### 1. Storage keys (dual-read later)

| Key | Module |
|-----|--------|
| `rahhal.alpha.chat.v1` | `localChatStore` |
| `rahhal.chat.activeConversationId` | `chatRecovery` |
| `rahhal.chat.theme` | conversation UI theme |
| `rahhal.chat.uiRecovery.v1` | chatgptExperience recovery |
| `rahhal.voiceExperience.v1` | voice prefs |
| `rahhal.pref.v1:` | preference storage |
| `rahhal.correlationId` | ops correlation |
| `rahhal_travel_session` | travel session |
| `rahhal_demo_auth_v1` | demo auth |
| `rahhal_checkout_*` | Moyasar checkout session |
| `rahhal_booking_flow_v1:` / `rahhal_booking_sessions_v1:` | booking persistence |
| `rahhal_passenger_draft_v1:` | passenger drafts |

**Future pattern:** new key → read new then old → write new only → migrate → telemetry → remove old after observation.

### 2. Exported types / APIs (alias later)

| Legacy | Canonical (preferred) |
|--------|------------------------|
| `RahhalOrder` | `BookingOrder` |
| `RahhalFlightSearchOffer` | `FlightOffer` (or keep distinct search DTO name) |
| `RahhalAiOrchestrator` | `AgentRuntime` / `SearchOrchestrator` |
| `RahhalBrain*` | `ReasoningEngine` / `ConversationEngine` |
| `RahhalPrinciples` | `ProductPrinciples` / `AgentPrinciples` |
| Panel locals | `RecommendationPanel` (done in foundation PR) |

Pattern: new name + `@deprecated` alias → migrate consumers → ban new imports → remove alias.

### 3. Constants

Prefer **neutral** names (`CONVERSATION_SYSTEM_PROMPT`, `BOOKING_FEE`, `SERVICE_FEE`, `PLATFORM_VERSION`) — not `BILAMO_*` swaps.

### 4. Feature flags

| Legacy id | Future canonical examples |
|-----------|---------------------------|
| `ai.rahhal_brain` | `ai.reasoning_engine` / `ai.conversation_engine` / `ai.agent_runtime` |

Dual-register + mirror state + migrate overrides + dashboards → remove old only when unused.

### 5. Webhooks / HTTP headers

Keep accepting `x-rahhal-webhook-secret` and `X-Rahhal-*` until dual support is deployed and partners updated.

### 6. URL schemes / document formats

| Legacy | Notes |
|--------|-------|
| `rahhal://documents/…` | Dual-read URI scheme |
| `rahhal-ticket-v1`, `rahhal-bp-v1`, `rahhal-docs-*` | Format markers |
| `source=rahhal` | Amadeus redirect param |

### 7. Domains / CORS / emails / repository

**Out of scope until Bilamo domain is confirmed:**

- GitHub repo rename (`rahhal-ai-platform`)
- Vercel project / production CORS origin
- OAuth / payment / provider callbacks
- Email fixtures (`@rahhal.local`, `@rahhal.app`)
- Redirects and env scripts

### 8. Database migrations / history

Never rename applied SQL files under `supabase/migrations/*rahhal*`.  
Never rewrite CHANGELOG / sprint archives. Mark archival docs with a Bilamo rename banner when touched.

---

## Future PR sequence

### P0 — Guardrails *(this foundation PR)*

| | |
|--|--|
| **Scope** | Inventory script, allowlist, CI/local `branding:check`, naming policy, roadmap, zero-risk cleanup |
| **Risk** | None |
| **Dependencies** | PR #339 on main |
| **Rollback** | Revert PR |
| **Tests** | branding inventory tests, full suite, Playwright |
| **Exit** | CI fails on new unapproved legacy / `BilamoOrder`-style names; user-facing Bilamo-only |
| **Observability** | Inventory report in CI logs |

### P1 — Zero-risk cleanup *(partially started in foundation)*

| | |
|--|--|
| **Scope** | Remaining comments/test titles; neutralize more log noise |
| **Risk** | Low |
| **Rollback** | Revert |
| **Exit** | Fewer Internal technical allowlist rows |

### P2 — Storage migration

| | |
|--|--|
| **Scope** | Dual-read by domain; write new keys only; one compat test per key family; telemetry counters |
| **Risk** | Medium (client devices) |
| **Dependencies** | P0 |
| **Rollback** | Keep dual-read; stop writing new if needed |
| **Observability** | `storage.legacy_key_read` events |
| **Exit** | New writes never use `rahhal.*` |

### P3 — Type and API aliases

| | |
|--|--|
| **Scope** | Constants → Order → Flight → Orchestrator → Brain → finance/loyalty fields → meta dual fields |
| **Risk** | Medium–high |
| **Dependencies** | P0; prefer after P2 for any persisted JSON field names |
| **Rollback** | Keep deprecated aliases |
| **Exit** | Canonical domain names used internally; aliases deprecated |

### P4 — Wire contracts

| | |
|--|--|
| **Scope** | Headers, webhooks, URI schemes, format IDs, `source=` param |
| **Risk** | High (external partners) |
| **Dependencies** | Coordinated deploy + partner config |
| **Observability** | Deprecated-header / format counters |
| **Exit** | Dual accept; emit new |

### P5 — Feature-flag migration

| | |
|--|--|
| **Scope** | Dual registration for `ai.rahhal_brain`; mirror; health id |
| **Risk** | High |
| **Dependencies** | P3 brain rename wave ideally |
| **Exit** | New semantic id canonical; old mirrored |

### P6 — File and package polish

| | |
|--|--|
| **Scope** | Rename `rahhalBrain.ts` etc. after import migration; shrink allowlist |
| **Risk** | Medium (review friction) |
| **Exit** | Filenames match domain names |

### P7 — Infrastructure and domain transition

| | |
|--|--|
| **Scope** | Repo, DNS, CORS overlap, OAuth, payments, Vercel, redirects |
| **Risk** | Critical |
| **Dependencies** | Confirmed Bilamo domain |
| **Rollback** | DNS/CORS dual allow during cutover |
| **Exit** | Bilamo origin primary; legacy redirecting |

### P8 — Compatibility sunset

| | |
|--|--|
| **Scope** | Drop NLU `rahhal` aliases, old storage readers, old headers, old flag ids; empty allowlist |
| **Risk** | Medium (only after metrics ~0) |
| **Observability** | Confirm zero legacy usage for observation window |
| **Exit** | `branding-allowlist.json` empty (or migrations-only) |

---

## Recommended next PR after this foundation

**P2 storage migration (chat keys first):** introduce `bilamo.chat.*` / neutral keys with dual-read for `rahhal.chat.*` and `rahhal.alpha.chat.v1`, write-new-only, telemetry, and one compatibility test — no API or flag renames.
