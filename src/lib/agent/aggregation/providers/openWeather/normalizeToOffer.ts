/**
 * Map canonical OpenWeather snapshots into agent NormalizedOffer payloads.
 * Tool merge expects summary / averageHighC plus optional enrichment fields.
 * Raw OpenWeather response objects must never leave this module.
 */

import type { CanonicalWeatherSnapshot } from '../../../../../integrations/providers/openWeather/types'
import type { NormalizedOffer } from '../../types'

export function weatherSnapshotToNormalizedOffer(
  snapshot: CanonicalWeatherSnapshot,
  providerId: string,
): NormalizedOffer {
  return {
    domain: 'weather',
    fingerprint: [
      'weather',
      snapshot.destination.toLowerCase(),
      snapshot.season ?? 'na',
      snapshot.averageHighC,
    ].join(':'),
    title: snapshot.summary,
    price: null,
    currency: null,
    providerId,
    confidence: 0.9,
    rankScore: 0,
    scoreHints: { relevance: 0.95 },
    payload: {
      summary: snapshot.summary,
      averageHighC: snapshot.averageHighC,
      averageLowC: snapshot.averageLowC,
      season: snapshot.season,
      destination: snapshot.destination,
      current: snapshot.current,
      hourly: snapshot.hourly,
      daily: snapshot.daily,
      alerts: snapshot.alerts,
      packingHints: snapshot.packingHints,
      travelTips: snapshot.travelTips,
      source: 'openweather',
    },
  }
}
