/**
 * Evolution Sprint 4 — ConstraintPropagation
 * Propagate hard/soft constraints from parent → child along the DAG.
 */

import { uniqueStrings, type PlanNodeData } from './planningGraphTypes'

export function propagateConstraints(
  parent: PlanNodeData,
  child: PlanNodeData,
  options?: { inheritHard?: boolean; inheritSoft?: boolean },
): PlanNodeData {
  const inheritHard = options?.inheritHard !== false
  const inheritSoft = options?.inheritSoft !== false
  return {
    ...child,
    constraints: {
      hard: inheritHard
        ? uniqueStrings([...parent.constraints.hard, ...child.constraints.hard])
        : [...child.constraints.hard],
      soft: inheritSoft
        ? uniqueStrings([...parent.constraints.soft, ...child.constraints.soft])
        : [...child.constraints.soft],
      flexibleDimensions: uniqueStrings([
        ...parent.constraints.flexibleDimensions,
        ...child.constraints.flexibleDimensions,
      ]),
    },
    updatedAt: child.updatedAt,
  }
}

export function constraintConflicts(a: PlanNodeData, b: PlanNodeData): string[] {
  const conflicts: string[] = []
  const aDest = a.constraints.hard.find((h) => h.startsWith('destination:'))
  const bDest = b.constraints.hard.find((h) => h.startsWith('destination:'))
  if (aDest && bDest && aDest !== bDest) {
    conflicts.push(`hard_destination_mismatch:${aDest}|${bDest}`)
  }
  const aBudget = a.constraints.hard.find((h) => h.startsWith('budget_cap:'))
  const bBudget = b.constraints.hard.find((h) => h.startsWith('budget_cap:'))
  if (aBudget && bBudget && aBudget !== bBudget) {
    conflicts.push(`hard_budget_mismatch:${aBudget}|${bBudget}`)
  }
  return conflicts
}

export const ConstraintPropagation = {
  propagate: propagateConstraints,
  conflicts: constraintConflicts,
}
