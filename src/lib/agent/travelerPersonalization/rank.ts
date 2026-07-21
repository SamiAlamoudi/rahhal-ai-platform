/**
 * Sprint 76 — preference-weighted ranking for flights / hotels.
 */

import type { TravelerProfile, PersonalizedCandidate, RankingAdjustment } from './types'

export interface FlightPersonalizationRow {
  id: string
  title: string
  airline?: string | null
  cabin?: string | null
  stops?: number | null
  baseScore?: number
  payload?: Record<string, unknown>
}

export interface HotelPersonalizationRow {
  id: string
  title: string
  chain?: string | null
  stars?: number | null
  name?: string | null
  baseScore?: number
  payload?: Record<string, unknown>
}

const WEIGHT = {
  airline: 22,
  avoidAirline: -28,
  cabin: 16,
  direct: 14,
  hotelChain: 20,
  avoidHotel: -24,
  stars: 18,
  luxury: 10,
  business: 8,
}

function includesLoose(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack) return false
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

export function scoreFlightAgainstProfile(
  row: FlightPersonalizationRow,
  profile: TravelerProfile | null,
): { score: number; delta: number; reasons: string[]; adjustments: RankingAdjustment[] } {
  const base = row.baseScore ?? 50
  if (!profile) {
    return {
      score: base,
      delta: 0,
      reasons: [],
      adjustments: [],
    }
  }

  let delta = 0
  const reasons: string[] = []
  const adjustments: RankingAdjustment[] = []

  for (const airline of profile.preferredAirlines) {
    if (!includesLoose(row.airline, airline.value) && !includesLoose(row.title, airline.value)) continue
    const weight = airline.polarity === 'prefer'
      ? WEIGHT.airline * airline.confidence
      : WEIGHT.avoidAirline * airline.confidence
    delta += weight
    const reason = airline.polarity === 'prefer'
      ? `preferred airline ${airline.value}`
      : `avoided airline ${airline.value}`
    reasons.push(reason)
    adjustments.push({
      candidateId: row.id,
      kind: 'flight',
      delta: Math.round(weight),
      reasons: [reason],
    })
  }

  if (profile.preferredCabin?.polarity === 'prefer' && row.cabin) {
    const preferred = profile.preferredCabin.value
    if (row.cabin.toLowerCase().includes(preferred) || preferred.includes(row.cabin.toLowerCase())) {
      const weight = WEIGHT.cabin * profile.preferredCabin.confidence
      delta += weight
      reasons.push(`preferred cabin ${preferred}`)
      adjustments.push({
        candidateId: row.id,
        kind: 'flight',
        delta: Math.round(weight),
        reasons: [`preferred cabin ${preferred}`],
      })
    }
  }

  // Direct-flight preference is stored on preferredAlliances as value "direct".
  const directPref = profile.preferredAlliances.find((a) => a.value.toLowerCase() === 'direct')
  if (directPref && (row.stops ?? 1) === 0 && directPref.polarity === 'prefer') {
    const weight = WEIGHT.direct * directPref.confidence
    delta += weight
    reasons.push('preferred direct flight')
    adjustments.push({
      candidateId: row.id,
      kind: 'flight',
      delta: Math.round(weight),
      reasons: ['preferred direct flight'],
    })
  }

  if (profile.tripStyle?.value === 'business' && (row.stops ?? 1) === 0) {
    const weight = WEIGHT.business * profile.tripStyle.confidence
    delta += weight
    reasons.push('business traveler · direct boost')
  }
  if (profile.tripStyle?.value === 'luxury' && (row.cabin === 'business' || row.cabin === 'first')) {
    const weight = WEIGHT.luxury * profile.tripStyle.confidence
    delta += weight
    reasons.push('luxury style · premium cabin')
  }

  const score = Math.max(0, Math.min(100, Math.round(base + delta)))
  return { score, delta: Math.round(delta), reasons, adjustments }
}

export function scoreHotelAgainstProfile(
  row: HotelPersonalizationRow,
  profile: TravelerProfile | null,
): { score: number; delta: number; reasons: string[]; adjustments: RankingAdjustment[] } {
  const base = row.baseScore ?? 50
  if (!profile) {
    return { score: base, delta: 0, reasons: [], adjustments: [] }
  }

  let delta = 0
  const reasons: string[] = []
  const adjustments: RankingAdjustment[] = []
  const hay = `${row.chain ?? ''} ${row.name ?? ''} ${row.title}`

  for (const chain of profile.hotelChains) {
    if (!includesLoose(hay, chain.value)) continue
    const weight = chain.polarity === 'prefer'
      ? WEIGHT.hotelChain * chain.confidence
      : WEIGHT.avoidHotel * chain.confidence
    delta += weight
    const reason = chain.polarity === 'prefer'
      ? `preferred hotel ${chain.value}`
      : `avoided hotel ${chain.value}`
    reasons.push(reason)
    adjustments.push({
      candidateId: row.id,
      kind: 'hotel',
      delta: Math.round(weight),
      reasons: [reason],
    })
  }

  if (profile.hotelStarPreference && row.stars != null) {
    const min = profile.hotelStarPreference.value
    if (row.stars >= min) {
      const weight = WEIGHT.stars * profile.hotelStarPreference.confidence
      delta += weight
      reasons.push(`meets min ${min}★`)
      adjustments.push({
        candidateId: row.id,
        kind: 'hotel',
        delta: Math.round(weight),
        reasons: [`meets min ${min}★`],
      })
    } else {
      const weight = -WEIGHT.stars * profile.hotelStarPreference.confidence
      delta += weight
      reasons.push(`below min ${min}★`)
      adjustments.push({
        candidateId: row.id,
        kind: 'hotel',
        delta: Math.round(weight),
        reasons: [`below min ${min}★`],
      })
    }
  }

  if (profile.tripStyle?.value === 'luxury' && (row.stars ?? 0) >= 4) {
    const weight = WEIGHT.luxury * profile.tripStyle.confidence
    delta += weight
    reasons.push('luxury style · high stars')
  }

  const score = Math.max(0, Math.min(100, Math.round(base + delta)))
  return { score, delta: Math.round(delta), reasons, adjustments }
}

export function rankFlightsByPersonalization(
  rows: FlightPersonalizationRow[],
  profile: TravelerProfile | null,
): PersonalizedCandidate[] {
  return rows
    .map((row) => {
      const scored = scoreFlightAgainstProfile(row, profile)
      return {
        id: row.id,
        kind: 'flight' as const,
        title: row.title,
        baseScore: row.baseScore ?? 50,
        personalizedScore: scored.score,
        delta: scored.delta,
        reasons: scored.reasons,
        payload: row.payload ?? { airline: row.airline, cabin: row.cabin, stops: row.stops },
      }
    })
    .sort((a, b) => b.personalizedScore - a.personalizedScore || b.delta - a.delta)
}

export function rankHotelsByPersonalization(
  rows: HotelPersonalizationRow[],
  profile: TravelerProfile | null,
): PersonalizedCandidate[] {
  return rows
    .map((row) => {
      const scored = scoreHotelAgainstProfile(row, profile)
      return {
        id: row.id,
        kind: 'hotel' as const,
        title: row.title,
        baseScore: row.baseScore ?? 50,
        personalizedScore: scored.score,
        delta: scored.delta,
        reasons: scored.reasons,
        payload: row.payload ?? { chain: row.chain, stars: row.stars, name: row.name },
      }
    })
    .sort((a, b) => b.personalizedScore - a.personalizedScore || b.delta - a.delta)
}
