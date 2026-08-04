# Feature Development Guide

**Status:** Binding process for all new product work  
**Prerequisites:** Architecture Freeze complete; read `RAHHAL_ENGINEERING_PRINCIPLES.md` and `AI_DESIGN_PRINCIPLES.md`  
**Constitution:** `RAHHAL_ENGINEERING_CONSTITUTION.md`

This guide defines **how** features are proposed, reviewed, built, tested, and documented. Shortcuts that skip these steps are constitution violations.

---

## 1. Every new feature starts with an RFC

Before implementation:

1. Open a short RFC (PR description or `docs/rfc/` note) covering:
   - Problem / traveler value  
   - Proposed surface (chat turn, tool, adapter, UI illustration)  
   - Touchpoints on `planTurn` / Decision Engine / Brain / Clarification  
   - Flags (default OFF for experiments)  
   - Test plan  
   - Explicit non-goals (what you will **not** rewrite)  
2. Flag any impact on frozen cores (usually: **none allowed** without special approval).

No RFC → no architecture review → no merge of non-trivial features.

---

## 2. Architecture review before implementation

Reviewers confirm:

| Check | Pass criteria |
|-------|----------------|
| Conversation First | Enters via `/chat` → `planTurn`; no new SoT |
| No core rewrite | Frozen AI / Production Authority untouched |
| No client secrets | Privileged work on Edge/server |
| Adapters | New suppliers behind ProviderAdapter |
| Flags | Experiments gated; production defaults safe |
| Quarantine | No static import of finance/orchestrator graphs onto default chat chunk |

Implementation starts only after review approval (or documented waiver).

---

## 3. Unit tests are mandatory

- Pure logic (extractors, scorers, clarifiers, formatters, stage helpers): unit tests required.
- New planTurn stage behavior: tests under `src/lib/agent/planTurn/__tests__/` or adjacent suites.
- Feature flags: tests must toggle flags explicitly—do not rely on developer `.env.local`.

PRs without tests for new logic fail review.

---

## 4. Integration tests for provider changes

When changing:

- Provider adapters, registries, proxy clients, auth/token flows, or fallback behavior  

require integration tests (mocked HTTP) that cover:

- Success path  
- Auth / rate-limit / network failure → mock or next-provider fallback  
- No leakage of secrets into client config  

Live smoke tests (Amadeus, etc.) remain optional ops scripts—not a substitute for CI integration tests.

---

## 5. Documentation updated with every feature

Update the **smallest accurate** docs set:

- User/ops impact → README or runbook section if behavior changes  
- Flags → `FEATURE_REGISTRY.md`  
- Env → `.env.example` (never document forbidden `VITE_*` secrets as enable paths)  
- Architecture touchpoints → brief note in PR; update `AI_ARCHITECTURE.md` only if ownership maps change  

Do not leave sprint docs that contradict Production Authority (proxy-only secrets).

---

## 6. No feature may bypass the Conversation Brain

Traveler-facing natural language for planning/advice turns is authored through the Conversation Brain (facts → speak path).

Forbidden:

- Hard-coded multi-paragraph “AI” replies in React for plan turns  
- Tool UIs that replace Brain narration as the sole response  
- New “assistant” modules that speak to travelers without going through the Brain speak path on the product spine  

Cards, timelines, and booking bars **illustrate**; they do not own dialogue.

---

## 7. No feature may bypass PlanTurn orchestration

| Allowed | Forbidden |
|---------|-----------|
| New stage, tool, enricher, or flag-gated branch **inside** `runPlanTurn` | Page/API that plans trips without `planTurn` |
| Calling `travelAgentService` methods already on the service | Forking a second turn orchestrator |
| Search workspace as **secondary intake** that eventually hands off to chat | Rebuilding TravelConversation as a second SoT |

If a feature needs a new stage, add a typed stage module—do not grow ad-hoc logic in `ChatPage`.

---

## Implementation checklist (author)

- [ ] RFC written and architecture-reviewed  
- [ ] Touches only approved layers (stages / tools / adapters / flagged UI)  
- [ ] No frozen-core rewrite  
- [ ] No new client secrets; proxies used where privileged  
- [ ] Feature flag for experimental behavior (default OFF)  
- [ ] Unit tests added/updated  
- [ ] Provider integration tests if adapters/proxies changed  
- [ ] Docs / `.env.example` / feature registry updated  
- [ ] `npm run lint` · `typecheck` · `test:run` green  
- [ ] No quarantine graphs statically imported on default chat path  

---

## Reviewer checklist

- [ ] Conversation First preserved  
- [ ] Decision Engine still mandatory for ranking/selection  
- [ ] Planning Draft determinism not broken  
- [ ] Smart Clarification still minimal-ask  
- [ ] Brain not bypassed for traveler copy  
- [ ] planTurn not bypassed for turn ownership  
- [ ] Tests lock AI/behavior claims  
- [ ] Performance/quarantine not regressed  

---

## Escalation

Incidents that require touching frozen cores need:

1. Explicit incident/hotfix RFC  
2. Minimal diff  
3. Regression tests before merge  
4. Post-incident note in changelog / debt register  

Convenience is not an escalation reason.
