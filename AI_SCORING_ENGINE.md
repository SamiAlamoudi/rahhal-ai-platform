# Scoring Engine — Phase 6 Stage 4

**Contracts:** `ScoringEngineContract`, `RankingEngineContract`, `ConfidenceCalculatorContract`

## Scoring

- Per-alternative `score` + optional `dimensions[]`
- Default blueprint returns empty `scores` (`execution: 'none'`)

## Ranking

- `rankedIds` ordered list + `methodHint`
- No comparator implementation

## Confidence

- `score`, `band` (`low` | `medium` | `high`), `factors[]`
- Placeholder factors only — no live model

Related: Cost Optimizer, Risk Evaluator, Tradeoff Analyzer — all non-executing shapes.
