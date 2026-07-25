/**
 * Travel Booking Orchestrator contracts — pure builders.
 * No booking execution, provider calls, payments, or notifications.
 */

import type {
  BookingAuditContract,
  BookingCandidate,
  BookingConfidence,
  BookingConfidenceContract,
  BookingConfirmationDraft,
  BookingFailure,
  BookingLifecycleContract,
  BookingOrchestratorContract,
  BookingPipelineContract,
  BookingProviderAbstractionContract,
  BookingRequest,
  BookingRevision,
  BookingRevisionContract,
  BookingSchemaContract,
  BookingSession,
  BookingSnapshot,
  BookingSnapshotContract,
  BookingStep,
  BookingStrategyContract,
  BookingValidation,
  BookingValidationContract,
} from './types'
import {
  TRAVEL_BOOKING_AUDIT_HINTS,
  TRAVEL_BOOKING_LIFECYCLE_ACTIONS,
  TRAVEL_BOOKING_PIPELINE_STAGES,
  TRAVEL_BOOKING_PROVIDER_KINDS,
  TRAVEL_BOOKING_RETRY_HINTS,
  TRAVEL_BOOKING_ROLLBACK_HINTS,
  TRAVEL_BOOKING_STATE_HINTS,
  TRAVEL_BOOKING_STRATEGY_HINTS,
} from './types'

const ISO = '2026-07-25T00:00:00.000Z'
const REQUEST_ID = 'breq-architecture'
const SESSION_ID = 'bsess-architecture'
const CANDIDATE_ID = 'bcand-architecture'

export function buildBookingOrchestrator(): BookingOrchestratorContract {
  return {
    kind: 'travel_booking_orchestrator',
    version: '7.11.0-booking-orchestrator',
    execution: 'none',
    books: false,
    providerCalled: false,
    paymentsExecuted: false,
    reservationsCreated: false,
    notificationsSent: false,
  }
}

export function buildBookingPipeline(): BookingPipelineContract {
  return {
    kind: 'travel_booking_pipeline',
    stages: TRAVEL_BOOKING_PIPELINE_STAGES,
    execution: 'none',
  }
}

export function buildBookingSchema(): BookingSchemaContract {
  return {
    kind: 'travel_booking_schema',
    outputKinds: [
      'travel_booking_request',
      'travel_booking_candidate',
      'travel_booking_session',
      'travel_booking_step',
      'travel_booking_validation',
      'travel_booking_confirmation_draft',
      'travel_booking_failure',
      'travel_booking_revision',
      'travel_booking_snapshot',
      'travel_booking_confidence',
    ],
    execution: 'none',
  }
}

export function buildBookingRequestSample(): BookingRequest {
  return {
    kind: 'travel_booking_request',
    requestId: REQUEST_ID,
    sourceOfferDecisionHint: 'offer_decision_placeholder',
    providerKinds: TRAVEL_BOOKING_PROVIDER_KINDS,
    execution: 'none',
    providerCalled: false,
  }
}

export function buildBookingCandidateSample(): BookingCandidate {
  return {
    kind: 'travel_booking_candidate',
    candidateId: CANDIDATE_ID,
    providerKindHint: 'generic_future',
    labelHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildBookingSessionSample(): BookingSession {
  return {
    kind: 'travel_booking_session',
    sessionId: SESSION_ID,
    requestId: REQUEST_ID,
    stateHint: 'idle',
    execution: 'none',
  }
}

export function buildBookingStepSample(): BookingStep {
  return {
    kind: 'travel_booking_step',
    stepId: 'bstep-architecture',
    sessionId: SESSION_ID,
    stepHint: 'prepare',
    statusHint: 'pending',
    execution: 'none',
  }
}

export function buildBookingValidationSample(): BookingValidation {
  return {
    kind: 'travel_booking_validation',
    requestId: REQUEST_ID,
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildBookingConfirmationDraftSample(): BookingConfirmationDraft {
  return {
    kind: 'travel_booking_confirmation_draft',
    draftId: 'bconf-architecture',
    sessionId: SESSION_ID,
    confirmationHint: 'architecture_placeholder',
    confirmed: false,
    execution: 'none',
  }
}

export function buildBookingFailureSample(): BookingFailure {
  return {
    kind: 'travel_booking_failure',
    failureId: 'bfail-architecture',
    sessionId: SESSION_ID,
    reasonHint: 'none_architecture',
    recoverableHint: true,
    execution: 'none',
  }
}

export function buildBookingRevisionSample(): BookingRevision {
  return {
    kind: 'travel_booking_revision',
    revisionId: 'brev-architecture',
    requestId: REQUEST_ID,
    reasonHint: 'architecture_blueprint',
    execution: 'none',
  }
}

export function buildBookingSnapshotSample(): BookingSnapshot {
  return {
    kind: 'travel_booking_snapshot',
    snapshotId: 'bsnap-architecture',
    atIso: ISO,
    sessionId: SESSION_ID,
    execution: 'none',
  }
}

export function buildBookingConfidenceSample(): BookingConfidence {
  return {
    kind: 'travel_booking_confidence',
    requestId: REQUEST_ID,
    scoreHint: 0,
    bandHint: 'medium',
    execution: 'none',
  }
}

export function buildBookingLifecycle(): BookingLifecycleContract {
  return {
    kind: 'travel_booking_lifecycle',
    actions: TRAVEL_BOOKING_LIFECYCLE_ACTIONS,
    stateHints: TRAVEL_BOOKING_STATE_HINTS,
    currentStateHint: null,
    execution: 'none',
  }
}

export function buildBookingStrategy(): BookingStrategyContract {
  return {
    kind: 'travel_booking_strategy',
    strategyHints: TRAVEL_BOOKING_STRATEGY_HINTS,
    rollbackHints: TRAVEL_BOOKING_ROLLBACK_HINTS,
    retryHints: TRAVEL_BOOKING_RETRY_HINTS,
    execution: 'none',
  }
}

export function buildBookingValidationContract(): BookingValidationContract {
  return {
    kind: 'travel_booking_validation_contract',
    validation: buildBookingValidationSample(),
    execution: 'none',
  }
}

export function buildBookingProviderAbstraction(): BookingProviderAbstractionContract {
  return {
    kind: 'travel_booking_provider_abstraction',
    providerKinds: TRAVEL_BOOKING_PROVIDER_KINDS,
    wired: false,
    execution: 'none',
  }
}

export function buildBookingAudit(): BookingAuditContract {
  return {
    kind: 'travel_booking_audit',
    auditHints: TRAVEL_BOOKING_AUDIT_HINTS,
    persisted: false,
    execution: 'none',
  }
}

export function buildBookingSnapshotContract(): BookingSnapshotContract {
  return {
    kind: 'travel_booking_snapshot_contract',
    snapshot: buildBookingSnapshotSample(),
    execution: 'none',
  }
}

export function buildBookingRevisionContract(): BookingRevisionContract {
  return {
    kind: 'travel_booking_revision_contract',
    revisions: [],
    persisted: false,
    execution: 'none',
  }
}

export function buildBookingConfidenceContract(): BookingConfidenceContract {
  return {
    kind: 'travel_booking_confidence_contract',
    confidence: buildBookingConfidenceSample(),
    execution: 'none',
  }
}
