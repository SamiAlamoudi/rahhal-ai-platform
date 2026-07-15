/**
 * Map canonical Google Maps route / location models into agent NormalizedOffer payloads.
 * Tool merge expects legs: { from, to, mode, distanceKm, durationMinutes }.
 * Raw Google response objects must never leave this module / adapter boundary.
 */

import type { CanonicalLocation, CanonicalRouteLeg } from '../../../../../integrations/providers/googleMaps/types'
import type { NormalizedOffer } from '../../types'

export function routeLegsToNormalizedOffers(
  legs: CanonicalRouteLeg[],
  providerId: string,
): NormalizedOffer[] {
  return legs.map((leg, index) => {
    const fingerprint = [
      'maps',
      leg.from,
      leg.to,
      leg.mode,
      Math.round(leg.distanceKm),
    ].join(':')

    return {
      domain: 'maps',
      fingerprint,
      title: `${leg.from} → ${leg.to}`,
      price: null,
      currency: null,
      providerId,
      confidence: 0.92,
      rankScore: 0,
      scoreHints: {
        relevance: clamp01(0.95 - index * 0.02),
        durationQuality: clamp01(1 - leg.durationMinutes / 180),
      },
      payload: {
        from: leg.from,
        to: leg.to,
        mode: leg.mode,
        distanceKm: leg.distanceKm,
        durationMinutes: leg.durationMinutes,
        fromLocation: locationToPayload(leg.fromLocation),
        toLocation: locationToPayload(leg.toLocation),
        source: 'google_maps',
      },
    }
  })
}

export function locationToNormalizedOffer(
  location: CanonicalLocation,
  providerId: string,
  kind: string,
): NormalizedOffer {
  const label = location.label || location.name
  return {
    domain: 'maps',
    fingerprint: `maps:lookup:${kind}:${location.placeId ?? label}`,
    title: location.name || label,
    price: null,
    currency: null,
    providerId,
    confidence: 0.88,
    rankScore: 0,
    scoreHints: { relevance: 0.9 },
    payload: {
      from: label,
      to: label,
      mode: 'lookup',
      distanceKm: 0,
      durationMinutes: 0,
      kind,
      location: locationToPayload(location),
      source: 'google_maps',
    },
  }
}

function locationToPayload(location: CanonicalLocation | null): Record<string, unknown> | null {
  if (!location) return null
  return {
    name: location.name,
    label: location.label,
    formattedAddress: location.formattedAddress,
    placeId: location.placeId,
    lat: location.lat,
    lng: location.lng,
    countryCode: location.countryCode,
    country: location.country,
    city: location.city,
    types: location.types,
    timezoneId: location.timezoneId,
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}
