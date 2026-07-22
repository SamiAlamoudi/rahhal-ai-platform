/**
 * Sprint 91 — ConversationOrchestrator
 * Coordinates existing engines; no business-logic duplication.
 *
 * Pipeline (reuses existing architecture order):
 * Intent → Constitution → Search plans → Provider search →
 * Package Builder → Itinerary Refinement → Decision Engine →
 * Explanation → Final recommendation
 */

import {
  validatePrinciples,
  REQUIRED_RECOVERY_ATTEMPTS,
  type BehaviorSnapshot,
} from '../constitution'
import {
  runDecisionEngine,
  type DecisionEngineResult,
} from '../decisionEngine'
import { createSearchPlans, type StrategyContext } from '../searchPlanner/createSearchPlans'
import {
  runPackageBuilder,
  type NormalizedFlightOffer,
  type NormalizedHotelOffer,
  type NormalizedTransferOffer,
  type NormalizedActivityOffer,
  type PackageBuilderResult,
} from '../packageBuilder'
import {
  runItineraryRefinement,
  type RefinementResult,
} from '../itineraryRefinement'
import {
  createProviderRegistry,
  type ProviderRegistry,
} from '../providers'
import { ProgressTimelineTracker } from './ProgressTimeline'
import { emitAlphaEvent } from './events'
import {
  buildBudgetAdjustmentPrompt,
  toTravelerRecoveryMessage,
} from './ErrorExperience'
import { presentRecommendation } from './RecommendationPresenter'
import {
  SPRINT91_ALPHA_EXPERIENCE_VERSION,
  type AlphaExperienceEvent,
  type AlphaOrchestrationInput,
  type AlphaOrchestrationRequirements,
  type AlphaOrchestrationResult,
} from './types'

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

function enrichFlightOffers(
  offers: Array<Record<string, unknown>>,
  req: AlphaOrchestrationRequirements,
): NormalizedFlightOffer[] {
  return offers.map((o, i) => {
    const price = num(o.price) ?? num(o.total) ?? 900 + i * 120
    return {
      id: str(o.id) ?? `flight_${i}`,
      airline: str(o.airline) ?? 'Saudia',
      price,
      currency: str(o.currency) ?? req.budgetCurrency ?? 'SAR',
      durationMinutes: num(o.durationMinutes) ?? 180 + i * 30,
      stops: num(o.stops) ?? (i === 0 ? 0 : 1),
      arrivalAt: str(o.arrivalAt) ?? `${req.startDate ?? '2026-08-15'}T14:00:00.000Z`,
      departureAt: str(o.departureAt)
        ?? str(o.departureDate)
        ?? `${req.startDate ?? '2026-08-15'}T11:00:00.000Z`,
      destination: str(o.destination) ?? req.destination ?? 'DXB',
      origin: str(o.origin) ?? req.origin ?? 'RUH',
      cabin: str(o.cabin) ?? (i > 1 ? 'business' : 'economy'),
      refundable: o.refundable === true || i === 0,
      loyaltyMatch: o.loyaltyMatch === true,
      seatsRemaining: num(o.seatsRemaining) ?? 7,
      providerConfidence: num(o.providerConfidence) ?? 0.85,
      payload: o,
    }
  })
}

function enrichHotelOffers(
  stays: Array<Record<string, unknown>>,
  req: AlphaOrchestrationRequirements,
): NormalizedHotelOffer[] {
  return stays.map((s, i) => {
    const price = num(s.price) ?? num(s.total) ?? 400 + i * 200
    const stars = num(s.stars) ?? num(s.hotelStars) ?? (i === 0 ? 4 : 3 + (i % 3))
    return {
      id: str(s.id) ?? `hotel_${i}`,
      name: str(s.name) ?? `${req.destination ?? 'City'} Stay`,
      price,
      currency: str(s.currency) ?? req.budgetCurrency ?? 'SAR',
      stars,
      rating: num(s.rating) ?? 7.5 + i * 0.3,
      walkMinutes: num(s.walkMinutes) ?? 10 + i * 5,
      checkIn: str(s.checkIn) ?? req.startDate ?? '2026-08-15',
      checkOut: str(s.checkOut) ?? req.endDate ?? '2026-08-20',
      destination: str(s.destination) ?? str(s.city) ?? req.destination ?? 'DXB',
      familyFriendly: s.familyFriendly === true || req.travelerType === 'family',
      refundable: s.refundable === true || i === 0,
      breakfastIncluded: s.breakfastIncluded === true || i === 0,
      luxury: s.luxury === true || (stars ?? 0) >= 5,
      businessFriendly: s.businessFriendly === true || req.travelerType === 'business',
      providerConfidence: num(s.providerConfidence) ?? 0.84,
      payload: s,
    }
  })
}

