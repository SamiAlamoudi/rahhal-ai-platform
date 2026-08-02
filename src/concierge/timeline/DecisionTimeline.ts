import type { BrainTurnTrace } from '../../brain'
import type { DecisionTimelineEntry } from '../types'

let decisionSeq = 0

/**
 * Beautiful decision timeline — review / change / restore / compare ready.
 */
export function appendDecision(
  history: DecisionTimelineEntry[],
  trace: BrainTurnTrace,
  locale: 'ar' | 'en' = 'en',
): DecisionTimelineEntry[] {
  const ar = locale === 'ar'
  const id = `dec-${Date.now()}-${decisionSeq++}`
  const entry: DecisionTimelineEntry = {
    id,
    at: new Date().toISOString(),
    title: ar
      ? `قرار: ${trace.decision.action}`
      : `Decision: ${trace.decision.action}`,
    summary: ar
      ? `${trace.intent.id} · ${trace.decision.toolRoute?.toolId ?? 'clarification'}`
      : `${trace.intent.id} · ${trace.decision.toolRoute?.toolId ?? 'clarification'}`,
    status: 'active',
    payload: {
      intent: trace.intent.id,
      action: trace.decision.action,
      tool: trace.decision.toolRoute?.toolId ?? '',
      destination: trace.draft.destination ?? '',
      reply: trace.reply.slice(0, 160),
    },
  }
  const prior = history.map((h) =>
    h.status === 'active' ? { ...h, status: 'superseded' as const } : h,
  )
  return [entry, ...prior].slice(0, 24)
}

export function restoreDecision(
  history: DecisionTimelineEntry[],
  id: string,
): DecisionTimelineEntry[] {
  return history.map((h) => {
    if (h.id === id) return { ...h, status: 'restored' }
    if (h.status === 'restored') return { ...h, status: 'superseded' }
    return h
  })
}

export function compareDecisions(
  history: DecisionTimelineEntry[],
  aId: string,
  bId: string,
): { a: DecisionTimelineEntry | null; b: DecisionTimelineEntry | null } {
  return {
    a: history.find((h) => h.id === aId) ?? null,
    b: history.find((h) => h.id === bId) ?? null,
  }
}
