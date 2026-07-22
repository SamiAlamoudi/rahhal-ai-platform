/**
 * Sprint 112 — PreferenceScorer
 * Score recommendation candidates using preference match, budget, style, history, destination.
 */

import type {
  ConversationMemoryState,
  MemoryCandidate,
  PreferenceResolution,
  PreferenceScoreBreakdown,
  TravelHistorySummary,
} from './types'

function includesCI(hay: string | null | undefined, needle: string): boolean {
  if (!hay) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
}

export function scoreCandidate(input: {
  candidate: MemoryCandidate
  resolution: PreferenceResolution
  history?: TravelHistorySummary | null
  conversationMemory?: ConversationMemoryState | null
}): PreferenceScoreBreakdown {
  const { candidate, resolution } = input
  const reasons: string[] = []
  let preferenceMatch = 0
  let budgetMatch = 0
  let travelStyle = 0
  let historySimilarity = 0
  let destinationAffinity = 0

  const eff = resolution.effective

  // Preference match
  if (eff.airlines.length && candidate.airline) {
    if (eff.airlines.some((a) => includesCI(candidate.airline, a))) {
      preferenceMatch += 0.35
      reasons.push(`Matches preferred airline (${candidate.airline})`)
    }
  }
  if (eff.hotelChains.length) {
    const hotelBlob = `${candidate.hotelChain ?? ''} ${candidate.hotelName ?? ''}`
    if (eff.hotelChains.some((h) => includesCI(hotelBlob, h))) {
      preferenceMatch += 0.3
      reasons.push('Matches preferred hotel chain')
    }
  }
  if (eff.cabin && candidate.cabin) {
    const cabin = candidate.cabin.toLowerCase().replace(/[\s-]/g, '_')
    if (cabin.includes(eff.cabin) || eff.cabin.includes(cabin)) {
      preferenceMatch += 0.2
      reasons.push(`Matches preferred cabin (${eff.cabin})`)
    }
  }
  if (eff.hotelStarsMin != null && candidate.hotelStars != null) {
    if (candidate.hotelStars >= eff.hotelStarsMin) {
      preferenceMatch += 0.15
      reasons.push(`Meets hotel stars (≥${eff.hotelStarsMin})`)
    } else {
      preferenceMatch -= 0.1
      reasons.push(`Below preferred hotel stars (${candidate.hotelStars})`)
    }
  }
  if (eff.preferDirect && candidate.stops != null) {
    if (candidate.stops === 0) {
      preferenceMatch += 0.15
      reasons.push('Matches direct-flight preference')
    } else {
      preferenceMatch -= 0.12
      reasons.push('Has layovers contrary to direct preference')
    }
  }
  if (
    eff.maxLayoverMinutes != null
    && candidate.layoverMinutes != null
    && candidate.layoverMinutes > eff.maxLayoverMinutes
  ) {
    preferenceMatch -= 0.1
    reasons.push('Layover exceeds preferred maximum')
  }
  preferenceMatch = Math.max(0, Math.min(1, preferenceMatch))

  // Budget match
  if (eff.budgetTypical != null && candidate.price != null) {
    const util = candidate.price / eff.budgetTypical
    if (util <= 1) {
      budgetMatch = Math.max(0.4, 1 - util * 0.5)
      reasons.push('Within remembered budget range')
    } else if (util <= 1.25) {
      budgetMatch = 0.35
      reasons.push('Slightly over remembered budget')
    } else {
      budgetMatch = 0.1
      reasons.push('Above remembered budget')
    }
  } else {
    budgetMatch = 0.5
  }

  // Travel style
  const styles = new Set(eff.travelStyles)
  if (styles.has('luxury') && (candidate.hotelStars ?? 0) >= 4) {
    travelStyle += 0.4
    reasons.push('Aligns with luxury travel style')
  }
  if (styles.has('business') && /business|first/i.test(candidate.cabin ?? '')) {
    travelStyle += 0.4
    reasons.push('Aligns with business travel style')
  }
  if (styles.has('family') && (candidate.hotelStars ?? 0) >= 3) {
    travelStyle += 0.25
    reasons.push('Reasonable for family travel style')
  }
  if (styles.has('beach') && /beach|coast|island/i.test(`${candidate.title ?? ''} ${candidate.destination ?? ''}`)) {
    travelStyle += 0.3
  }
  if (styles.size === 0) travelStyle = 0.5
  travelStyle = Math.max(0, Math.min(1, travelStyle))

  // History similarity
  const hist = input.history
  if (hist?.favoriteAirline && includesCI(candidate.airline, hist.favoriteAirline)) {
    historySimilarity += 0.45
    reasons.push('Similar to favorite airline in history')
  }
  if (
    hist?.favoriteHotelChain
    && includesCI(
      `${candidate.hotelChain ?? ''} ${candidate.hotelName ?? ''}`,
      hist.favoriteHotelChain,
    )
  ) {
    historySimilarity += 0.35
    reasons.push('Similar to favorite hotel in history')
  }
  if (
    hist?.averageTripCost != null
    && candidate.price != null
    && Math.abs(candidate.price - hist.averageTripCost) / hist.averageTripCost <= 0.25
  ) {
    historySimilarity += 0.2
    reasons.push('Price near historical average')
  }
  if (!hist || hist.tripCount === 0) historySimilarity = 0.4
  historySimilarity = Math.max(0, Math.min(1, historySimilarity))

  // Destination affinity
  if (eff.destinations.length && candidate.destination) {
    if (eff.destinations.some((d) => includesCI(candidate.destination, d))) {
      destinationAffinity = 0.9
      reasons.push('Matches preferred destination')
    } else {
      destinationAffinity = 0.25
    }
  } else if (
    hist?.favoriteCity
    && candidate.destination
    && includesCI(candidate.destination, hist.favoriteCity)
  ) {
    destinationAffinity = 0.8
    reasons.push('Matches favorite city from history')
  } else {
    destinationAffinity = 0.45
  }

  // Rejected itinerary penalty
  const rejected = input.conversationMemory?.rejectedItineraries ?? []
  if (rejected.some((r) => r.optionId === candidate.id)) {
    preferenceMatch = Math.max(0, preferenceMatch - 0.3)
    reasons.push('Previously rejected itinerary')
  }

  const total =
    Math.round(
      (preferenceMatch * 0.35
        + budgetMatch * 0.2
        + travelStyle * 0.15
        + historySimilarity * 0.15
        + destinationAffinity * 0.15)
        * 1000,
    ) / 1000

  return {
    candidateId: candidate.id,
    total,
    preferenceMatch,
    budgetMatch,
    travelStyle,
    historySimilarity,
    destinationAffinity,
    reasons,
  }
}

export function scoreCandidates(input: {
  candidates: MemoryCandidate[]
  resolution: PreferenceResolution
  history?: TravelHistorySummary | null
  conversationMemory?: ConversationMemoryState | null
}): PreferenceScoreBreakdown[] {
  return input.candidates
    .map((candidate) =>
      scoreCandidate({
        candidate,
        resolution: input.resolution,
        history: input.history,
        conversationMemory: input.conversationMemory,
      }),
    )
    .sort((a, b) => b.total - a.total || a.candidateId.localeCompare(b.candidateId))
}

export class PreferenceScorer {
  score(input: Parameters<typeof scoreCandidate>[0]): PreferenceScoreBreakdown {
    return scoreCandidate(input)
  }

  scoreAll(input: Parameters<typeof scoreCandidates>[0]): PreferenceScoreBreakdown[] {
    return scoreCandidates(input)
  }
}

export function createPreferenceScorer(): PreferenceScorer {
  return new PreferenceScorer()
}
