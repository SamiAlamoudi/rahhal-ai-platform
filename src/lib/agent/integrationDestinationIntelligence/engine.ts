/**
 * Integration Sprint 5 — Destination Intelligence engine.
 * Recommends / compares destinations without requiring a booking request.
 */

import type { AgentLocale, TripRequirements } from '../types'
import { emptyRequirements } from '../types'
import { isIntegrationDestinationIntelligenceEnabled } from './feature'
import { themesFromRequirements } from './knowledge'
import { recommendDestinations } from './matching'
import { compareDestinations, detectComparisonQuery, isOpenEndedDestinationAsk } from './compare'
import { buildDestinationConsultantSummary } from './consultant'
import {
  INTEGRATION_DESTINATION_INTELLIGENCE_VERSION,
  type DestinationIntelligenceResult,
} from './types'

export interface DestinationIntelligenceDeps {
  enabled?: boolean
  limit?: number
}

export interface RunDestinationIntelligenceInput {
  requirements?: TripRequirements | null
  userText?: string | null
  locale?: AgentLocale
  deps?: DestinationIntelligenceDeps
}

function disabledResult(latencyMs: number): DestinationIntelligenceResult {
  return {
    version: INTEGRATION_DESTINATION_INTELLIGENCE_VERSION,
    enabled: false,
    ok: false,
    mode: 'advise',
    queryThemes: [],
    primary: null,
    alternatives: [],
    comparison: null,
    consultantSummaryAr: '',
    consultantSummaryEn: '',
    latencyMs,
    logs: ['destination_intelligence_disabled'],
  }
}

export async function runDestinationIntelligence(
  input: RunDestinationIntelligenceInput,
): Promise<DestinationIntelligenceResult> {
  const started = Date.now()
  const enabled = isIntegrationDestinationIntelligenceEnabled({
    enabled: input.deps?.enabled,
  })
  if (!enabled) return disabledResult(Date.now() - started)

  const requirements = input.requirements ?? emptyRequirements()
  const userText = input.userText?.trim() ?? ''
  const locale = input.locale ?? 'ar'
  const logs: string[] = ['destination_intelligence_enabled']
  const themes = themesFromRequirements({
    interests: requirements.interests,
    tripPurpose: requirements.tripPurpose,
    travelerType: requirements.travelerType,
    budgetStyle: requirements.budgetStyle,
    weatherPreference: requirements.weatherPreference,
    userText,
  })

  const comparisonQuery = userText ? detectComparisonQuery(userText) : null
  if (comparisonQuery) {
    logs.push(`compare:${comparisonQuery.left}_vs_${comparisonQuery.right}`)
    const comparison = await compareDestinations(
      comparisonQuery.left,
      comparisonQuery.right,
      requirements,
    )
    if (!comparison) {
      const summary = buildDestinationConsultantSummary({
        mode: 'advise',
        primary: null,
        alternatives: [],
        comparison: null,
        queryThemes: themes,
      }, locale)
      return {
        version: INTEGRATION_DESTINATION_INTELLIGENCE_VERSION,
        enabled: true,
        ok: false,
        mode: 'compare',
        queryThemes: themes,
        primary: null,
        alternatives: [],
        comparison: null,
        consultantSummaryAr: summary.ar,
        consultantSummaryEn: summary.en,
        latencyMs: Date.now() - started,
        logs: [...logs, 'compare_unresolved'],
      }
    }
    const summary = buildDestinationConsultantSummary({
      mode: 'compare',
      primary: comparison.left.score >= comparison.right.score ? comparison.left : comparison.right,
      alternatives: [],
      comparison,
      queryThemes: themes,
    }, locale)
    return {
      version: INTEGRATION_DESTINATION_INTELLIGENCE_VERSION,
      enabled: true,
      ok: true,
      mode: 'compare',
      queryThemes: themes,
      primary: comparison.left.score >= comparison.right.score ? comparison.left : comparison.right,
      alternatives: [],
      comparison,
      consultantSummaryAr: summary.ar,
      consultantSummaryEn: summary.en,
      latencyMs: Date.now() - started,
      logs,
    }
  }

  const limit = input.deps?.limit ?? 3
  const ranked = await recommendDestinations(requirements, limit)
  const primary = ranked[0] ?? null
  const alternatives = ranked.slice(1)
  const openEnded = userText ? isOpenEndedDestinationAsk(userText) : false
  const mode = openEnded || requirements.destinationFlexible ? 'recommend' : 'advise'
  logs.push(mode, primary ? `primary:${primary.knowledge.id}` : 'no_primary')

  const summary = buildDestinationConsultantSummary({
    mode,
    primary,
    alternatives,
    comparison: null,
    queryThemes: themes,
  }, locale)

  return {
    version: INTEGRATION_DESTINATION_INTELLIGENCE_VERSION,
    enabled: true,
    ok: Boolean(primary),
    mode,
    queryThemes: themes,
    primary,
    alternatives,
    comparison: null,
    consultantSummaryAr: summary.ar,
    consultantSummaryEn: summary.en,
    latencyMs: Date.now() - started,
    logs,
  }
}
