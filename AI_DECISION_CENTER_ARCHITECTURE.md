# Decision Center — Architecture Notes

**Package:** `src/ui/decisionCenter/`

```mermaid
flowchart TB
  Registry[decisionCenterRegistry]
  Root[DecisionCenter]
  Registry -->|gate| Root
  Root --> Summary[DecisionSummary]
  Root --> Meter[ConfidenceMeter]
  Root --> Scores[ScoreBars]
  Root --> Compare[ComparisonCards]
  Root --> Tree[DecisionTreeView]
  State[decisionCenterState] -.-> Root
  Tokens[decisionTokens] -.-> Root
```

| Concern | Status |
|---------|--------|
| Production routes | Not mounted |
| Actual AI reasoning | None (copy placeholders) |
| Runtime / Booking / Maps / Weather / Notifications | Not wired |
| Backend / realtime | None |
| RTL + light/dark + reduced motion | Yes |
