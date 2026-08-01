/**
 * Sprint 80 P2 — End-to-end live flight validation (dev/staging only).
 */

export {
  LIVE_FLIGHT_P2_VALIDATION_VERSION,
  type FieldIntegrityReport,
  type FieldIntegrityStatus,
  type LatencyBreakdown,
  type LiveFlightValidationMode,
  type LiveFlightValidationResult,
  type LiveFlightValidationScenario,
  type OfferDiff,
  type ValidationTelemetryRates,
} from './types'

export {
  evaluateLiveFlightValidationGate,
  isLiveFlightPilotAllowedForDeploy,
  isSandboxAmadeusHost,
  type LiveFlightValidationGateResult,
} from './gate'

export {
  DEFAULT_LIVE_FLIGHT_VALIDATION_SCENARIO,
  LIVE_FLIGHT_VALIDATION_SCENARIOS,
} from './scenarios'

export { inspectPilotFieldIntegrity } from './inspect'
export { comparePilotToLegacy } from './compare'
export {
  buildLatencyBreakdown,
  buildValidationTelemetryRates,
  rate,
} from './metrics'
export {
  runLiveFlightValidation,
  type RunLiveFlightValidationOptions,
} from './runner'
export {
  renderLiveFlightValidationJson,
  renderLiveFlightValidationMarkdown,
} from './report'
