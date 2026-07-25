# AI Unified Consultant Response — Stage 3

**Status:** Additive aggregation layer · Flag `ai.consultant_response` **default OFF**  
**Freeze:** Production planning · AI engine internals · itinerary / destination / pricing / booking mutations remain untouched.

Stage 3 consumes existing Consultant Pipeline stage outputs and aggregates them into one consultant-grade response with multiple formats.

---

## 1. Mission

| Input layers (read-only) | Role |
|--------------------------|------|
| Traveler Intelligence | Traveler understanding |
| Destination Intelligence | Destination understanding |
| Travel Strategy | Recommended strategy |
| Recommendation Intelligence | Primary / alternative / benefits / risks |
| Reflection | Latest recommendation + clarification cues |
| Planning Graph | Evidence attribution (root plan id) |

**Only aggregation.** No engine rewrites. No planning mutation.

---

## 2. Response body

| Field | Description |
|-------|-------------|
| Executive Summary | Top-line consultant takeaway |
| Traveler Understanding | Who we think we are serving |
| Destination Understanding | Destination fit notes |
| Recommended Strategy | How to travel (timing / budget / comfort) |
| Primary Recommendation | Lead recommendation |
| Alternative Recommendation | Contrast option |
| Trade-offs / Benefits / Risks / Opportunity Cost | Decision framing |
| Confidence Score | Aggregated confidence |
| Evidence Summary | Non-PII evidence strings |
| Missing Information | Gaps — never invented |
| Clarification Questions | Asked when confidence is low |

---

## 3. Formats

| Format | Use |
|--------|-----|
| **Executive** | Headline + one-liner + confidence + next step |
| **Short** | Title / why / why-not / missing |
| **Detailed** | Full sectioned brief |
| **Consultant** | Voice + justification + assumptions noted |

---

## 4. Confidence policy

If confidence &lt; threshold (default `0.35`):

- Mark `lowConfidence`
- Prefer missing information + clarification questions in the executive summary
- **Never invent** destinations, prices, or itinerary facts

---

## 5. Feature flag & performance

| Flag | Default | Behavior |
|------|---------|----------|
| `ai.consultant_response` | **OFF** | No aggregation import / execution |

When ON (via registry or `consultantResponseEnabled: true`):

1. Production `planTurn` completes unchanged  
2. Pipeline runs once (shared with Stage 2 when both ON)  
3. Aggregator builds `meta.consultantResponse`  
4. `tripPlan` / `reply` / `memory` references preserved  

---

## 6. Package layout

| File | Role |
|------|------|
| `consultantResponseTypes.ts` | Body + formats contracts |
| `consultantResponseFeature.ts` | Flag gate |
| `consultantResponseAggregator.ts` | Stage-output aggregation |
| `consultantResponseFormats.ts` | Executive / Short / Detailed / Consultant |
| `consultantResponseTelemetry.ts` | Timing + confidence metrics (no PII) |
| `consultantResponse.ts` | `build` / `tryBuild` / `enrichTurn` |

---

## 7. Explicit non-goals

- No AI algorithm changes  
- No itinerary / destination / pricing / booking edits  
- No default-ON flag  
- No merge to `main`
