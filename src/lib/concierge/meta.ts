/**
 * Persist / restore Concierge state via agent provider_meta.
 * Additive only — does not break AgentProviderMeta consumers.
 */

import type { ConciergeState } from './types'
import { emptyConciergeState, emptySoftSignals } from './types'

export function isConciergeState(value: unknown): value is ConciergeState {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.phase === 'string'
    && typeof row.turnCount === 'number'
    && !!row.softSignals
    && typeof row.softSignals === 'object'
}

export function conciergeStateFromMeta(
  meta: Record<string, unknown> | null | undefined,
): ConciergeState | null {
  if (!meta || typeof meta !== 'object') return null
  const raw = meta.concierge
  if (!isConciergeState(raw)) return null
  return {
    phase: raw.phase,
    softSignals: {
      ...emptySoftSignals(),
      ...raw.softSignals,
      mustHaves: [...(raw.softSignals.mustHaves ?? [])],
      dealBreakers: [...(raw.softSignals.dealBreakers ?? [])],
      flexibleDimensions: [...(raw.softSignals.flexibleDimensions ?? [])],
      tradeoffs: [...(raw.softSignals.tradeoffs ?? [])],
      notes: [...(raw.softSignals.notes ?? [])],
    },
    lastAction: raw.lastAction ?? null,
    heardSummary: [...(raw.heardSummary ?? [])],
    turnCount: raw.turnCount,
  }
}

export function rebuildConciergeStateFromMessages(
  messages: Array<{ role: string; providerMeta?: Record<string, unknown> | null }>,
): ConciergeState | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue
    const state = conciergeStateFromMeta(msg.providerMeta ?? null)
    if (state) return state
  }
  return null
}

export function withConciergeState<T extends Record<string, unknown>>(
  meta: T,
  state: ConciergeState | null,
): T & { concierge?: ConciergeState } {
  if (!state) return meta
  return { ...meta, concierge: state }
}

export { emptyConciergeState }
