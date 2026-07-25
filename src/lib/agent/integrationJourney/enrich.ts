/**
 * Integration Sprint 12 — soft enrich from End-to-End Journey coordinator.
 * When flag OFF, returns inputs unchanged. Not a new product surface.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationJourneyEnabled } from './feature'
import { runIntegrationJourney, type JourneyDeps } from './engine'
import type { JourneyResult } from './types'

export function shouldRunIntegrationJourney(input: {
  userText?: string | null
  memory: AgentMemory
  force?: boolean
}): boolean {
  if (input.force) return true
  const text = input.userText?.trim() ?? ''
  if (!text) return false
  // Soft: any planning / travel turn can advance the journey map
  if (input.memory.tripPlan) return true
  if (input.memory.requirements.destination || input.memory.requirements.origin) return true
  if (/trip|travel|plan|book|flight|hotel|budget|رحلة|سفر|خطة|حجز|ميزانية/i.test(text)) {
    return true
  }
  return false
}

export async function enrichWithIntegrationJourney(input: {
  memory: AgentMemory
  userText?: string | null
  reply?: string | null
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  enabled?: boolean
  force?: boolean
  deps?: JourneyDeps
}): Promise<{
  memory: AgentMemory
  tripPlan: TripPlan | null
  reply: string | null
  journey: JourneyResult | null
}> {
  const tripPlan = input.tripPlan ?? input.memory.tripPlan
  if (!isIntegrationJourneyEnabled({ enabled: input.enabled })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      journey: null,
    }
  }

  if (!shouldRunIntegrationJourney({
    userText: input.userText,
    memory: input.memory,
    force: input.force,
  })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      journey: null,
    }
  }

  const result = await runIntegrationJourney({
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
      journey: result,
    }
  }

  const locale = input.locale ?? input.memory.locale
  const summary = locale === 'en' ? result.consultantSummaryEn : result.consultantSummaryAr
  const existing = input.reply?.trim() ?? ''
  // Prefer existing module-owned reply when longer; otherwise journey summary
  const reply = existing && existing.length > summary.length
    ? existing
    : (summary || input.reply || null)

  let nextPlan = tripPlan
  let nextMemory = input.memory
  if (nextPlan && result.ok) {
    const note = locale === 'en'
      ? `Journey: ${result.stage} · score ${result.decision.overall}`
      : `رحلة: ${result.stage} · درجة ${result.decision.overall}`
    nextPlan = {
      ...nextPlan,
      notes: [...nextPlan.notes, note].slice(-12),
    }
    nextMemory = { ...nextMemory, tripPlan: nextPlan, itinerary: nextPlan }
  }

  return {
    memory: nextMemory,
    tripPlan: nextPlan,
    reply,
    journey: result,
  }
}

export function toJourneyMeta(
  result: JourneyResult | null | undefined,
): {
  stage: string
  scenario: string
  overall: number
  knownSlots: number
  skippedModules: number
  turn: number
  summary: string
  latencyMs: number
} | undefined {
  if (!result?.enabled) return undefined
  return {
    stage: result.stage,
    scenario: result.scenario,
    overall: result.decision.overall,
    knownSlots: result.handoff.knownSlots.length,
    skippedModules: result.stages.filter((s) => s.status === 'skipped').length,
    turn: result.memory.turn,
    summary: result.consultantSummaryEn || result.consultantSummaryAr,
    latencyMs: result.latencyMs,
  }
}
