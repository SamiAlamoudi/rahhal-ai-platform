# Budget & Pricing — Scenario Examples (Sprint 9)

**Draft PR:** [#273](https://github.com/SamiAlamoudi/rahhal-ai-platform/pull/273)  
Flag `ai.integration_budget_pricing` remains **OFF** by default.

---

## Scenario 1 — Set budget

**Traveler:** I have SAR 6000.

**Rahhal:** Builds envelope (total / per day / reserve), ranks tiers, explains estimated spend and headroom or overage.

---

## Scenario 2 — Stay under

**Traveler:** Stay under my budget.

**Rahhal:** Prefers balanced/best-value options that remain within the cap; surfaces trade-offs if a premium path exceeds.

---

## Scenario 3 — Find cheaper

**Traveler:** Find something cheaper.

**Rahhal:** Bias toward budget tier + flexible alternatives (dates, hotel class, airline, airport, destination).

---

## Scenario 4 — Luxury but worth it

**Traveler:** Luxury but worth it.

**Rahhal:** Luxury/premium scoring with trade-off language (“costs more but saves ~X hours”) and reserve awareness.

---

## Scenario 5 — Flag OFF regression

Budget pricing package is not loaded; Sprint 75 `ai.budget_intelligence` path (when otherwise enabled) is unchanged.
