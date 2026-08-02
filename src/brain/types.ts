/**
 * Shared foundation types for the AI Travel Brain.
 * No UI, no providers, no external AI SDK.
 */

export type LocaleCode = 'ar' | 'en'

export type CurrencyCode = 'SAR' | 'USD' | 'EUR' | 'AED' | 'GBP'

export type Confidence = number // 0..1

export type IsoDate = string // YYYY-MM-DD

export type BrainId = string

export type Scored<T> = {
  item: T
  score: number
  reasons: string[]
}

export type BrainResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: BrainError }

export type BrainErrorCode =
  | 'missing_information'
  | 'ambiguous_request'
  | 'impossible_itinerary'
  | 'contradictory_request'
  | 'unsafe'
  | 'unknown'

export type BrainError = {
  code: BrainErrorCode
  message: string
  missingFields?: string[]
  details?: Record<string, string>
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export function nowIso(clock: () => number = Date.now): string {
  return new Date(clock()).toISOString()
}