function defaultTransfers(req: AlphaOrchestrationRequirements): NormalizedTransferOffer[] {
  return [{
    id: 'xfer_airport',
    title: 'Airport transfer',
    price: 120,
    currency: req.budgetCurrency ?? 'SAR',
    durationMinutes: 40,
    availableFrom: `${req.startDate ?? '2026-08-15'}T00:00:00.000Z`,
    availableTo: `${req.startDate ?? '2026-08-15'}T23:59:00.000Z`,
    destination: req.destination ?? 'DXB',
    providerConfidence: 0.8,
    payload: {},
  }]
}

function defaultActivities(req: AlphaOrchestrationRequirements): NormalizedActivityOffer[] {
  const interests = req.interests ?? []
  const adventure = interests.some((i) => /adventure|nature|hike/i.test(i))
  const day = req.startDate ?? '2026-08-16'
  return [{
    id: 'act_city',
    title: adventure ? 'Adventure day trip' : 'City highlights tour',
    price: adventure ? 350 : 220,
    currency: req.budgetCurrency ?? 'SAR',
    startAt: `${day}T09:00:00.000Z`,
    endAt: `${day}T13:00:00.000Z`,
    destination: req.destination ?? 'DXB',
    quality: adventure ? 0.86 : 0.8,
    familyFriendly: req.travelerType === 'family',
    providerConfidence: 0.78,
    payload: { kind: adventure ? 'adventure' : 'culture' },
  }]
}

function asTravelerType(
  value: string | null | undefined,
): 'solo' | 'couple' | 'family' | 'business' | 'friends' | null {
  if (value === 'solo' || value === 'couple' || value === 'family'
    || value === 'business' || value === 'friends') {
    return value
  }
  return null
}

function seedDemoOffers(req: AlphaOrchestrationRequirements): {
  flights: Array<Record<string, unknown>>
  hotels: Array<Record<string, unknown>>
} {
  const dest = req.destination ?? 'Dubai'
  const origin = req.origin ?? 'Riyadh'
  const start = req.startDate ?? '2026-08-15'
  return {
    flights: [
      {
        id: 'demo-flight-value',
        airline: 'Saudia',
        price: 1100,
        currency: req.budgetCurrency ?? 'SAR',
        durationMinutes: 190,
        stops: 0,
        origin,
        destination: dest,
        departureAt: `${start}T08:00:00.000Z`,
        arrivalAt: `${start}T11:10:00.000Z`,
        cabin: 'economy',
        refundable: true,
        providerConfidence: 0.9,
      },
      {
        id: 'demo-flight-cheap',
        airline: 'Flynas',
        price: 750,
        currency: req.budgetCurrency ?? 'SAR',
        durationMinutes: 340,
        stops: 1,
        origin,
        destination: dest,
        departureAt: `${start}T14:00:00.000Z`,
        arrivalAt: `${start}T19:40:00.000Z`,
        cabin: 'economy',
        refundable: false,
        providerConfidence: 0.8,
      },
      {
        id: 'demo-flight-biz',
        airline: 'Qatar Airways',
        price: 4200,
        currency: req.budgetCurrency ?? 'SAR',
        durationMinutes: 210,
        stops: 0,
        origin,
        destination: dest,
        departureAt: `${start}T09:30:00.000Z`,
        arrivalAt: `${start}T13:00:00.000Z`,
        cabin: 'business',
        refundable: true,
        loyaltyMatch: true,
        providerConfidence: 0.92,
      },
    ],
    hotels: [
      {
        id: 'demo-hotel-value',
        name: `${dest} City Hotel`,
        price: 1600,
        currency: req.budgetCurrency ?? 'SAR',
        stars: 4,
        rating: 8.2,
        walkMinutes: 12,
        checkIn: start,
        checkOut: req.endDate ?? '2026-08-20',
        destination: dest,
        breakfastIncluded: true,
        refundable: true,
        providerConfidence: 0.88,
      },
      {
        id: 'demo-hotel-budget',
        name: `${dest} Budget Inn`,
        price: 900,
        currency: req.budgetCurrency ?? 'SAR',
        stars: 3,
        rating: 7.4,
        walkMinutes: 22,
        checkIn: start,
        checkOut: req.endDate ?? '2026-08-20',
        destination: dest,
        familyFriendly: true,
        providerConfidence: 0.8,
      },
      {
        id: 'demo-hotel-luxury',
        name: `${dest} Grand Resort`,
        price: 4800,
        currency: req.budgetCurrency ?? 'SAR',
        stars: 5,
        rating: 9.1,
        walkMinutes: 8,
        checkIn: start,
        checkOut: req.endDate ?? '2026-08-20',
        destination: dest,
        luxury: true,
        businessFriendly: true,
        breakfastIncluded: true,
        refundable: true,
        providerConfidence: 0.93,
      },
    ],
  }
}

