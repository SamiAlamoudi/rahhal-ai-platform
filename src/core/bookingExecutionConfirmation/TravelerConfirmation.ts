/**
 * Sprint 102 — traveler confirmation validation (required fields).
 */

import type { BookingTravelerDraft } from './types'

export type TravelerFieldId =
  | 'firstName'
  | 'lastName'
  | 'dateOfBirth'
  | 'passportNumber'
  | 'nationality'

export interface TravelerFieldError {
  travelerId: string
  field: TravelerFieldId
  message: string
}

export interface TravelerConfirmationResult {
  ok: boolean
  errors: TravelerFieldError[]
  missingFields: TravelerFieldId[]
}

const REQUIRED: TravelerFieldId[] = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'passportNumber',
  'nationality',
]

function fieldValue(t: BookingTravelerDraft, field: TravelerFieldId): string | null {
  const raw = t[field]
  if (typeof raw !== 'string') return null
  const v = raw.trim()
  return v.length > 0 ? v : null
}

export function validateTravelerConfirmation(
  travelers: BookingTravelerDraft[],
): TravelerConfirmationResult {
  const errors: TravelerFieldError[] = []
  const missing = new Set<TravelerFieldId>()

  if (travelers.length === 0) {
    return {
      ok: false,
      errors: [{
        travelerId: '_',
        field: 'firstName',
        message: 'At least one traveler is required.',
      }],
      missingFields: [...REQUIRED],
    }
  }

  for (const traveler of travelers) {
    for (const field of REQUIRED) {
      if (!fieldValue(traveler, field)) {
        missing.add(field)
        errors.push({
          travelerId: traveler.id,
          field,
          message: `${field} is required.`,
        })
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    missingFields: [...missing],
  }
}

export function createEmptyTraveler(id?: string): BookingTravelerDraft {
  return {
    id: id ?? `traveler_${Math.random().toString(36).slice(2, 8)}`,
    firstName: '',
    lastName: '',
    dateOfBirth: null,
    passportNumber: null,
    passportExpiry: null,
    nationality: null,
    email: null,
    phone: null,
  }
}
