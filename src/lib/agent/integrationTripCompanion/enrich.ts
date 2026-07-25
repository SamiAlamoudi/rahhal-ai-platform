/**
 * Integration Sprint 7 — soft enrich conversation from Live Trip Companion.
 * When flag OFF, returns inputs unchanged.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationTripCompanionEnabled } from './feature'
import { runTripCompanion, type TripCompanionDeps } from './engine'
import { isCompanionAssistantAsk } from './assistant'
import { detectCompanionDisruption } from './replan'
import { detectEmergencyKind } from './emergency'
import type { TripCompanionResult } from './types'

export function shouldRunTripCompanion(input: {
  userText?: string | null
  memory: AgentMemory
  force?: boolean
}): boolean {
  if (input.force) return true
  const text = input.userText?.trim() ?? ''
  if (!text) return false
  if (isCompanionAssistantAsk(text)) return true
  if (detectCompanionDisruption(text)) return true
  if (detectEmergencyKind(text)) return true
  if (input.memory.tripPlan && /trip|رحلة|companion|جدول|timeline/i.test(text)) return true
  return false
}

export async function enrichWithIntegrationTripCompanion(input: {
  memory: AgentMemory
  userText?: string | null
  reply?: string | null
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  enabled?: boolean
  force?: boolean
  deps?: TripCompanionDeps
}): Promise<{
  memory: AgentMemory
  tripPlan: TripPlan | null
  reply: string | null
  tripCompanion: TripCompanionResult | null
}> {
  const tripPlan = input.tripPlan ?? input.memory.tripPlan
  if (!isIntegrationTripCompanionEnabled({ enabled: input.enabled })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      tripCompanion: null,
    }
  }

  if (!shouldRunTripCompanion({
    userText: input.userText,
    memory: input.memory,
    force: input.force,
  })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      tripCompanion: null,
    }
  }

  const result = await runTripCompanion({
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
      tripCompanion: result,
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
  if (nextPlan && result.replanned) {
    const note = locale === 'en'
      ? `Trip companion replanned: ${result.disruptions[0]?.detailEn ?? 'timeline updated'}`
      : `رفيق الرحلة أعاد التخطيط: ${result.disruptions[0]?.detailAr ?? 'تم تحديث الجدول'}`
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
    tripCompanion: result,
  }
}

export function toTripCompanionMeta(
  result: TripCompanionResult | null | undefined,
): {
  sessionState: string | null
  assistantIntent: string
  primaryEventId: string | null
  notificationCount: number
  replanned: boolean
  emergencyKind: string | null
  summary: string
  latencyMs: number
} | undefined {
  if (!result?.enabled) return undefined
  return {
    sessionState: result.session?.state ?? null,
    assistantIntent: result.assistantIntent,
    primaryEventId: result.timeline?.current?.id ?? result.timeline?.next?.id ?? null,
    notificationCount: result.notifications.length,
    replanned: result.replanned,
    emergencyKind: result.emergency?.kind ?? null,
    summary: result.consultantSummaryEn || result.consultantSummaryAr,
    latencyMs: result.latencyMs,
  }
}
