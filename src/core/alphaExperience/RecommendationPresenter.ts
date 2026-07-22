/**
 * Sprint 91 — presentation-ready recommendation assembly.
 */

import type { DecisionEngineResult } from '../types'
import type { PackageBuilderResult, PackageCandidate } from '../packageBuilder'
import type { RefinementResult } from '../itineraryRefinement'
import { aggregateConfidence } from './ConfidenceAggregator'
import { buildAlphaExplanation } from './ExplanationBuilder'
import { buildAlternativeScenarios } from './AlternativeScenarios'
import type {
  AlphaActivityPresentation,
  AlphaFlightPresentation,
  AlphaHotelPresentation,
  AlphaOrchestrationRequirements,
  AlphaRecommendation,
  AlphaTransportPresentation,
} from './types'

function flightFromPackage(pkg: PackageCandidate | null): AlphaFlightPresentation[] {
  if (!pkg) return []
  return pkg.components
    .filter((c) => c.kind === 'flight')
    .map((c) => ({
      id: c.id,
      airline: String(c.payload.airline ?? c.title ?? null) || null,
      origin: String(c.payload.origin ?? '') || null,
      destination: String(c.payload.destination ?? pkg.destination ?? '') || null,
      price: c.price,
      currency: c.currency,
      durationMinutes: typeof c.payload.durationMinutes === 'number'
        ? c.payload.durationMinutes
        : null,
      stops: typeof c.payload.stops === 'number' ? c.payload.stops : null,
      cabin: String(c.payload.cabin ?? '') || null,
    }))
}

function hotelFromPackage(pkg: PackageCandidate | null): AlphaHotelPresentation[] {
  if (!pkg) return []
  return pkg.components
    .filter((c) => c.kind === 'hotel')
    .map((c) => ({
      id: c.id,
      name: String(c.payload.name ?? c.title ?? null) || null,
      destination: String(c.payload.destination ?? pkg.destination ?? '') || null,
      price: c.price,
      currency: c.currency,
      stars: typeof c.payload.stars === 'number' ? c.payload.stars : null,
      rating: typeof c.payload.rating === 'number' ? c.payload.rating : null,
    }))
}

function transfersFromPackage(pkg: PackageCandidate | null): AlphaTransportPresentation[] {
  if (!pkg) return []
  return pkg.components
    .filter((c) => c.kind === 'transfer')
    .map((c) => ({
      id: c.id,
      title: c.title,
      price: c.price,
      currency: c.currency,
    }))
}

function activitiesFromPackage(pkg: PackageCandidate | null): AlphaActivityPresentation[] {
  if (!pkg) return []
  return pkg.components
    .filter((c) => c.kind === 'activity')
    .map((c) => ({
      id: c.id,
      title: c.title,
      price: c.price,
      currency: c.currency,
    }))
}

export function presentRecommendation(input: {
  requirements: AlphaOrchestrationRequirements
  packages: PackageBuilderResult | null
  refinement: RefinementResult | null
  decision: DecisionEngineResult | null
  recoveryMessages?: string[]
  warnings?: string[]
  constitutionOk?: boolean
  avgFlightConfidence?: number | null
  avgHotelConfidence?: number | null
}): AlphaRecommendation {
  const pkg = input.refinement?.refined
    ?? input.packages?.selected
    ?? input.packages?.ranked[0]
    ?? null

  const flights = flightFromPackage(pkg)
  const hotels = hotelFromPackage(pkg)
  const currency = pkg?.currency
    ?? input.requirements.budgetCurrency
    ?? 'SAR'

  const confidence = aggregateConfidence({
    flightConfidence: input.avgFlightConfidence
      ?? (typeof pkg?.providerConfidence === 'number' ? pkg.providerConfidence : 0.75),
    hotelConfidence: input.avgHotelConfidence
      ?? (typeof pkg?.providerConfidence === 'number' ? pkg.providerConfidence : 0.75),
    packageConfidence: pkg?.confidence ?? null,
    decisionConfidence: input.decision?.recommendations.confidence ?? null,
    refinementConfidence: input.refinement?.confidence ?? null,
    constitutionOk: input.constitutionOk,
  })

  const primaryFlight = flights[0]
  const primaryHotel = hotels[0]

  const explanation = buildAlphaExplanation({
    flightAirline: primaryFlight?.airline,
    flightPrice: primaryFlight?.price,
    hotelName: primaryHotel?.name,
    hotelPrice: primaryHotel?.price,
    packageTitle: pkg?.title,
    packageScore: pkg?.score,
    currency,
    budgetCap: input.requirements.budgetAmount ?? null,
    totalPrice: pkg?.totalPrice ?? null,
    durationMinutes: primaryFlight?.durationMinutes,
    decisionExplanation: input.decision?.recommendations.explanation ?? null,
    refinementSummary: input.refinement?.explanation.summary ?? null,
    tradeoffs: pkg?.reasons?.slice(0, 3),
  })

  const alternatives = buildAlternativeScenarios({
    packages: input.packages,
    decision: input.decision,
    primaryPackageId: pkg?.id ?? null,
  })

  const recommendations: string[] = []
  if (pkg?.explanation) recommendations.push(pkg.explanation.split('\n')[0]!.trim())
  if (input.decision?.recommendations.explanation) {
    recommendations.push(
      input.decision.recommendations.explanation.split('\n')[0]!.trim(),
    )
  }
  recommendations.push('Review alternatives if you want a different balance of cost and comfort.')
  if (input.recoveryMessages?.length) {
    recommendations.push('We adjusted the search after a recovery step — confirm the dates still work.')
  }

  const warnings = [...(input.warnings ?? [])]
  if (input.refinement?.conflicts.length) {
    warnings.push('Some schedule conflicts were detected and alternatives were prepared.')
  }
  if (input.constitutionOk === false) {
    warnings.push('Please review the recommendation carefully before booking.')
  }

  return {
    tripSummary: {
      destination: input.requirements.destination
        ?? input.requirements.destinations?.[0]
        ?? pkg?.destination
        ?? null,
      origin: input.requirements.origin ?? null,
      startDate: input.requirements.startDate ?? pkg?.checkIn ?? null,
      endDate: input.requirements.endDate ?? pkg?.checkOut ?? null,
      durationDays: input.requirements.durationDays ?? null,
      travelers: input.requirements.travelers ?? null,
      travelerType: input.requirements.travelerType ?? null,
      currency,
    },
    flights,
    hotels,
    transportation: transfersFromPackage(pkg),
    activities: activitiesFromPackage(pkg),
    estimatedCost: pkg?.totalPrice ?? null,
    currency,
    confidence,
    explanation,
    warnings,
    recommendations: Array.from(new Set(recommendations.filter(Boolean))),
    alternatives,
    recoveryMessages: input.recoveryMessages ?? [],
    packageTitle: pkg?.title ?? null,
    decisionExplanation: input.decision?.recommendations.explanation ?? null,
  }
}
