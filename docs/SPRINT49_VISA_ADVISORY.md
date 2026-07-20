# Sprint 49 — Visa & Travel Advisory Intelligence

Every destination recommendation must explain **visa** and **travel logistics** like a professional consultant — not raw enum codes.

## Product rule

> Reason over visa, safety, season, and logistics before recommending.

## Capabilities

| Module | Role |
|--------|------|
| `visaIntelligence.ts` | Processing time, documents, fees, Schengen/UK/Canada/Japan hints |
| `travelAdvisory.ts` | Safety/season/logistics from catalog risk codes |
| `formatReasoningReply.ts` | Warm consultant voice + structured visa/advisory lines |

## Example output (EN)

```
Got it (cold weather · budget ≈ 12000 SAR). I ranked destinations for climate, budget, and visa fit — no forms.

My picks as your travel consultant:

1) Switzerland
   Why: Climate matches your preference (cool)
   Trip estimate: ≈ 18500 SAR
   Visa: Switzerland: advance embassy visa · Schengen visa — book VFS slot early
   Timing: 2–4 weeks (embassy/VAC appointment)
   Advisory: Secure visa timing before non-refundable flights
```

## Non-goals

- Live embassy APIs or legal advice
- Replacing dedicated visa tool in agent tools (still runs at plan time)

## Tests

`src/lib/__tests__/visaIntelligence.sprint49.test.ts`
