/**
 * Phase AJ — deterministic failure / fallback policy (documented behavior matrix).
 * Never silently substitute live → mock without recording fallback.
 */

export type FailureScenario =
  | 'missing_credentials'
  | 'invalid_configuration'
  | 'provider_timeout'
  | 'provider_rate_limit'
  | 'provider_authentication_failure'
  | 'provider_unavailable'
  | 'malformed_response'
  | 'partial_response'
  | 'circuit_open'
  | 'fallback_success'
  | 'fallback_unavailable'
  | 'strict_live_mode'

export interface FailurePolicyRow {
  scenario: FailureScenario
  /** Selection / readiness outcome code. */
  outcome: string
  /** Whether mock fallback may be used when mockFallbackEnabled. */
  allowMockFallback: boolean
  /** Marker recorded in diagnostics / selection logs. */
  sourceMarker: 'live' | 'mock' | 'none'
  notes: string
}

/** Canonical, deterministic behavior for enablement readiness and selection. */
export const PROVIDER_FAILURE_POLICY: FailurePolicyRow[] = [
  {
    scenario: 'missing_credentials',
    outcome: 'fallback_mock | strict_live_rejected',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'Live provider cannot be enabled; flags OFF do not crash.',
  },
  {
    scenario: 'invalid_configuration',
    outcome: 'fallback_mock | strict_live_rejected',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'Includes sandbox URL in production mode and forbidden VITE_* secrets.',
  },
  {
    scenario: 'provider_timeout',
    outcome: 'provider_error → fallback when engine mockFallbackEnabled',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'Handled by Phase W wrapAdapter + AggregationEngine retries/timeouts.',
  },
  {
    scenario: 'provider_rate_limit',
    outcome: 'rate_limited → fallback when allowed',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'Rate-limit metric recorded; never leaks credentials.',
  },
  {
    scenario: 'provider_authentication_failure',
    outcome: 'auth_error → fallback when allowed',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'Treat as non-retryable for credential errors when adapter says so.',
  },
  {
    scenario: 'provider_unavailable',
    outcome: 'fallback_mock | strict_live_rejected',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'Transport/activities have no live adapter yet.',
  },
  {
    scenario: 'malformed_response',
    outcome: 'normalize_error → fallback when allowed',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'Adapters must not throw raw upstream payloads past the boundary.',
  },
  {
    scenario: 'partial_response',
    outcome: 'partial_ok_with_marker',
    allowMockFallback: false,
    sourceMarker: 'live',
    notes: 'Return available canonical items; record partial in diagnostics.',
  },
  {
    scenario: 'circuit_open',
    outcome: 'readiness unhealthy; engine skips live when wrapAdapter open',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'circuit_open reason surfaces in readiness + metrics.',
  },
  {
    scenario: 'fallback_success',
    outcome: 'fallback_mock',
    allowMockFallback: true,
    sourceMarker: 'mock',
    notes: 'fallbackUsed=true must be recorded; never silent.',
  },
  {
    scenario: 'fallback_unavailable',
    outcome: 'strict_live_rejected | empty_error',
    allowMockFallback: false,
    sourceMarker: 'none',
    notes: 'When mockFallbackEnabled=false or no mock adapter registered.',
  },
  {
    scenario: 'strict_live_mode',
    outcome: 'strict_live_rejected',
    allowMockFallback: false,
    sourceMarker: 'live',
    notes: 'VITE_PROVIDER_STRICT_LIVE=true forbids mock substitution.',
  },
]

export function failurePolicyFor(scenario: FailureScenario): FailurePolicyRow {
  const row = PROVIDER_FAILURE_POLICY.find((r) => r.scenario === scenario)
  if (!row) throw new Error(`Unknown failure scenario: ${scenario}`)
  return row
}
