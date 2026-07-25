/**
 * Integration Sprint 8 — soft enrich conversation from Maps & Live Mobility.
 * When flag OFF, returns inputs unchanged.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationMapsMobilityEnabled } from './feature'
import { runMapsMobility, type MapsMobilityDeps } from './engine'
import { isMapsMobilityAsk } from './intents'
import type { MapsMobilityResult } from './types'

export function shouldRunMapsMobility(input: {
  userText?: string | null
  memory: AgentMemory
  force?: boolean
}): boolean {
  if (input.force) return true
  const text = input.userText?.trim() ?? ''
  if (!text) return false
  if (isMapsMobilityAsk(text)) return true
  if (input.memory.tripPlan && /airport|مطار|hotel|فندق|how to get|كيف أصل/i.test(text)) {
    return true
  }
  return false
}

export async function enrichWithIntegrationMapsMobility(input: {
  memory: AgentMemory
  userText?: string | null
  reply?: string | null
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  enabled?: boolean
  force?: boolean
  deps?: MapsMobilityDeps
}): Promise<{
  memory: AgentMemory
  tripPlan: TripPlan | null
  reply: string | null
  mapsMobility: MapsMobilityResult | null
}> {
  const tripPlan = input.tripPlan ?? input.memory.tripPlan
  if (!isIntegrationMapsMobilityEnabled({ enabled: input.enabled })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      mapsMobility: null,
    }
  }

  if (!shouldRunMapsMobility({
    userText: input.userText,
    memory: input.memory,
    force: input.force,
  })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      mapsMobility: null,
    }
  }

  const result = await runMapsMobility({
    memory: input.memory,
    tripPlan,
    userText: input.userText,
    locale: input.locale ?? input.memory.locale,
    deps: { ...input.deps, enabled: true },
  })

  if (!result.enabled || !result.ok) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      mapsMobility: result,
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
  if (nextPlan && result.route) {
    const note = locale === 'en'
      ? `Maps mobility: ${result.route.summaryEn}`
      : `تنقل الخرائط: ${result.route.summaryAr}`
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
    mapsMobility: result,
  }
}

export function toMapsMobilityMeta(
  result: MapsMobilityResult | null | undefined,
): {
  intent: string
  live: boolean
  originId: string | null
  destinationId: string | null
  routeMode: string | null
  nearbyCount: number
  summary: string
  latencyMs: number
} | undefined {
  if (!result?.enabled) return undefined
  return {
    intent: result.intent,
    live: result.live,
    originId: result.origin?.id ?? null,
    destinationId: result.destination?.id ?? null,
    routeMode: result.route?.mode ?? null,
    nearbyCount: result.nearby.length,
    summary: result.consultantSummaryEn || result.consultantSummaryAr,
    latencyMs: result.latencyMs,
  }
}
