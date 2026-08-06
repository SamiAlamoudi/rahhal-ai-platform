/**
 * Map scored normalized offers → BilamoFlightOption (existing UI contract).
 */

import type { BilamoFlightOption } from '../intelligence/types'
import type { ScoredFlightOffer } from './types'

function clock(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(11, 16)
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function scoredOfferToBilamoFlight(row: ScoredFlightOffer): BilamoFlightOption {
  const o = row.offer
  const kindLabel = row.kind === 'best'
    ? 'Best overall'
    : row.kind === 'cheapest'
      ? 'Lowest price'
      : row.kind === 'fastest'
        ? 'Fastest'
        : null

  return {
    id: o.offerId,
    airline: o.airline,
    origin: o.origin,
    destination: o.destination,
    departTime: clock(o.departAt),
    arriveTime: clock(o.arriveAt),
    duration: formatDuration(o.durationMinutes),
    stopsLabel: o.stops === 0 ? 'Nonstop' : `${o.stops} stop${o.stops === 1 ? '' : 's'}`,
    price: o.totalPrice,
    currency: o.currency,
    reason: row.reason,
    score: row.score,
    kind: row.kind,
    kindLabel,
    flightNumber: o.flightNumber,
    cabin: o.cabin,
    baggageSummary: o.baggageSummary,
    refundable: o.refundable,
    fetchedAt: o.fetchedAt,
  }
}
