/**
 * Sprint 14 — safe observability metrics (never include secret values).
 */

import type { SecretMetricsSnapshot } from './types'

const counters = {
  validationFailureCount: 0,
  missingConfigurationCount: 0,
  providerAuthFailureCount: 0,
  unauthorizedAccessCount: 0,
  rotationAttemptCount: 0,
  rotationFailureCount: 0,
  sanitizationCount: 0,
}

export function incrementValidationFailure(n = 1): void {
  counters.validationFailureCount += n
}
export function incrementMissingConfiguration(n = 1): void {
  counters.missingConfigurationCount += n
}
export function incrementProviderAuthFailure(n = 1): void {
  counters.providerAuthFailureCount += n
}
export function incrementUnauthorizedAccess(n = 1): void {
  counters.unauthorizedAccessCount += n
}
export function incrementRotationAttempt(n = 1): void {
  counters.rotationAttemptCount += n
}
export function incrementRotationFailure(n = 1): void {
  counters.rotationFailureCount += n
}
export function incrementSanitizationCount(n = 1): void {
  counters.sanitizationCount += n
}

export function getSecretMetrics(): SecretMetricsSnapshot {
  return { ...counters }
}

export function resetSecretMetricsForTests(): void {
  for (const k of Object.keys(counters) as (keyof typeof counters)[]) {
    counters[k] = 0
  }
}