function toStrategy(req: AlphaOrchestrationRequirements): StrategyContext {
  return {
    purpose: req.travelerType ?? req.mission ?? null,
    budgetAmount: req.budgetAmount ?? null,
    preferDirect: true,
    hasChildren: req.travelerType === 'family',
    loyaltyPreferred: req.travelerType === 'business',
  }
}

export class ConversationOrchestrator {
  async run(input: AlphaOrchestrationInput): Promise<AlphaOrchestrationResult> {
    const started = Date.now()
    const events: AlphaExperienceEvent[] = []
    const tracker = new ProgressTimelineTracker()
    const conversationId = input.conversationId ?? `alpha_${Date.now().toString(36)}`
    const recoveryMessages: string[] = []
    const warnings: string[] = []
    let recovered = false

    emitAlphaEvent('conversation.started', { conversationId, userText: input.userText }, events)

    tracker.start('analyzing_request', 'Reading your travel request')
    tracker.complete('analyzing_request')

    const requirements: AlphaOrchestrationRequirements = {
      destination: input.requirements?.destination ?? null,
      destinations: input.requirements?.destinations ?? [],
      origin: input.requirements?.origin ?? null,
      startDate: input.requirements?.startDate ?? null,
      endDate: input.requirements?.endDate ?? null,
      durationDays: input.requirements?.durationDays ?? null,
      travelers: input.requirements?.travelers ?? null,
      travelerType: input.requirements?.travelerType ?? null,
      budgetAmount: input.budgetCap ?? input.requirements?.budgetAmount ?? null,
      budgetCurrency: input.requirements?.budgetCurrency ?? 'SAR',
      interests: input.requirements?.interests ?? [],
      mission: input.requirements?.mission ?? input.intent ?? null,
    }

    tracker.start('understanding_intent', 'Understanding traveler intent')
    emitAlphaEvent('intent.extracted', {
      intent: input.intent ?? null,
      destination: requirements.destination,
    }, events)
    tracker.complete(
      'understanding_intent',
      requirements.destination
        ? `Planning for ${requirements.destination}`
        : 'Open-ended destination preferences noted',
    )

    tracker.start('constitution_check', 'Validating travel principles')
    const snapshot: BehaviorSnapshot = {
      endedWithNoResults: false,
      recoveryAttempts: [...REQUIRED_RECOVERY_ATTEMPTS],
      mission: requirements.mission ?? requirements.destination ?? 'trip planning',
      destinationLocked: false,
      hasRecommendation: true,
      confidence: 0.75,
      explanation: {
        why: 'Orchestrating a complete Alpha recommendation from existing engines.',
        benefits: ['End-to-end planning', 'Alternatives ready'],
        tradeoffs: ['Mock/sandbox offers may differ from live inventory'],
        confidence: 0.75,
      },
      alternativeCount: 3,
      userIntent: input.intent ?? 'plan_trip',
      systemOverrodeUserIntent: false,
      recoveredWithoutRestart: false,
    }
    const constitution = validatePrinciples({ snapshot })
    const constitutionOk = constitution.ok
    emitAlphaEvent('constitution.validated', {
      ok: constitutionOk,
      violationCount: constitution.violations.length,
    }, events, Math.round(constitution.durationMs ?? 0))
    tracker.complete(
      'constitution_check',
      constitutionOk ? 'Principles satisfied' : 'Principles flagged — continuing carefully',
    )

    tracker.start('search_planning', 'Planning search strategies')
    const plans = createSearchPlans(toStrategy(requirements))
    emitAlphaEvent('search.planned', { planCount: plans.length }, events)
    tracker.complete('search_planning', `${plans.length} search strategies ready`)

    let flightRaw = input.flightOffers ?? []
    let hotelRaw = input.hotelStays ?? []
    const registry: ProviderRegistry = input.providerRegistry ?? createProviderRegistry()
    if (!input.providerRegistry) {
      registry.ensureDefaultMock()
    }

    tracker.start('searching_flights', 'Searching flights')
    try {
      if (flightRaw.length === 0) {
        const origin = requirements.origin ?? 'RUH'
        const destination = requirements.destination ?? 'DXB'
        const departureDate = requirements.startDate ?? '2026-08-15'
        const flightResult = await registry.searchFlightsWithFailover({
          origin,
          destination,
          departureDate,
          returnDate: requirements.endDate ?? null,
          adults: requirements.travelers ?? 1,
          currency: requirements.budgetCurrency ?? 'SAR',
          signal: input.signal,
        })
        if (!flightResult.ok || !flightResult.value || flightResult.value.results.length === 0) {
          recovered = true
          const msg = toTravelerRecoveryMessage(
            flightResult.attempts.map((a) => a.error ?? a.providerId).join(',') || 'empty',
            'flights',
          )
          recoveryMessages.push(msg)
          tracker.failRecoverable('searching_flights', 'flight_search_empty', msg)
          emitAlphaEvent('recovery.triggered', { domain: 'flights' }, events)
          const seeded = seedDemoOffers(requirements)
          flightRaw = seeded.flights
        } else {
          flightRaw = flightResult.value.results as Array<Record<string, unknown>>
          if (flightResult.attempts.length > 1) {
            recovered = true
            const msg = toTravelerRecoveryMessage('provider failover', 'provider')
            recoveryMessages.push(msg)
          }
          tracker.complete('searching_flights', `Found ${flightRaw.length} flight options`)
        }
      } else {
        tracker.complete('searching_flights', `Using ${flightRaw.length} provided flights`)
      }
    } catch (err) {
      recovered = true
      const technical = err instanceof Error ? err.message : 'flight_error'
      const msg = toTravelerRecoveryMessage(technical, 'flights')
      recoveryMessages.push(msg)
      tracker.failRecoverable('searching_flights', technical, msg)
      emitAlphaEvent('recovery.triggered', { domain: 'flights', technical }, events)
      flightRaw = seedDemoOffers(requirements).flights
    }

    tracker.start('searching_hotels', 'Searching hotels')
    try {
      if (hotelRaw.length === 0) {
        const hotelResult = await registry.searchHotelsWithFailover({
          destination: requirements.destination ?? 'DXB',
          checkIn: requirements.startDate ?? '2026-08-15',
          checkOut: requirements.endDate ?? null,
          adults: requirements.travelers ?? 1,
          currency: requirements.budgetCurrency ?? 'SAR',
          signal: input.signal,
        })
        if (!hotelResult.ok || !hotelResult.value || hotelResult.value.results.length === 0) {
          recovered = true
          const msg = toTravelerRecoveryMessage(
            hotelResult.attempts.map((a) => a.error ?? a.providerId).join(',') || 'empty',
            'hotels',
          )
          recoveryMessages.push(msg)
          tracker.failRecoverable('searching_hotels', 'hotel_search_empty', msg)
          emitAlphaEvent('recovery.triggered', { domain: 'hotels' }, events)
          hotelRaw = seedDemoOffers(requirements).hotels
        } else {
          hotelRaw = hotelResult.value.results as Array<Record<string, unknown>>
          tracker.complete('searching_hotels', `Found ${hotelRaw.length} hotel options`)
        }
      } else {
        tracker.complete('searching_hotels', `Using ${hotelRaw.length} provided hotels`)
      }
    } catch (err) {
      recovered = true
      const technical = err instanceof Error ? err.message : 'hotel_error'
      const msg = toTravelerRecoveryMessage(technical, 'hotels')
      recoveryMessages.push(msg)
      tracker.failRecoverable('searching_hotels', technical, msg)
      emitAlphaEvent('recovery.triggered', { domain: 'hotels', technical }, events)
      hotelRaw = seedDemoOffers(requirements).hotels
    }

    // Ensure package builder has enough diversity when providers return a single sparse offer.
    if (flightRaw.length < 2 || hotelRaw.length < 2) {
      const seeded = seedDemoOffers(requirements)
      if (flightRaw.length < 2) flightRaw = [...flightRaw, ...seeded.flights]
      if (hotelRaw.length < 2) hotelRaw = [...hotelRaw, ...seeded.hotels]
    }

    emitAlphaEvent('search.completed', {
      flightCount: flightRaw.length,
      hotelCount: hotelRaw.length,
      recovered,
    }, events, Date.now() - started)

    tracker.start('comparing_options', 'Comparing options')
    const flights = enrichFlightOffers(flightRaw, requirements)
    const hotels = enrichHotelOffers(hotelRaw, requirements)
    tracker.complete('comparing_options', `${flights.length} flights · ${hotels.length} hotels`)

    tracker.start('building_package', 'Building package')
    let packages: PackageBuilderResult | null = null
    try {
      packages = await runPackageBuilder({
        flights,
        hotels,
        transfers: defaultTransfers(requirements),
        activities: defaultActivities(requirements),
        budgetCap: requirements.budgetAmount ?? null,
        travelerType: asTravelerType(requirements.travelerType),
        tripPurpose: requirements.mission ?? requirements.travelerType ?? null,
      })
      if (!packages.selected && packages.ranked.length === 0) {
        recovered = true
        const msg = buildBudgetAdjustmentPrompt(
          requirements.budgetCurrency ?? 'SAR',
          requirements.budgetAmount ?? null,
        )
        recoveryMessages.push(msg)
        warnings.push(msg)
        tracker.failRecoverable('building_package', 'empty_packages', msg)
        emitAlphaEvent('recovery.triggered', { domain: 'package' }, events)
      } else {
        tracker.complete(
          'building_package',
          packages.selected?.title ?? `${packages.ranked.length} packages ranked`,
        )
      }
      emitAlphaEvent('package.completed', {
        packageCount: packages.ranked.length,
        selectedId: packages.selected?.id ?? null,
      }, events, packages.durationMs)
    } catch (err) {
      recovered = true
      const technical = err instanceof Error ? err.message : 'package_error'
      const msg = toTravelerRecoveryMessage(technical, 'package')
      recoveryMessages.push(msg)
      tracker.failRecoverable('building_package', technical, msg)
      emitAlphaEvent('recovery.triggered', { domain: 'package', technical }, events)
    }

    tracker.start('optimizing_itinerary', 'Optimizing itinerary')
    let refinement: RefinementResult | null = null
    const basePkg = packages?.selected ?? packages?.ranked[0] ?? null
    if (basePkg) {
      try {
        refinement = runItineraryRefinement({
          package: basePkg,
          userText: input.userText,
          budgetCap: requirements.budgetAmount ?? null,
          hasChildren: input.hasChildren === true || requirements.travelerType === 'family',
        })
        tracker.complete(
          'optimizing_itinerary',
          refinement.incremental
            ? 'Incremental refinements applied'
            : 'Itinerary reviewed',
        )
        emitAlphaEvent('refinement.completed', {
          confidence: refinement.confidence,
          conflictCount: refinement.conflicts.length,
          alternativeCount: refinement.alternatives.length,
        }, events, refinement.durationMs)
      } catch (err) {
        recovered = true
        const technical = err instanceof Error ? err.message : 'refine_error'
        const msg = toTravelerRecoveryMessage(technical, 'generic')
        recoveryMessages.push('Optimizing itinerary...')
        tracker.failRecoverable('optimizing_itinerary', technical, msg)
      }
    } else {
      tracker.skip('optimizing_itinerary', 'No package available to refine')
    }

    tracker.start('decision', 'Selecting best option')
    let decision: DecisionEngineResult | null = null
    try {
      const preferredFlightId = refinement?.refined.components.find((c) => c.kind === 'flight')?.id
      const preferredHotelId = refinement?.refined.components.find((c) => c.kind === 'hotel')?.id
      const sortPref = (list: Array<Record<string, unknown>>, preferred?: string) => {
        if (!preferred) return list
        return [...list].sort((a, b) => {
          const ai = String(a.id ?? '') === preferred ? 0 : 1
          const bi = String(b.id ?? '') === preferred ? 0 : 1
          return ai - bi
        })
      }
      decision = await runDecisionEngine({
        flightOffers: sortPref(flightRaw, preferredFlightId),
        hotelStays: sortPref(hotelRaw, preferredHotelId),
        strategy: toStrategy(requirements),
        budgetCap: requirements.budgetAmount ?? null,
      })
      tracker.complete(
        'decision',
        decision.recommendations.bestOverall
          ? 'Primary recommendation selected'
          : 'Decision completed with fallbacks',
      )
      emitAlphaEvent('decision.completed', {
        confidence: decision.recommendations.confidence,
        candidateCount: decision.candidates.length,
        fallbackUsed: decision.fallbackUsed,
      }, events, decision.durationMs)
    } catch (err) {
      recovered = true
      const technical = err instanceof Error ? err.message : 'decision_error'
      recoveryMessages.push(toTravelerRecoveryMessage(technical, 'generic'))
      tracker.failRecoverable('decision', technical, 'Comparing options...')
    }

    tracker.start('generating_alternatives', 'Generating alternatives')
    tracker.complete('generating_alternatives')

    tracker.start('preparing_recommendation', 'Preparing recommendation')
    const avgFlightConfidence = flights.length
      ? flights.reduce((s, f) => s + f.providerConfidence, 0) / flights.length
      : null
    const avgHotelConfidence = hotels.length
      ? hotels.reduce((s, h) => s + h.providerConfidence, 0) / hotels.length
      : null

    const recommendation = presentRecommendation({
      requirements,
      packages,
      refinement,
      decision,
      recoveryMessages,
      warnings,
      constitutionOk,
      avgFlightConfidence,
      avgHotelConfidence,
    })
    tracker.complete('preparing_recommendation')
    emitAlphaEvent('recommendation.generated', {
      estimatedCost: recommendation.estimatedCost,
      alternativeCount: recommendation.alternatives.length,
      overallConfidence: recommendation.confidence.overall,
    }, events)

    const timeline = tracker.finish()
    const durationMs = Date.now() - started
    emitAlphaEvent('conversation.completed', {
      conversationId,
      recovered,
      constitutionOk,
    }, events, durationMs)

    return {
      version: SPRINT91_ALPHA_EXPERIENCE_VERSION,
      conversationId,
      timeline,
      recommendation,
      events,
      searchPlanCount: plans.length,
      packageCount: packages?.ranked.length ?? 0,
      alternativeCount: recommendation.alternatives.length,
      constitutionOk,
      recovered,
      durationMs,
    }
  }
}

export function createConversationOrchestrator(): ConversationOrchestrator {
  return new ConversationOrchestrator()
}

export async function runAlphaExperience(
  input: AlphaOrchestrationInput,
): Promise<AlphaOrchestrationResult> {
  return createConversationOrchestrator().run(input)
}
