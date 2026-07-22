/**
 * Sprint 113 — OrchestratorValidator
 */

import type { OrchestratorInput } from './types'

export interface OrchestratorValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function validateOrchestratorInput(
  input: OrchestratorInput,
): OrchestratorValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (input == null || typeof input !== 'object') {
    return { ok: false, errors: ['input is required'], warnings: [] }
  }

  if (input.messages != null && !Array.isArray(input.messages)) {
    errors.push('messages must be an array when provided')
  }

  if (Array.isArray(input.messages)) {
    for (const [i, m] of input.messages.entries()) {
      if (!m || typeof m !== 'object' || typeof m.text !== 'string') {
        errors.push(`messages[${i}] must include text:string`)
      }
    }
  }

  if (input.flights != null && !Array.isArray(input.flights)) {
    errors.push('flights must be an array when provided')
  }
  if (input.hotels != null && !Array.isArray(input.hotels)) {
    errors.push('hotels must be an array when provided')
  }

  if (
    input.trip?.budget != null
    && (typeof input.trip.budget !== 'number' || !Number.isFinite(input.trip.budget))
  ) {
    errors.push('trip.budget must be a finite number when provided')
  }

  if (
    input.cachedFinalResponse
    && !input.cacheKey
  ) {
    warnings.push('cachedFinalResponse without cacheKey — reuse may be skipped')
  }

  return { ok: errors.length === 0, errors, warnings }
}

export class OrchestratorValidator {
  validate(input: OrchestratorInput): OrchestratorValidation {
    return validateOrchestratorInput(input)
  }
}

export function createOrchestratorValidator(): OrchestratorValidator {
  return new OrchestratorValidator()
}
