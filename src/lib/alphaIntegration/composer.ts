/**
 * Sprint 103 — Alpha Integration composer (connect existing outputs only).
 */

import { bookingComposeFromAgentMeta, resolveAlphaNextStep } from './dataFlow'
import { degradationForMissing } from './degradation'
import { reportAlphaIntegrationFlags } from './flags'
import { resolveJourneyPath, listKnownJourneyPaths, ALPHA_JOURNEY_ROUTES } from './routes'
import { ALPHA_JOURNEY_STAGES, allStagesConnected } from './stages'
import {
  SPRINT103_ALPHA_INTEGRATION_VERSION,
  type AlphaIntegrationDegradation,
  type AlphaIntegrationFlagReport,
} from './types'
import type { AgentProviderMeta } from '../agent/types'
import type { BookingExecutionComposeInput } from '../../core'
import { isBookingExecutionConfirmationEnabled } from '../bookingExecutionConfirmation'
import { getFeatureRegistry } from '../ai'

export { SPRINT103_ALPHA_INTEGRATION_VERSION }

export interface AlphaIntegrationReport {
  version: string
  stagesConnected: boolean
  stageCount: number
  connectedStageIds: string[]
  routes: Array<{ path: string; resolvesTo: string }>
  knownPaths: string[]
  flags: AlphaIntegrationFlagReport[]
  nextStepPath: string | null
  degradations: AlphaIntegrationDegradation[]
  bookingCompose: BookingExecutionComposeInput | null
  productionReadinessScore: number
}

export function buildAlphaIntegrationReport(input?: {
  meta?: AgentProviderMeta | null
  hasFlight?: boolean
  hasHotel?: boolean
  hasPackage?: boolean
  hasRecommendation?: boolean
  bookingFailed?: boolean
  providerUnavailable?: boolean
  emptyTrip?: boolean
}): AlphaIntegrationReport {
  const bookingExecutionEnabled = isBookingExecutionConfirmationEnabled()
  const myTripsEnabled = getFeatureRegistry().isEnabled('ui.my_trips')
    || getFeatureRegistry().isEnabled('ai.my_trips_dashboard')

  const next = resolveAlphaNextStep({
    meta: input?.meta ?? null,
    bookingExecutionEnabled,
    myTripsEnabled,
  })

  const degradations = degradationForMissing({
    hasFlight: input?.hasFlight,
    hasHotel: input?.hasHotel,
    hasPackage: input?.hasPackage,
    hasRecommendation: input?.hasRecommendation,
    bookingFailed: input?.bookingFailed,
    providerUnavailable: input?.providerUnavailable,
    emptyTrip: input?.emptyTrip,
  })

  const flags = reportAlphaIntegrationFlags()
  const flagsOn = flags.filter((f) => f.enabled).length
  const stageOk = allStagesConnected()
  const score = Math.round(
    (stageOk ? 40 : 20)
    + (flagsOn / Math.max(flags.length, 1)) * 30
    + (degradations.some((d) => d.code === 'booking_failed') ? 0 : 15)
    + (next || input?.meta ? 15 : 10),
  )

  return {
    version: SPRINT103_ALPHA_INTEGRATION_VERSION,
    stagesConnected: stageOk,
    stageCount: ALPHA_JOURNEY_STAGES.length,
    connectedStageIds: ALPHA_JOURNEY_STAGES.filter((s) => s.connected).map((s) => s.id),
    routes: ALPHA_JOURNEY_ROUTES.map((r) => ({
      path: r.path,
      resolvesTo: resolveJourneyPath(r.path, { bookingExecutionEnabled }),
    })),
    knownPaths: listKnownJourneyPaths(),
    flags,
    nextStepPath: next?.path ?? null,
    degradations,
    bookingCompose: input?.meta ? bookingComposeFromAgentMeta(input.meta) : null,
    productionReadinessScore: Math.min(100, Math.max(0, score)),
  }
}

export function resolveBookingEntryPath(): string {
  return resolveJourneyPath('/booking', {
    bookingExecutionEnabled: isBookingExecutionConfirmationEnabled(),
  })
}
