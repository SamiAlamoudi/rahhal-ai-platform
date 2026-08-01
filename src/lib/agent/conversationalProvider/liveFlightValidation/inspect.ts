/**
 * Sprint 80 P2 — field integrity inspection for normalized pilot offers.
 */

import type { FieldIntegrityReport, FieldIntegrityStatus } from './types'

function asOffers(data: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(data.offers)
    ? data.offers.filter((row): row is Record<string, unknown> =>
      row != null && typeof row === 'object' && !Array.isArray(row))
    : []
}

function statusForPresence(value: unknown): FieldIntegrityStatus {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (typeof value === 'string' && value.trim() === '') return 'invalid'
  return 'present'
}

function aggregate(statuses: FieldIntegrityStatus[]): FieldIntegrityStatus {
  if (statuses.length === 0) return 'missing'
  if (statuses.every((s) => s === 'present')) return 'present'
  if (statuses.some((s) => s === 'invalid')) return 'invalid'
  if (statuses.some((s) => s === 'present')) return 'present'
  if (statuses.every((s) => s === 'null')) return 'null'
  return 'missing'
}

export type InspectPilotInput = {
  pilotData: Record<string, unknown>
  requestMapped: boolean
  authTokenAcquired: boolean
  authTokenRefreshed: boolean
  normalizationCompleted: boolean
}

/**
 * Verify pricing, carrier, baggage, fare families, cabin, mapping, auth signals.
 */
export function inspectPilotFieldIntegrity(input: InspectPilotInput): FieldIntegrityReport {
  const offers = asOffers(input.pilotData)

  const pricing = aggregate(offers.map((o) => {
    const price = o.price
    const currency = o.currency
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return 'invalid'
    if (typeof currency !== 'string' || !currency.trim()) return 'invalid'
    return 'present'
  }))

  const carrier = aggregate(offers.map((o) => {
    const airline = o.airline ?? o.carrierCode
    return statusForPresence(airline)
  }))

  const baggage = aggregate(offers.map((o) => statusForPresence(o.baggage)))
  const fareFamilies = aggregate(offers.map((o) => statusForPresence(o.fareFamily)))
  const cabin = aggregate(offers.map((o) => statusForPresence(o.cabin)))

  return {
    authentication: input.authTokenAcquired ? 'present' : 'missing',
    tokenRefresh: input.authTokenRefreshed ? 'present' : 'n/a',
    requestMapping: input.requestMapped ? 'present' : 'missing',
    responseNormalization: input.normalizationCompleted
      ? (offers.length > 0 ? 'present' : 'null')
      : 'missing',
    pricingIntegrity: pricing,
    carrierData: carrier,
    baggage,
    fareFamilies,
    cabinClasses: cabin,
  }
}
