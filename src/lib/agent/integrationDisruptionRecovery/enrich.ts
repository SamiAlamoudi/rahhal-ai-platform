/**
 * Integration Sprint 10 — soft enrich conversation from Live Disruption Recovery.
 * When flag OFF, returns inputs unchanged.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationDisruptionRecoveryEnabled } from './feature'
import { runDisruptionRecovery, type DisruptionRecoveryDeps } from './engine'
import { detectDisruptionKind, detectRecoveryIntent } from './detector'
import type { DisruptionRecoveryResult } from './types'

export function shouldRunDisruptionRecovery(input: {
  userText?: string | null
  memory: AgentMemory
  force?: boolean
}): boolean {
  if (input.force) return true
  const text = input.userText?.trim() ?? ''
  if (!text) return false
  if (detectDisruptionKind(text)) return true
  const intent = detectRecoveryIntent(text)
  if (intent === 'what_now' && input.memory.tripPlan) return true
  if (intent === 'choose_recovery') return true
  return false
}

export async function enrichWithIntegrationDisruptionRecovery(input: {
  memory: AgentMemory
  userText?: string | null
  reply?: string | null
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  enabled?: boolean
  force?: boolean
  deps?: DisruptionRecoveryDeps
}): Promise<{
  memory: AgentMemory
  tripPlan: TripPlan | null
  reply: string | null
  disruptionRecovery: DisruptionRecoveryResult | null
}> {
  const tripPlan = input.tripPlan ?? input.memory.tripPlan
  if (!isIntegrationDisruptionRecoveryEnabled({ enabled: input.enabled })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      disruptionRecovery: null,
    }
  }

  if (!shouldRunDisruptionRecovery({
    userText: input.userText,
    memory: input.memory,
    force: input.force,
  })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      disruptionRecovery: null,
    }
  }

  const result = await runDisruptionRecovery({
    memory: input.memory,
    tripPlan,
    userText: input.userText,
    locale: input.locale ?? input.memory.locale,
    deps: { ...input.deps, enabled: true },
  })

  if (!result.enabled) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      disruptionRecovery: result,
    }
  }

  const locale = input.locale ?? input.memory.locale
  const summary = locale === 'en' ? result.consultantSummaryEn : result.consultantSummaryAr
  const existing = input.reply?.trim() ?? ''
  const reply = summary
    ? (existing && existing.length > summary.length + 80 ? `${summary}\n\n${existing}` : summary)
    : (input.reply ?? null)

  let nextPlan = tripPlan
  let nextMemory = input.memory
  if (nextPlan && result.ok && result.replan) {
    const note = locale === 'en'
      ? `Disruption recovery: ${result.disruption?.summaryEn ?? 'replan'} · ${result.primary?.titleEn ?? 'options ready'}`
      : `استعادة التعطيل: ${result.disruption?.summaryAr ?? 'إعادة تخطيط'} · ${result.primary?.titleAr ?? 'خيارات جاهزة'}`
    nextPlan = {
      ...nextPlan,
      notes: [...nextPlan.notes, note, ...result.replan.notesEn.slice(0, 2)].slice(-12),
    }
    if (result.replan.budgetDelta > 0 && nextPlan.estimatedBudget) {
      nextPlan = {
        ...nextPlan,
        estimatedBudget: {
          ...nextPlan.estimatedBudget,
          amount: nextPlan.estimatedBudget.amount + result.replan.budgetDelta,
          breakdown: [
            ...nextPlan.estimatedBudget.breakdown,
            { label: 'Disruption recovery', amount: result.replan.budgetDelta },
          ],
        },
      }
    }
    nextMemory = { ...nextMemory, tripPlan: nextPlan, itinerary: nextPlan }
  }

  return {
    memory: nextMemory,
    tripPlan: nextPlan,
    reply,
    disruptionRecovery: result,
  }
}

export function toDisruptionRecoveryMeta(
  result: DisruptionRecoveryResult | null | undefined,
): {
  intent: string
  kind: string | null
  risk: string | null
  strategy: string | null
  planCount: number
  replanned: boolean
  summary: string
  latencyMs: number
} | undefined {
  if (!result?.enabled) return undefined
  return {
    intent: result.intent,
    kind: result.disruption?.kind ?? null,
    risk: result.risk,
    strategy: result.primary?.strategy ?? null,
    planCount: result.plans.length,
    replanned: Boolean(result.replan),
    summary: result.consultantSummaryEn || result.consultantSummaryAr,
    latencyMs: result.latencyMs,
  }
}
