/**
 * Travel Booking Orchestrator facade — builds architecture blueprints only.
 * Never executes bookings, contacts providers, payments, or notifications.
 */

import {
  isBrainBookingOrchestratorEnabled,
  listTravelBookingRegistry,
} from './registry'
import {
  buildBookingAudit,
  buildBookingCandidateSample,
  buildBookingConfidenceContract,
  buildBookingConfirmationDraftSample,
  buildBookingFailureSample,
  buildBookingLifecycle,
  buildBookingOrchestrator,
  buildBookingPipeline,
  buildBookingProviderAbstraction,
  buildBookingRequestSample,
  buildBookingRevisionContract,
  buildBookingRevisionSample,
  buildBookingSchema,
  buildBookingSessionSample,
  buildBookingSnapshotContract,
  buildBookingStepSample,
  buildBookingStrategy,
  buildBookingValidationContract,
} from './pipelines'
import type {
  TravelBookingOrchestratorBlueprint,
  TravelBookingOrchestratorLocale,
} from './types'
import {
  TRAVEL_BOOKING_INPUT_HINTS,
  TRAVEL_BOOKING_ORCHESTRATOR_ISOLATION,
} from './types'

export interface BuildTravelBookingOrchestratorBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: TravelBookingOrchestratorLocale
}

export function buildTravelBookingOrchestratorBlueprint(
  options: BuildTravelBookingOrchestratorBlueprintOptions = {},
): TravelBookingOrchestratorBlueprint {
  void options.sessionId
  void options.locale

  const validation = buildBookingValidationContract()
  const snapshot = buildBookingSnapshotContract()
  const confidence = buildBookingConfidenceContract()

  return {
    version: '7.11.0-booking-orchestrator',
    featureId: 'brain.booking_orchestrator',
    architectureOnly: true,
    orchestrator: buildBookingOrchestrator(),
    pipeline: buildBookingPipeline(),
    schema: buildBookingSchema(),
    lifecycle: buildBookingLifecycle(),
    strategy: buildBookingStrategy(),
    validation,
    providerAbstraction: buildBookingProviderAbstraction(),
    audit: buildBookingAudit(),
    snapshot,
    revision: buildBookingRevisionContract(),
    confidence,
    bookingRequest: buildBookingRequestSample(),
    bookingCandidate: buildBookingCandidateSample(),
    bookingSession: buildBookingSessionSample(),
    bookingStep: buildBookingStepSample(),
    bookingValidation: validation.validation,
    bookingConfirmationDraft: buildBookingConfirmationDraftSample(),
    bookingFailure: buildBookingFailureSample(),
    bookingRevision: buildBookingRevisionSample(),
    bookingSnapshot: snapshot.snapshot,
    bookingConfidence: confidence.confidence,
    registry: listTravelBookingRegistry(),
    inputHints: TRAVEL_BOOKING_INPUT_HINTS,
  }
}

export function tryBuildTravelBookingOrchestratorBlueprint(
  options: BuildTravelBookingOrchestratorBlueprintOptions = {},
): TravelBookingOrchestratorBlueprint | null {
  if (!isBrainBookingOrchestratorEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildTravelBookingOrchestratorBlueprint(options)
}

export function assertTravelBookingOrchestratorIsolation(): typeof TRAVEL_BOOKING_ORCHESTRATOR_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...TRAVEL_BOOKING_ORCHESTRATOR_ISOLATION,
    architectureOnly: true,
    registrySize: listTravelBookingRegistry().length,
  }
}

export const TravelBookingOrchestrator = {
  buildBlueprint: buildTravelBookingOrchestratorBlueprint,
  tryBuildBlueprint: tryBuildTravelBookingOrchestratorBlueprint,
  assertIsolation: assertTravelBookingOrchestratorIsolation,
}
