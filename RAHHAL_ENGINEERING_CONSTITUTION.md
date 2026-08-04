# Rahhal Engineering Constitution

**One page. Binding. All future development follows this.**

---

## Preamble

Rahhal is a Conversation-First AI travel consultant. Architecture Freeze established a single product spine and frozen AI cores. This constitution permanently governs engineering, AI behavior, and feature delivery.

---

## Product spine (immutable)

```
/chat → LegacyChatPage → chatEngine → travel-agent → planTurn
```

There is one conversation system, one turn owner (`planTurn`), one primary chat UI. No parallel SoTs.

---

## Frozen cores (do not rewrite)

1. **Decision Engine** — mandatory for ranking and selection  
2. **Planning Draft** — deterministic plan structure  
3. **Conversation Brain** — traveler-facing language  
4. **Smart Clarification** — ask only what is necessary  
5. **Production Authority** — Edge auth/CORS; OpenAI & Booking proxies  

Extend via stages, tools, adapters, and flags—not forks.

---

## Engineering law

| # | Law |
|---|-----|
| 1 | **Conversation First** — dialogue owns the product; forms serve chat |
| 2 | **Decision Engine mandatory** — no ad-hoc “pick cheapest” in UI/tools |
| 3 | **Planning Draft deterministic** — LLMs narrate; they don’t replace draft structure |
| 4 | **Clarify minimally** — understand and infer before asking |
| 5 | **No duplicated business logic** — one owner per rule |
| 6 | **No client secrets** — never `VITE_*` provider credentials |
| 7 | **Server-only privilege** — suppliers and LLMs via Edge/server proxies |
| 8 | **Adapters only** — all providers behind ProviderAdapter registries |
| 9 | **Testable by default** — unit tests mandatory; provider changes need integration tests |
| 10 | **No performance regression** — protect chat chunk and turn cancellation |
| 11 | **Flags for experiments** — default OFF; staging before production |
| 12 | **AI changes need regressions** — lock behavior with tests |

---

## AI law

Understand before asking · Analyze before recommending · Compare before deciding · Recommend with reasoning · Explain trade-offs · Never invent facts · Ask only when confidence is insufficient · Maximize traveler **value** (not merely cheapest) · Preserve context · Speak at consultant level through the Conversation Brain.

---

## Feature law

1. **RFC first**  
2. **Architecture review before code**  
3. **Unit tests mandatory**  
4. **Integration tests for provider changes**  
5. **Docs updated with the feature**  
6. **Never bypass Conversation Brain** for traveler dialogue  
7. **Never bypass planTurn** for turn orchestration  

---

## Enforcement

CI: secret hygiene · typecheck · lint · circular imports · tests · providers check · build.  
Process: RFC + review.  
Conflict: **constitution wins over convenience.**

---

## Full references

- `RAHHAL_ENGINEERING_PRINCIPLES.md`  
- `AI_DESIGN_PRINCIPLES.md`  
- `FEATURE_DEVELOPMENT_GUIDE.md`  
- `FINAL_ARCHITECTURE_AUDIT.md` · `FINAL_TECHNICAL_DEBT.md` · `FINAL_PRODUCTION_CHECKLIST.md`

---

*By contributing to Rahhal, you agree to uphold this constitution.*
