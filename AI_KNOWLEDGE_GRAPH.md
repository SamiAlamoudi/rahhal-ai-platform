# Knowledge Graph — Phase 6 Stage 6

**Contract:** `KnowledgeGraphContract`

## Shape

- **Nodes** — `id`, `label`, `domain` (`KnowledgeCoverageDomain`)
- **Edges** — `id`, `fromId`, `toId`, `relationHint`
- `execution: 'none'`

Default blueprint returns empty `nodes` / `edges`.

## References

`KnowledgeReferenceContract` links refs to document / entity / source / category targets — declarative ids only.

No graph database, traversal engine, or embeddings.
