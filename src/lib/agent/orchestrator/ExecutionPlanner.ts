/**
 * Sprint 113 — ExecutionPlanner
 * Decides which pipeline stages run (additive coordination only).
 */

import type {
  ExecutionPlan,
  OrchestratorInput,
  OrchestratorStageId,
} from './types'

function hasText(messages: OrchestratorInput['messages']): boolean {
  return Boolean(messages?.some((m) => m.text?.trim()))
}

function missingCriticalTripFields(input: OrchestratorInput): string[] {
  const missing: string[] = []
  const trip = input.trip
  if (!trip?.destination?.trim()) missing.push('destination')
  if (!trip?.departureDate?.trim()) missing.push('departureDate')
  return missing
}

function estimateTokens(input: OrchestratorInput): number {
  const text = (input.messages ?? []).map((m) => m.text).join(' ')
  return Math.ceil(text.length / 4)
}

export function buildExecutionPlan(input: OrchestratorInput): ExecutionPlan {
  const overrides = input.stageOverrides ?? {}
  const reasons: string[] = []
  const missing = missingCriticalTripFields(input)
  const hasFlights = (input.flights?.length ?? 0) > 0
  const hasHotels = (input.hotels?.length ?? 0) > 0
  const hasCache = Boolean(input.cachedFinalResponse && input.cacheKey)
  const providerUnavailable = input.providerStatus === 'unavailable'
  const userId = input.userId?.trim() || null

  let askFollowUp =
    overrides.askFollowUp === true
    || (overrides.askFollowUp !== false && missing.length > 0 && !hasFlights)
  let followUpQuestion: string | null = null
  if (askFollowUp && missing.length > 0) {
    followUpQuestion =
      `I still need ${missing.join(' and ')} to plan your trip. Could you share ${missing[0]}?`
    reasons.push(`Missing critical fields: ${missing.join(', ')}`)
  }
  if (overrides.askFollowUp === false) {
    askFollowUp = false
    followUpQuestion = null
  }

  let reuseCache =
    overrides.reuseCache === true
    || (overrides.reuseCache !== false && hasCache && !hasText(input.messages))
  if (overrides.reuseCache === false) reuseCache = false
  if (reuseCache) reasons.push('Reusing cached final response')

  let earlyExit =
    overrides.earlyExit === true
    || askFollowUp
    || reuseCache
  if (overrides.earlyExit === false && !askFollowUp && !reuseCache) {
    earlyExit = false
  }
  if (askFollowUp) reasons.push('Early exit for follow-up question')

  let skipProviders =
    overrides.skipProviders === true
    || providerUnavailable
    || (hasFlights && hasHotels)
    || reuseCache
    || askFollowUp
  if (overrides.skipProviders === false && !providerUnavailable) {
    skipProviders = false
  }
  if (providerUnavailable) reasons.push('Providers unavailable — skip provider calls')
  if (hasFlights && hasHotels) reasons.push('Offers already present — skip providers')

  let executeSearch =
    overrides.executeSearch === true
    || (overrides.executeSearch !== false
      && !skipProviders
      && !askFollowUp
      && !reuseCache
      && missing.length === 0)
  if (overrides.executeSearch === false) executeSearch = false
  if (executeSearch) reasons.push('Execute search/provider stage')
  else if (!skipProviders) reasons.push('Search not required')

  let useMemory =
    overrides.useMemory === true
    || (overrides.useMemory !== false && Boolean(userId) && !reuseCache)
  if (overrides.useMemory === false) useMemory = false
  if (!userId && overrides.useMemory !== true) {
    useMemory = false
    reasons.push('Memory unavailable (no userId)')
  } else if (useMemory) {
    reasons.push('Memory stage enabled')
  }

  let runTripBuilder =
    overrides.runTripBuilder === true
    || (overrides.runTripBuilder !== false
      && !askFollowUp
      && !reuseCache
      && (hasFlights || executeSearch)
      && (hasHotels || executeSearch))
  if (overrides.runTripBuilder === false) runTripBuilder = false
  if (runTripBuilder) reasons.push('Trip Builder stage enabled')
  else reasons.push('Trip Builder skipped')

  let runDecision =
    overrides.runDecision === true
    || (overrides.runDecision !== false && runTripBuilder && !askFollowUp && !reuseCache)
  if (overrides.runDecision === false) runDecision = false

  let runResponseComposer =
    overrides.runResponseComposer === true
    || (overrides.runResponseComposer !== false && !askFollowUp && !reuseCache && (runTripBuilder || hasFlights))
  if (overrides.runResponseComposer === false) runResponseComposer = false

  let runConcierge =
    overrides.runConcierge === true
    || (overrides.runConcierge !== false && runResponseComposer && !askFollowUp && !reuseCache)
  if (overrides.runConcierge === false) runConcierge = false

  if (earlyExit && reuseCache) {
    executeSearch = false
    runTripBuilder = false
    runDecision = false
    runResponseComposer = false
    runConcierge = false
    useMemory = overrides.useMemory === true
  }

  const stageOrder: OrchestratorStageId[] = [
    'memory',
    'planner',
    'providers',
    'trip_builder',
    'decision',
    'response_composer',
    'concierge',
    'final',
  ]

  return {
    useMemory,
    executeSearch,
    reuseCache,
    skipProviders,
    runTripBuilder,
    runDecision,
    runResponseComposer,
    runConcierge,
    askFollowUp,
    earlyExit,
    followUpQuestion,
    reasons,
    stageOrder,
  }
}

/** Exported for metrics token estimation in pipeline. */
export { estimateTokens }

export function buildOrchestratorPlan(input: OrchestratorInput): ExecutionPlan {
  return buildExecutionPlan(input)
}

export class ExecutionPlanner {
  plan(input: OrchestratorInput): ExecutionPlan {
    return buildExecutionPlan(input)
  }
}

export function createExecutionPlanner(): ExecutionPlanner {
  return new ExecutionPlanner()
}
