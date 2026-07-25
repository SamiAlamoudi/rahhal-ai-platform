/**
 * Integration Sprint 11 — soft enrich conversation from Action Execution Layer.
 * When flag OFF, returns inputs unchanged. No accidental live bookings.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationActionExecutionEnabled } from './feature'
import { runActionExecution, type ActionExecutionDeps } from './engine'
import { isActionAsk } from './intents'
import type { ActionExecutionResult } from './types'

export function shouldRunActionExecution(input: {
  userText?: string | null
  memory: AgentMemory
  force?: boolean
}): boolean {
  if (input.force) return true
  const text = input.userText?.trim() ?? ''
  if (!text) return false
  if (isActionAsk(text)) return true
  return false
}

export async function enrichWithIntegrationActionExecution(input: {
  memory: AgentMemory
  userText?: string | null
  reply?: string | null
  tripPlan?: TripPlan | null
  locale?: AgentLocale
  enabled?: boolean
  force?: boolean
  deps?: ActionExecutionDeps
}): Promise<{
  memory: AgentMemory
  tripPlan: TripPlan | null
  reply: string | null
  actionExecution: ActionExecutionResult | null
}> {
  const tripPlan = input.tripPlan ?? input.memory.tripPlan
  if (!isIntegrationActionExecutionEnabled({ enabled: input.enabled })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      actionExecution: null,
    }
  }

  if (!shouldRunActionExecution({
    userText: input.userText,
    memory: input.memory,
    force: input.force,
  })) {
    return {
      memory: input.memory,
      tripPlan,
      reply: input.reply ?? null,
      actionExecution: null,
    }
  }

  const result = await runActionExecution({
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
      actionExecution: result,
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
  if (nextPlan && result.ok && result.action) {
    const note = locale === 'en'
      ? `Action: ${result.action} · ${result.mode}${result.execution?.reference ? ` · ${result.execution.reference}` : ''}`
      : `إجراء: ${result.action} · ${result.mode}${result.execution?.reference ? ` · ${result.execution.reference}` : ''}`
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
    actionExecution: result,
  }
}

export function toActionExecutionMeta(
  result: ActionExecutionResult | null | undefined,
): {
  intent: string
  action: string | null
  mode: string
  confirmed: boolean | null
  pending: boolean
  reference: string | null
  liveBlocked: boolean
  summary: string
  latencyMs: number
} | undefined {
  if (!result?.enabled) return undefined
  return {
    intent: result.intent,
    action: result.action,
    mode: result.mode,
    confirmed: result.confirmation?.confirmed ?? null,
    pending: Boolean(result.memory.pending),
    reference: result.execution?.reference ?? null,
    liveBlocked: Boolean(result.execution?.liveBlocked),
    summary: result.consultantSummaryEn || result.consultantSummaryAr,
    latencyMs: result.latencyMs,
  }
}
