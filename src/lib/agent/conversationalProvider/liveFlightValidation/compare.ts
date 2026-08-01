/**
 * Sprint 80 P2 — side-by-side pilot vs legacy difference reporter.
 */

import type { OfferDiff } from './types'

function asOffers(data: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(data.offers)
    ? data.offers.filter((row): row is Record<string, unknown> =>
      row != null && typeof row === 'object' && !Array.isArray(row))
    : []
}

function push(
  diffs: OfferDiff[],
  path: string,
  pilot: unknown,
  legacy: unknown,
  severity: OfferDiff['severity'],
  note: string,
): void {
  diffs.push({ path, pilot, legacy, severity, note })
}

/**
 * Report every observable difference between pilot and legacy tool payloads.
 * Does not invent parity — records schema, inventory, and field-level deltas.
 */
export function comparePilotToLegacy(
  pilotData: Record<string, unknown>,
  legacyData: Record<string, unknown>,
): OfferDiff[] {
  const diffs: OfferDiff[] = []
  const pilotOffers = asOffers(pilotData)
  const legacyOffers = asOffers(legacyData)

  if (pilotData.searchEngine !== legacyData.searchEngine) {
    push(
      diffs,
      'searchEngine',
      pilotData.searchEngine ?? null,
      legacyData.searchEngine ?? null,
      'info',
      'Expected when pilot used live Amadeus vs legacy mock engine',
    )
  }

  if (Boolean(pilotData.usedLive) !== Boolean(legacyData.usedLive)) {
    push(
      diffs,
      'usedLive',
      pilotData.usedLive ?? null,
      legacyData.usedLive ?? null,
      'info',
      'Pilot live marker vs legacy path',
    )
  }

  if (pilotOffers.length !== legacyOffers.length) {
    push(
      diffs,
      'offers.length',
      pilotOffers.length,
      legacyOffers.length,
      'warn',
      'Inventory count differs between pilot and legacy',
    )
  }

  const keys = [
    'id',
    'airline',
    'flightNumber',
    'from',
    'to',
    'cabin',
    'stops',
    'durationMinutes',
    'price',
    'currency',
    'refundable',
    'baggage',
    'fareFamily',
    'provider',
    'departureTime',
    'arrivalTime',
  ] as const

  const n = Math.min(pilotOffers.length, legacyOffers.length, 5)
  for (let i = 0; i < n; i += 1) {
    const p = pilotOffers[i]!
    const l = legacyOffers[i]!
    for (const key of keys) {
      const pv = p[key]
      const lv = l[key]
      if (pv === lv) continue
      // Price/id/airline naturally differ across inventories.
      const natural = key === 'id' || key === 'price' || key === 'airline'
        || key === 'flightNumber' || key === 'departureTime' || key === 'arrivalTime'
        || key === 'durationMinutes' || key === 'stops' || key === 'provider'
      const bothMissingBaggage =
        key === 'baggage' && (pv == null || pv === '') && (lv == null || lv === '')
      const bothMissingFare =
        key === 'fareFamily' && (pv == null || pv === '') && (lv == null || lv === '')
      if (bothMissingBaggage || bothMissingFare) {
        push(
          diffs,
          `offers[${i}].${key}`,
          pv ?? null,
          lv ?? null,
          'warn',
          `${key} absent/null on both paths — enrichment gap`,
        )
        continue
      }
      push(
        diffs,
        `offers[${i}].${key}`,
        pv ?? null,
        lv ?? null,
        natural ? 'info' : 'warn',
        natural
          ? 'Inventory-specific value (expected to differ across providers)'
          : `Field mismatch for ${key}`,
      )
    }
  }

  // Schema-only keys present on one side.
  for (const key of Object.keys(pilotData)) {
    if (key === 'offers' || key === 'diagnostics' || key === 'highlights') continue
    if (!(key in legacyData)) {
      push(diffs, key, pilotData[key], undefined, 'info', 'Present only on pilot payload')
    }
  }
  for (const key of Object.keys(legacyData)) {
    if (key === 'offers' || key === 'diagnostics' || key === 'highlights') continue
    if (!(key in pilotData)) {
      push(diffs, key, undefined, legacyData[key], 'info', 'Present only on legacy payload')
    }
  }

  // Explicit baggage / fare-family coverage summary.
  const pilotBaggage = pilotOffers.filter((o) => o.baggage != null && o.baggage !== '').length
  const legacyBaggage = legacyOffers.filter((o) => o.baggage != null && o.baggage !== '').length
  if (pilotBaggage !== legacyBaggage) {
    push(
      diffs,
      'coverage.baggage',
      pilotBaggage,
      legacyBaggage,
      'warn',
      'Count of offers with baggage data differs',
    )
  }
  const pilotFare = pilotOffers.filter((o) => o.fareFamily != null && o.fareFamily !== '').length
  const legacyFare = legacyOffers.filter((o) => o.fareFamily != null && o.fareFamily !== '').length
  if (pilotFare !== legacyFare) {
    push(
      diffs,
      'coverage.fareFamily',
      pilotFare,
      legacyFare,
      'warn',
      'Count of offers with fare family data differs',
    )
  }

  return diffs
}
