/**
 * Evolution Sprint 2 — node invalidation map.
 * Maps slot / signal changes → reasoning nodes that must be refreshed.
 * Unaffected nodes are reused (no full rebuild).
 */

import type { KnownSlots, ReasoningNodeId } from './reflectionTypes'

const ALL_NODES: ReasoningNodeId[] = [
  'intent',
  'profile',
  'constraints',
  'destination',
  'budget',
  'risk',
  'value',
  'recommendation',
  'explanation',
]

/** Downstream dependents — when a node refreshes, these must too. */
const DEPENDENTS: Record<ReasoningNodeId, ReasoningNodeId[]> = {
  intent: ['profile', 'constraints', 'destination', 'budget', 'risk', 'value', 'recommendation', 'explanation'],
  profile: ['constraints', 'destination', 'budget', 'risk', 'value', 'recommendation', 'explanation'],
  constraints: ['destination', 'budget', 'risk', 'value', 'recommendation', 'explanation'],
  destination: ['risk', 'value', 'recommendation', 'explanation'],
  budget: ['value', 'recommendation', 'explanation'],
  risk: ['value', 'recommendation', 'explanation'],
  value: ['recommendation', 'explanation'],
  recommendation: ['explanation'],
  explanation: [],
}

const SLOT_TO_NODES: Record<keyof KnownSlots, ReasoningNodeId[]> = {
  destination: ['destination', 'constraints', 'risk'],
  origin: ['constraints', 'destination'],
  budgetAmount: ['budget', 'constraints', 'value'],
  budgetCurrency: ['budget'],
  durationDays: ['constraints', 'budget', 'value'],
  adults: ['profile', 'constraints', 'risk'],
  children: ['profile', 'constraints', 'risk'],
  monthHint: ['constraints', 'destination', 'risk'],
  interests: ['profile', 'destination', 'value'],
  tripPurpose: ['intent', 'profile', 'destination', 'value', 'risk'],
}

function expandDependents(seeds: ReasoningNodeId[]): ReasoningNodeId[] {
  const set = new Set<ReasoningNodeId>()
  const queue = [...seeds]
  while (queue.length) {
    const n = queue.shift()!
    if (set.has(n)) continue
    set.add(n)
    for (const d of DEPENDENTS[n]) {
      if (!set.has(d)) queue.push(d)
    }
  }
  // Stable order matching pipeline order
  return ALL_NODES.filter((n) => set.has(n))
}

/**
 * Compute dirty nodes from changed slots and whether user text is new.
 * First turn (no cache) → all nodes dirty.
 */
export function computeDirtyNodes(options: {
  isColdStart: boolean
  changedSlots: Array<keyof KnownSlots>
  textOnlyRefine: boolean
}): { dirty: ReasoningNodeId[]; reused: ReasoningNodeId[] } {
  if (options.isColdStart) {
    return { dirty: [...ALL_NODES], reused: [] }
  }

  const seeds = new Set<ReasoningNodeId>()
  for (const slot of options.changedSlots) {
    for (const n of SLOT_TO_NODES[slot]) seeds.add(n)
  }

  // Pure wording change without slot delta — re-check intent lightly, then dependents if needed.
  if (options.textOnlyRefine && seeds.size === 0) {
    seeds.add('intent')
  }

  // Always refresh recommendation+explanation when anything changes (mission: refine).
  if (seeds.size > 0) {
    seeds.add('recommendation')
    seeds.add('explanation')
  }

  const dirty = expandDependents([...seeds])
  const reused = ALL_NODES.filter((n) => !dirty.includes(n))
  return { dirty, reused }
}

export function allReasoningNodes(): ReasoningNodeId[] {
  return [...ALL_NODES]
}

export const NodeInvalidation = {
  computeDirtyNodes,
  allReasoningNodes,
  SLOT_TO_NODES,
  DEPENDENTS,
}
