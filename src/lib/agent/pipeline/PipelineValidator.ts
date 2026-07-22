/**
 * Sprint 115 — PipelineValidator
 */

import type { PipelineInput } from './PipelineStages'

export interface PipelineValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function validatePipelineInput(input: PipelineInput): PipelineValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (input == null || typeof input !== 'object') {
    return { ok: false, errors: ['input must be an object'], warnings: [] }
  }

  if (input.messages != null) {
    if (!Array.isArray(input.messages)) {
      errors.push('messages must be an array')
    } else {
      for (let i = 0; i < input.messages.length; i++) {
        const m = input.messages[i]
        if (!m || typeof m.text !== 'string') {
          errors.push(`messages[${i}].text must be a string`)
        }
      }
    }
  }

  if (input.flights != null && !Array.isArray(input.flights)) {
    errors.push('flights must be an array')
  }
  if (input.hotels != null && !Array.isArray(input.hotels)) {
    errors.push('hotels must be an array')
  }

  if (input.trip?.budget != null && typeof input.trip.budget === 'number') {
    if (input.trip.budget < 0) errors.push('trip.budget must be >= 0')
  }

  if (input.stageTimeoutMs != null && input.stageTimeoutMs <= 0) {
    errors.push('stageTimeoutMs must be > 0')
  }
  if (input.maxRetries != null && input.maxRetries < 0) {
    errors.push('maxRetries must be >= 0')
  }

  const hasTrip =
    Boolean(input.trip?.destination?.trim())
    || Boolean(input.trip?.departureDate?.trim())
  const hasMessages =
    Array.isArray(input.messages) && input.messages.some((m) => m.text?.trim())
  if (!hasTrip && !hasMessages) {
    warnings.push('no trip hints or messages — pipeline may early-exit')
  }

  return { ok: errors.length === 0, errors, warnings }
}

export class PipelineValidator {
  validate(input: PipelineInput): PipelineValidation {
    return validatePipelineInput(input)
  }
}

export function createPipelineValidator(): PipelineValidator {
  return new PipelineValidator()
}
