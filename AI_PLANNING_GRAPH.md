# AI Planning Graph — Evolution Sprint 4

**Status:** Additive foundation · **Not** wired into `planTurn` · Flag `ai.planning_graph` **default OFF**  
**Depends on (library only):** Sprint 1 Reasoning · Sprint 2 Reflection (opaque refs; modules not modified)  
**Freeze:** Decision Engine · Planning Draft · Conversation Brain · Smart Clarification · Production Authority · `planTurn` · Reasoning · Reflection sources remain untouched.

Rahhal maintains **multiple travel plans simultaneously** — compare, preserve, branch, reject, and revisit — instead of replacing previous thinking.

---

## 1. Planning DAG

```
PlanningGraphState
├── nodes{}              PlanNodeData (DAG vertices)
├── edges[]              branch | merge | clone | restore | reject | supersede
├── branches{}           ScenarioBranchRecord (lineage tips)
├── versions[]           PlanVersionRecord (append-only snapshots)
├── forks[]              DecisionForkRecord (why a fork happened)
├── rejectedNodeIds[]    preserved rejects (never hard-deleted)
├── activeBranchId
└── decisionLog[]        action audit (create/branch/merge/compare/…)
```

### Plan Node contents

| Field | Role |
|-------|------|
| Intent | Consultant intent label |
| Traveler Profile Snapshot | Soft profile at node time |
| Constraints | Hard / soft / flexible |
| Budget | Amount / currency / stance |
| Dates | Duration / month / flexibility |
| Destinations | One or many labels |
| Confidence | 0–1 |
| Score | 0–100 composite |
| Reasoning reference | Opaque Sprint 1 ref |
| Reflection reference | Opaque Sprint 2 ref |
| Evidence / Assumptions / Risks / Trade-offs / Missing data | Audit |
| whyExists | Why this branch/node exists |
| Timestamp | `createdAt` / `updatedAt` |

Edges form a **DAG** (not a single overwrite stack): merges create a new node with two parents; restores clone from a prior node without erasing it.

---

## 2. Branch lifecycle

```
create (root)
   │
   ├─ branch  → new ScenarioBranch + DecisionFork + edge(branch)
   ├─ clone   → independent copy (keeps source)
   ├─ merge   → new node; parents marked merged; branches status=merged
   ├─ reject  → status=rejected; kept in rejectedNodeIds
   ├─ restore → new active node from rejected/prior; edge(restore)
   ├─ compare → PlanComparisonResult (non-destructive)
   └─ score   → recompute composite score on a node
```

**Invariant:** Rejected plans are **kept** so the traveler can return to previous ideas.

**Propagation on branch/merge:**

- `ConstraintPropagation` — inherit hard/soft constraints
- `PreferencePropagation` — merge interests / soft profile; blend confidence

---

## 3. Confidence propagation

When branching:

```
child.confidence = child.confidence * 0.7 + parent.confidence * 0.3
```

If the child is well-specified (no missing data + destinations present), confidence may rise toward `max(child, parent * 0.9)`.

Scores (`BestPlanSelector` / `scorePlanNode`) combine base score, confidence, destination/budget/date completeness, and penalties for risks / missing data / rejected status.

---

## 4. Decision history

Every mutating operation appends to `decisionLog`:

| Action | Detail |
|--------|--------|
| create | Root plan id |
| branch | Fork reason + parent/child ids |
| merge | Merge rationale + parent pair + result |
| clone | Clone rationale |
| reject | Rejection reason (node retained) |
| restore | Restore rationale + new node id |
| compare | Compared pair |

Plus structured `forks[]` and `versions[]` for forensic replay.

Supporting selectors (non-mutating):

- `MergeCandidates` — compatibility + conflicts  
- `DiscardCandidates` — weak plans suggested for reject  
- `BestPlanSelector` — current best active tip  
- `AlternativePlan` — ranked alternative views  
- `PlanComparison` — score/confidence deltas + reasons  

---

## 5. Operations API

| Op | Entry |
|----|-------|
| Branch | `PlanningGraph.branch` |
| Merge | `PlanningGraph.merge` |
| Compare | `PlanningGraph.compare` |
| Reject | `PlanningGraph.reject` |
| Restore | `PlanningGraph.restore` |
| Clone | `PlanningGraph.clone` |
| Score | `PlanningGraph.score` |

Gate: `tryCreatePlanningGraph` / `isPlanningGraphEnabled` (`ai.planning_graph`, default OFF).

---

## 6. Performance / production impact

| Concern | Sprint 4 |
|---------|----------|
| Network / API / LLM | **None** |
| planTurn wiring | **None** |
| Default flag | **OFF** |
| Production chat | **Zero** while unwired |
| CPU | In-memory DAG ops only |

---

## 7. Tests

`src/lib/__tests__/planningGraph.sprint4.test.ts`

Graph creation · branch/merge/restore · comparison · Arabic · English · regression (Reasoning/Reflection untouched; no `planTurn` export)
