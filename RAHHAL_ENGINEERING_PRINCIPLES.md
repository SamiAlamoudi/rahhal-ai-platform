# Rahhal Engineering Principles

**Status:** Binding  
**Applies to:** All Rahhal AI Platform development after Architecture Freeze  
**Companion docs:** `AI_DESIGN_PRINCIPLES.md` · `FEATURE_DEVELOPMENT_GUIDE.md` · `RAHHAL_ENGINEERING_CONSTITUTION.md`

These principles are not guidelines. They are constraints. Violations require an RFC and architecture review before merge.

---

## 1. Conversation First

The product is a travel **conversation**, not a form wizard with chat decoration.

| Rule | Requirement |
|------|-------------|
| Single conversation SoT | `/chat` → `LegacyChatPage` → `chatEngine` → `travel-agent` → `travelAgentService.planTurn` |
| One turn owner | Every user message that plans, searches, books, or advises must enter through `planTurn` |
| No parallel SoTs | Do not add a second chat engine, “premium conversation,” or bypass UI that owns traveler dialogue |
| Voice is input | Browser STT/TTS feeds the same spine; it is not a separate realtime concierge product |

Legacy routes (e.g. `/travel-conversation`) may redirect only. They must not reintroduce a second owner.

---

## 2. Decision Engine is mandatory

Any path that ranks, selects, or recommends flights/hotels/packages **must** go through the Decision Engine (or an approved, flag-gated extension that still calls it).

- Do not hard-code “pick cheapest” or “pick first result” in UI or tools.
- Do not invent a second ranking brain beside the Decision Engine.
- UI may display Decision Engine outputs; it must not replace them.

---

## 3. Planning Draft remains deterministic

The Planning Draft layer is a **deterministic** foundation.

- Same inputs → same draft structure (modulo intentional randomness only where already defined and tested).
- LLM / Conversation Brain may **narrate** or refine presentation; they must not silently replace Planning Draft as the source of plan structure.
- Changes to draft generation require golden / regression tests.

---

## 4. Smart Clarification asks only necessary questions

- Infer soft preferences before asking.
- Never re-ask slots already known (never-ask-twice).
- Prefer one high-value question over a questionnaire.
- If confidence is sufficient to recommend safely, recommend—do not stall in clarification.

---

## 5. No duplicated business logic

| Allowed | Forbidden |
|---------|-----------|
| Layered adapters (`integrations` HTTP → aggregation / liveProviders façades) that share one client | Copy-paste of ranking, budget, clarification, or booking rules into UI |
| Thin re-exports with a single implementation | Second “helper” that reimplements Decision Engine / memory merge / planTurn routers |
| Test doubles behind interfaces | Production code paths that diverge from `planTurn` for the same traveler intent |

If two modules do the same job, delete or merge one before shipping a feature that depends on either.

---

## 6. No client secrets

Never ship provider credentials in `VITE_*` (or any client-bundled env).

Forbidden examples: `VITE_OPENAI_API_KEY`, `VITE_AGENT_OPENAI_API_KEY`, `VITE_RAPIDAPI_KEY`, `VITE_BOOKING_API_KEY`, Maps/Weather/Moyasar/Amadeus secrets.

- `validateEnvironment` / secret hygiene must continue to **hard-fail** these keys.
- SPA may hold only public config: Supabase URL + anon key, feature flags, proxy URLs, non-secret models names.

---

## 7. Server-only privileged integrations

Privileged calls (OpenAI, RapidAPI/Booking, Amadeus token exchange, Maps, Weather, payments capture, etc.) run on:

- Supabase Edge Functions, and/or  
- Vercel Edge / server routes  

with invoke authentication (anon/service) and CORS allowlists (`EDGE_ALLOWED_ORIGINS*`).

The SPA invokes proxies; it never talks to supplier secret APIs with a browser-held key.

---

## 8. All providers behind adapters

- Live search/booking goes through `ProviderAdapter` (and related registries)—not ad-hoc `fetch` from pages/components.
- New suppliers: implement adapter → register → feature-flag → mock fallback.
- Mock remains the safe default for CI and local without live secrets.

---

## 9. Every feature must be testable

- Unit tests for pure logic (mandatory).
- Integration tests when touching providers, proxies, or persistence.
- Feature flags must be exercisable in tests without enabling production defaults.
- Untestable “demo-only” production code is not acceptable.

---

## 10. Performance must never regress

- Do not reintroduce static imports of quarantined finance/orchestrator graphs onto the default chat chunk.
- Prefer lazy-loading experimental UI.
- Bundle and turn-latency regressions need measurement or an explicit waiver in the RFC.
- Cooperative abort / cancellation must remain respected on long `planTurn` work.

---

## 11. Feature flags for experimental functionality

- Experimental brains, UX skins, and live providers default **OFF**.
- Production enablement requires staging pilot + flag review.
- Do not leave “always on” experiments without registry ownership.

See `FEATURE_REGISTRY.md` and Recovery freeze flags.

---

## 12. AI behavior changes require regression tests

Any change that can alter traveler-visible AI behavior (Decision Engine, Planning Draft, Conversation Brain, Smart Clarification, planTurn routers, concierge handoff) **must** include:

- Targeted unit and/or integration regression tests, and  
- Explicit note in the PR that frozen-core behavior was preserved or intentionally changed (with product sign-off).

Silent prompt/logic drift without tests is a constitution violation.

---

## Frozen systems (do not rewrite)

Unless an incident RFC says otherwise:

1. Decision Engine  
2. Planning Draft  
3. Conversation Brain  
4. Smart Clarification  
5. Production Authority infrastructure (Edge auth/CORS, OpenAI proxy, Booking proxy)

Extend via stages, tools, adapters, and flags—not by forking or replacing these cores.

---

## Enforcement

| Gate | Mechanism |
|------|-----------|
| Secrets | `scripts/secret-hygiene-scan.sh`, `validateEnvironment` |
| Cycles | `npm run arch:circular` |
| Quality | lint · typecheck · `test:run` · CI |
| Process | RFC + architecture review (`FEATURE_DEVELOPMENT_GUIDE.md`) |

**When principles conflict with a shortcut, the principle wins.**
