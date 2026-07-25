/**
 * Evolution Sprint 2 — AssumptionTracker
 * Tracks assumptions; invalidates when new evidence contradicts them.
 */

import {
  isoNow,
  newId,
  uniqueStrings,
  type AssumptionRecord,
  type CachedReasoningNodes,
  type ConversationTurn,
  type ReasoningNodeId,
} from './reflectionTypes'

function collectAssumptionsFromNodes(nodes: CachedReasoningNodes): Array<{ text: string; node: ReasoningNodeId }> {
  const rows: Array<{ text: string; node: ReasoningNodeId }> = []
  const push = (node: ReasoningNodeId, list: string[] | undefined) => {
    for (const text of list ?? []) rows.push({ text, node })
  }
  push('intent', nodes.intent?.assumptions)
  push('profile', nodes.profile?.assumptions)
  push('constraints', nodes.constraints?.assumptions)
  push('destination', nodes.destination?.assumptions)
  push('budget', nodes.budget?.assumptions)
  push('risk', nodes.risk?.assumptions)
  push('value', nodes.value?.assumptions)
  push('recommendation', nodes.recommendation?.assumptions)
  push('explanation', nodes.explanation?.assumptions)
  return rows
}

export function syncAssumptions(
  existing: AssumptionRecord[],
  nodes: CachedReasoningNodes,
  now?: Date,
): AssumptionRecord[] {
  const stamp = isoNow(now)
  const nextTexts = collectAssumptionsFromNodes(nodes)
  const byText = new Map(existing.map((a) => [a.text, a]))
  const out: AssumptionRecord[] = []

  for (const row of nextTexts) {
    const prev = byText.get(row.text)
    if (prev) {
      out.push({
        ...prev,
        status: prev.status === 'invalidated' ? 'active' : prev.status,
        node: row.node,
        updatedAt: stamp,
      })
      byText.delete(row.text)
    } else {
      out.push({
        id: newId('asm', now),
        text: row.text,
        node: row.node,
        status: 'active',
        createdAt: stamp,
        updatedAt: stamp,
        evidence: [],
      })
    }
  }

  // Remaining old assumptions not re-stated → keep but mark stale only if contradicted later.
  for (const leftover of byText.values()) {
    if (leftover.status !== 'invalidated') {
      out.push(leftover)
    } else {
      out.push(leftover)
    }
  }
  return out
}

/**
 * Invalidate assumptions contradicted by new turn evidence / slots.
 */
export function invalidateAssumptionsOnTurn(
  assumptions: AssumptionRecord[],
  turn: ConversationTurn,
  now?: Date,
): AssumptionRecord[] {
  const stamp = isoNow(now)
  const dest = turn.slotDelta.destination
  const budget = turn.slotDelta.budgetAmount
  const purpose = turn.slotDelta.tripPurpose

  return assumptions.map((a) => {
    if (a.status === 'invalidated') return a
    let contradicted = false
    if (dest && /destination implied|No destination|open/i.test(a.text) && /unknown|open|implied/i.test(a.text)) {
      contradicted = true
    }
    if (typeof budget === 'number' && /No numeric budget|No budget stance|inventing a price/i.test(a.text)) {
      contradicted = true
    }
    if (purpose && /Purpose not yet|trip purpose/i.test(a.text)) {
      contradicted = true
    }
    if (dest && /may already have a destination implied/i.test(a.text)) {
      contradicted = true
    }
    if (!contradicted) return a
    return {
      ...a,
      status: 'invalidated' as const,
      updatedAt: stamp,
      evidence: uniqueStrings([...a.evidence, ...turn.evidence, `turn:${turn.id}`]),
    }
  })
}

export function activeAssumptionTexts(assumptions: AssumptionRecord[]): string[] {
  return assumptions.filter((a) => a.status === 'active').map((a) => a.text)
}

export const AssumptionTracker = {
  syncAssumptions,
  invalidateAssumptionsOnTurn,
  activeAssumptionTexts,
}
