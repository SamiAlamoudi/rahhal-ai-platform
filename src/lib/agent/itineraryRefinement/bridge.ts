/**
 * Sprint 84 — agent bridge for Autonomous Itinerary Refinement.
 * Sits between Package Builder and Decision Engine. No DE contract changes.
 */

import {
  runAdaptiveLearning,
  runItineraryRefinement,
  type FeedbackInput,
  type PackageBuilderResult,
  type PackageCandidate,
  type RefinementResult,
} from '../../../core'
import type { AgentMemory, TripPlan } from '../types'
import { isItineraryRefinementEnabled } from './feature'

export function packageFromBuilderResult(
  result: PackageBuilderResult | null | undefined,
): PackageCandidate | null {
  return result?.selected ?? result?.ranked[0] ?? null
}

/**
 * Rebuild prioritized offer pools from a refined package for Decision Engine.
 */
export function offersFromRefinedPackage(
  refined: PackageCandidate,
  flightOffers: Array<Record<string, unknown>>,
  hotelStays: Array<Record<string, unknown>>,
): {
  flightOffers: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
} {
  const flightId = refined.components.find((c) => c.kind === 'flight')?.id
  const hotelId = refined.components.find((c) => c.kind === 'hotel')?.id

  const sortPref = (list: Array<Record<string, unknown>>, preferredId?: string) => {
    if (!preferredId) return list
    return [...list].sort((a, b) => {
      const ai = String(a.id ?? '') === preferredId ? 0 : 1
      const bi = String(b.id ?? '') === preferredId ? 0 : 1
      return ai - bi
    })
  }

  // Overlay refined payload hints onto matching offers (incremental, no full rebuild).
  const flights = flightOffers.map((o) => {
    if (String(o.id ?? '') !== flightId) return o
    const comp = refined.components.find((c) => c.id === flightId)
    if (!comp) return o
    return {
      ...o,
      price: comp.price,
      ...comp.payload,
      refined: true,
    }
  })
  const hotels = hotelStays.map((o) => {
    if (String(o.id ?? '') !== hotelId) return o
    const comp = refined.components.find((c) => c.id === hotelId)
    if (!comp) return o
    return {
      ...o,
      total: comp.price,
      price: comp.price,
      ...comp.payload,
      refined: true,
    }
  })

  return {
    flightOffers: sortPref(flights, flightId),
    hotelStays: sortPref(hotels, hotelId),
  }
}

export function enrichWithItineraryRefinement(input: {
  memory: AgentMemory
  tripPlan: TripPlan
  userText?: string | null
  enabled?: boolean
  dynamicPackages?: PackageBuilderResult | null
  flightOffers?: Array<Record<string, unknown>>
  hotelStays?: Array<Record<string, unknown>>
  /** Feed outcomes into Adaptive Learning. */
  learnUserId?: string | null
}): {
  tripPlan: TripPlan
  itineraryRefinement: RefinementResult | null
  flightOffers: Array<Record<string, unknown>>
  hotelStays: Array<Record<string, unknown>>
  /** Refined package for Decision Engine consumption (via offer prioritization). */
  refinedPackage: PackageCandidate | null
} {
  const flightOffers = input.flightOffers ?? []
  const hotelStays = input.hotelStays ?? []

  if (!isItineraryRefinementEnabled({ enabled: input.enabled })) {
    return {
      tripPlan: input.tripPlan,
      itineraryRefinement: null,
      flightOffers,
      hotelStays,
      refinedPackage: null,
    }
  }

  const basePkg = packageFromBuilderResult(input.dynamicPackages)
  if (!basePkg) {
    return {
      tripPlan: input.tripPlan,
      itineraryRefinement: null,
      flightOffers,
      hotelStays,
      refinedPackage: null,
    }
  }

  // Skip no-op when there is nothing to refine in the user text and no explicit signal.
  const text = input.userText?.trim() ?? ''
  if (!text) {
    return {
      tripPlan: input.tripPlan,
      itineraryRefinement: null,
      flightOffers,
      hotelStays,
      refinedPackage: basePkg,
    }
  }

  const result = runItineraryRefinement({
    package: basePkg,
    userText: text,
    budgetCap: input.memory.requirements.budgetAmount,
    hasChildren: input.memory.requirements.travelerType === 'family'
      || input.memory.requirements.tripPurpose === 'family',
  })

  // Adaptive Learning — conversation text + structured refinement outcomes.
  if (input.learnUserId) {
    const feedback: FeedbackInput[] = []
    for (const s of result.learningSignals) {
      if (s.kind === 'luxury_vs_value' && s.value === 'value') {
        feedback.push({ type: s.source, expensiveRejected: true })
      } else if (s.kind === 'luxury_vs_value' && s.value === 'luxury' && s.polarity === 'prefer') {
        feedback.push({ type: s.source, liked: true, hotelBrand: 'luxury' })
      } else if (s.kind === 'food' && s.value === 'halal') {
        feedback.push({ type: s.source, liked: true })
      }
    }
    runAdaptiveLearning({
      userId: input.learnUserId,
      userText: text,
      feedback: feedback.length ? feedback : undefined,
    })
  }

  const prioritized = offersFromRefinedPackage(
    result.refined,
    flightOffers,
    hotelStays,
  )

  const notes = [
    ...input.tripPlan.notes,
    `Itinerary refinement: ${result.changesApplied.join(', ') || 'incremental'} · conf ${Math.round(result.confidence * 100)}% · ${result.impactedComponents.length} touched / ${result.reusedComponents.length} reused`,
    result.explanation.summary,
  ]

  return {
    tripPlan: { ...input.tripPlan, notes },
    itineraryRefinement: result,
    flightOffers: prioritized.flightOffers,
    hotelStays: prioritized.hotelStays,
    refinedPackage: result.refined,
  }
}

export type { RefinementResult }
