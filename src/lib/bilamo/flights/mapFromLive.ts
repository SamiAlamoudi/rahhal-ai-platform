/**
 * Map Sprint 105 RahhalFlightSearchOffer → NormalizedFlightOffer.
 * Keeps Amadeus/vendor fields out of Bilamo UI.
 */

import type { RahhalFlightSearchOffer } from '../../agent/liveFlightSearch/types'
import type { FlightCabinClass, NormalizedFlightOffer } from './types'

function cabinOf(raw: string | null | undefined): FlightCabinClass {
  const v = (raw || 'economy').toLowerCase()
  if (v.includes('first')) return 'first'
  if (v.includes('business')) return 'business'
  if (v.includes('premium')) return 'premium_economy'
  return 'economy'
}

function clockFallback(iso: string | null, hours: number, minutes: number): string {
  if (iso) return iso
  const d = new Date()
  d.setUTCHours(hours, minutes, 0, 0)
  return d.toISOString()
}

export function mapRahhalOfferToNormalized(
  offer: RahhalFlightSearchOffer,
  options?: { fetchedAt?: string },
): NormalizedFlightOffer {
  const durationMinutes = offer.durationMinutes ?? 600
  const stops = offer.stops ?? 0
  const departAt = clockFallback(offer.departureAt, 8, 40)
  const arriveAt = offer.arrivalAt
    || new Date(new Date(departAt).getTime() + durationMinutes * 60_000).toISOString()

  return {
    offerId: offer.id,
    airline: offer.airline || offer.carrierCode || 'Airline',
    flightNumber: offer.carrierCode
      ? `${offer.carrierCode}${offer.id.replace(/\D/g, '').slice(-3) || '100'}`
      : null,
    origin: offer.origin,
    destination: offer.destination,
    departAt,
    arriveAt,
    durationMinutes,
    stops,
    layovers: stops > 0
      ? [{ airport: 'HUB', durationMinutes: Math.max(45, Math.round(durationMinutes * 0.12)) }]
      : [],
    cabin: cabinOf(offer.cabin),
    baggageSummary: null,
    refundable: offer.refundable,
    changeable: null,
    totalPrice: offer.price ?? 0,
    currency: offer.currency || 'SAR',
    provider: offer.providerId === 'amadeus' ? 'amadeus' : 'unknown',
    bookingReference: null,
    deepLink: null,
    fetchedAt: options?.fetchedAt || new Date().toISOString(),
    meta: { demo: false, dataSource: 'live' },
  }
}

export function mapApiOffersToNormalized(
  rows: Array<Record<string, unknown>>,
): NormalizedFlightOffer[] {
  const fetchedAt = new Date().toISOString()
  return rows.map((row, index) => {
    const durationMinutes = Number(row.durationMinutes) || 600
    const stops = Number(row.stops) || 0
    const departAt = String(row.departAt || row.departureAt || `${fetchedAt.slice(0, 10)}T08:40:00Z`)
    const arriveAt = String(row.arriveAt || row.arrivalAt
      || new Date(new Date(departAt).getTime() + durationMinutes * 60_000).toISOString())
    return {
      offerId: String(row.offerId || row.id || `live-${index}`),
      airline: String(row.airline || 'Airline'),
      flightNumber: row.flightNumber == null ? null : String(row.flightNumber),
      origin: String(row.origin || ''),
      destination: String(row.destination || ''),
      departAt,
      arriveAt,
      durationMinutes,
      stops,
      layovers: Array.isArray(row.layovers)
        ? (row.layovers as Array<Record<string, unknown>>).map((l) => ({
            airport: String(l.airport || 'HUB'),
            durationMinutes: Number(l.durationMinutes) || 60,
          }))
        : (stops > 0 ? [{ airport: 'HUB', durationMinutes: 90 }] : []),
      cabin: cabinOf(String(row.cabin || 'economy')),
      baggageSummary: row.baggageSummary == null ? null : String(row.baggageSummary),
      refundable: typeof row.refundable === 'boolean' ? row.refundable : null,
      changeable: typeof row.changeable === 'boolean' ? row.changeable : null,
      totalPrice: Number(row.totalPrice ?? row.price) || 0,
      currency: String(row.currency || 'SAR'),
      provider: row.provider === 'amadeus' ? 'amadeus' : 'unknown',
      bookingReference: row.bookingReference == null ? null : String(row.bookingReference),
      deepLink: row.deepLink == null ? null : String(row.deepLink),
      fetchedAt: String(row.fetchedAt || fetchedAt),
      meta: {
        demo: false,
        dataSource: 'live' as const,
      },
    }
  })
}
