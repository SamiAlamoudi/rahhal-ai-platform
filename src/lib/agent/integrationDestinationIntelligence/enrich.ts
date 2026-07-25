/**
 * Integration Sprint 5 — soft enrich conversation from Destination Intelligence.
 * When flag OFF, returns inputs unchanged.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationDestinationIntelligenceEnabled } from './feature'
import { runDestinationIntelligence, type DestinationIntelligenceDeps } from './engine'
import { detectComparisonQuery, isOpenEndedDestinationAsk } from './compare'
import type { DestinationIntelligenceResult } from './types'

export function shouldRunDestinationIntelligence(input: {
  userText?: string | null
  memory: AgentMemory
  force?: boolean
}): boolean {
  if (input.force) return true
  const text = input.userText?.trim() ?? ''
  if (!text) return false
  if (detectComparisonQuery(text)) return true
  if (isOpenEndedDestinationAsk(text)) return true
  if (input.memory.requirements.destinationFlexible === true && !input.memory.requirements.destination) {
    return true
  }
  return false
}

export async function enrichWithIntegrationDestinationIntelligence(input: {
  memory: AgentMemory
  userText?: string | null
  reply?: string | null
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  enabled?: boolean
  force?: boolean
  deps?: DestinationIntelligenceDeps
}): Promise<{
  memory: AgentMemory
  tripPlan: TripPlan | null
  reply: string | null
  destinationIntelligence: DestinationIntelligenceResult | null
}> {
  const tripPlan = input.tripPlan ?? input.memory.tripPlan
  if (!isIntegrationDestinationIntelligenceEnabled({ enabled: input.enabled })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      destinationIntelligence: null,
    }
  }

  if (!shouldRunDestinationIntelligence({
    userText: input.userText,
    memory: input.memory,
    force: input.force,
  })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      destinationIntelligence: null,
    }
  }

  const result = await runDestinationIntelligence({
    requirements: input.memory.requirements,
    userText: input.userText,
    locale: input.locale ?? input.memory.locale,
    deps: { ...input.deps, enabled: true },
  })

  if (!result.enabled || !result.ok) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      destinationIntelligence: result,
    }
  }

  const locale = input.locale ?? input.memory.locale
  const summary = locale === 'en' ? result.consultantSummaryEn : result.consultantSummaryAr
  const existing = input.reply?.trim() ?? ''
  // Soft overlay: prefer consultant voice; keep prior reply as secondary only if longer context.
  const reply = summary
    ? (existing && existing.length > summary.length + 80
      ? `${summary}\n\n${existing}`
      : summary)
    : (input.reply ?? null)

  let nextMemory = input.memory
  let nextPlan = tripPlan

  // Soft-suggest primary destination without forcing a booking request.
  if (
    result.primary
    && !nextMemory.requirements.destination
    && (result.mode === 'recommend' || result.mode === 'advise')
  ) {
    nextMemory = {
      ...nextMemory,
      requirements: {
        ...nextMemory.requirements,
        destinations: uniqueStrings([
          result.primary.knowledge.nameEn,
          ...nextMemory.requirements.destinations,
        ]).slice(0, 4),
        destinationFlexible: nextMemory.requirements.destinationFlexible ?? true,
      },
    }
  }

  if (nextPlan) {
    const note = locale === 'en'
      ? `Destination intelligence: ${result.consultantSummaryEn.split(/[.。]/)[0]}`
      : `ذكاء الوجهات: ${result.consultantSummaryAr.split(/[.。]/)[0]}`
    nextPlan = {
      ...nextPlan,
      notes: [...nextPlan.notes, note].slice(-12),
    }
    nextMemory = { ...nextMemory, tripPlan: nextPlan }
  }

  return {
    memory: nextMemory,
    tripPlan: nextPlan,
    reply,
    destinationIntelligence: result,
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(v.trim())
  }
  return out
}

export function toDestinationIntelligenceMeta(
  result: DestinationIntelligenceResult | null | undefined,
): {
  mode: string
  primaryId: string | null
  alternativeIds: string[]
  themes: string[]
  summary: string
  score: number | null
  latencyMs: number
} | undefined {
  if (!result?.enabled) return undefined
  return {
    mode: result.mode,
    primaryId: result.primary?.knowledge.id ?? null,
    alternativeIds: result.alternatives.map((a) => a.knowledge.id),
    themes: result.queryThemes,
    summary: result.consultantSummaryEn || result.consultantSummaryAr,
    score: result.primary?.score ?? null,
    latencyMs: result.latencyMs,
  }
}
