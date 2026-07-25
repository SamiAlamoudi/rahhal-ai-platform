# Memory Strategy — Phase 6 Stage 5

## Retrieval

`MemoryRetrievalStrategyContract` — `strategyId` + declarative `steps[]`  
Default steps: filter by session → filter by entity → order by recency hint  
`execution: 'none'`

## Ranking

`MemoryRankingContract` — `rankedIds` + `methodHint` (no comparator)

## Merge

`MemoryMergeStrategyContract` — rules like `prefer_newer`, `dedupe_by_key`

## Lifecycle & retention

- Lifecycle phases: create → active → stale → archive → purge_hint  
- Retention policy: `maxAgeHint`, `maxItemsHint` (placeholders)

## Confidence & audit

- Confidence model: score/band/factors  
- Audit trail: entries with `persisted: false`

No embeddings, vector search, or storage backends.
