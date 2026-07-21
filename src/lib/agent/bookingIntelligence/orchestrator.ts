/**
 * Booking Intelligence orchestrator — search → fuse → rank → optimize → readiness.
 * Returns structured facts only; Conversation Brain authors user language.
 */

import type { AgentMemory } from '../types'
import { assessBookingReadiness } from './bookingReadiness'
import { buildRecommendationConfidence } from './confidence'
import { optimizeBookingCombinations } from './costOptimizer'
import { explainRecommendations, explanationFacts } from './explanations'
import { fuseOffers } from './fusion'
import { normalizeIsoDate } from './normalize'
import { createLiveBookingProviders } from '../liveProviders'
import { createBookingProviderRegistry } from './providerRegistry'
import { rankOffersV2 } from './rankingV2'
import { createDefaultSimulatedBookingProviders } from './simulatedAdapters'
import { learnBookingPreferences, getBookingPreferences } from './travelerPreferences'
import type {
  BookingIntelligenceResult,
  BookingIntelligenceSnapshot,
  BookingOffer,
  BookingProviderDomain,
  BookingProviderRegistry,
  BookingSearchQuery,
} from './types'

const DEFAULT_DOMAINS: BookingProviderDomain[] = [
  'flights',
  'hotels',
  'activities',
  'car_rental',
  'airport_transfer',
  'insurance',
  'visa',
]

let defaultRegistry: BookingProviderRegistry | null = null

export function getDefaultBookingProviderRegistry(): BookingProviderRegistry {
  if (!defaultRegistry) {
    // Simulated providers remain the safe default. Live adapters compose in when
    // `ai.live_providers` (+ per-provider flags / credentials) are enabled.
    const providers = [
      ...createDefaultSimulatedBookingProviders(),
      ...createLiveBookingProviders(),
    ]
    defaultRegistry = createBookingProviderRegistry(providers)
  }
  return defaultRegistry
}

export function resetDefaultBookingProviderRegistry(): void {
  defaultRegistry = null
}

export async function runBookingIntelligence(input: {
  memory: AgentMemory
  userId: string
  registry?: BookingProviderRegistry
  domains?: BookingProviderDomain[]
  signal?: AbortSignal
}): Promise<BookingIntelligenceResult> {
  const started = Date.now()
  const registry = input.registry ?? getDefaultBookingProviderRegistry()
  const requirements = input.memory.requirements
  const locale = input.memory.locale
  const targetCurrency = (requirements.budgetCurrency || 'SAR').toUpperCase()

  const preferences = learnBookingPreferences({
    userId: input.userId,
    requirements,
  })

  const readiness = assessBookingReadiness({
    requirements,
    missingFields: input.memory.missingFields,
    locale,
  })

  const domains = resolveDomains(requirements.packageScope, input.domains)
  const offers: BookingOffer[] = []
  const providerIds = new Set<string>()

  if (readiness.bookingReady || hasMinimumSearchContext(requirements)) {
    const queryBase: Omit<BookingSearchQuery, 'domain'> = {
      origin: requirements.origin || 'RUH',
      destination: requirements.destination || requirements.destinations[0] || null,
      startDate: normalizeIsoDate(requirements.startDate),
      endDate: normalizeIsoDate(requirements.endDate),
      travelers: requirements.travelers ?? 1,
      budgetAmount: requirements.budgetAmount,
      budgetCurrency: targetCurrency,
      locale,
      preferences,
      signal: input.signal,
    }

    for (const domain of domains) {
      const providers = registry.route(domain)
      for (const provider of providers) {
        providerIds.add(provider.providerId)
        try {
          const found = await provider.search({ ...queryBase, domain })
          offers.push(...found)
        } catch {
          // Provider isolation — continue with remaining providers.
        }
      }
    }
  }

  const fused = fuseOffers({ offers, targetCurrency })
  const ranked = rankOffersV2({
    offers: fused,
    preferences,
    budgetAmount: requirements.budgetAmount,
  })
  const combinations = optimizeBookingCombinations({
    ranked,
    targetCurrency,
  })

  const readinessWithOffers = assessBookingReadiness({
    requirements,
    missingFields: input.memory.missingFields,
    locale,
    hasRankedOffers: ranked.length > 0,
  })

  const confidence = buildRecommendationConfidence({
    ranked,
    combinations,
    readiness: readinessWithOffers,
    locale,
  })
  const explanations = explainRecommendations({
    ranked,
    combinations,
    locale,
  })

  // Learn from top pick so future ranking personalizes.
  const top = ranked[0]
  if (top) {
    learnBookingPreferences({
      userId: input.userId,
      requirements,
      selectedOfferIds: [top.id],
      selectedProviderIds: [top.providerId],
    })
  }

  const snapshot: BookingIntelligenceSnapshot = {
    version: 1,
    bookingReady: readinessWithOffers.bookingReady,
    clarification: readinessWithOffers.clarification,
    primaryOfferId: top?.id ?? null,
    rankedCount: ranked.length,
    domainsSearched: domains,
    providerIds: [...providerIds],
    topConfidence: confidence.confidence,
    topExplanation: explanations[0]?.explanation ?? null,
    bestCombinationId: combinations[0]?.id ?? null,
    bestCombinationTotal: combinations[0]?.total ?? null,
    preferenceUserId: getBookingPreferences(input.userId).userId,
    durationMs: Date.now() - started,
  }

  return {
    snapshot,
    ranked,
    fused,
    combinations,
    readiness: readinessWithOffers,
    confidence,
    explanations,
    recommendationFacts: [
      ...explanationFacts(explanations),
      ...confidence.reasons,
      ...(combinations[0]
        ? [`Best combination (${combinations[0].strategy}): ${combinations[0].total.amount} ${combinations[0].total.currency}`]
        : []),
    ],
  }
}

function resolveDomains(
  packageScope: AgentMemory['requirements']['packageScope'],
  override?: BookingProviderDomain[],
): BookingProviderDomain[] {
  if (override?.length) return override
  if (packageScope === 'flights_only') {
    return ['flights', 'airport_transfer', 'insurance', 'visa']
  }
  return DEFAULT_DOMAINS.slice()
}

function hasMinimumSearchContext(requirements: AgentMemory['requirements']): boolean {
  // Sprint 60: search hotels (and packages) once destination + timing are known.
  const hasDestination = Boolean(
    requirements.destination
    || requirements.destinations[0]
    || requirements.destinationFlexible,
  )
  const hasDates = Boolean(
    requirements.startDate
    || (requirements.startDate && requirements.endDate)
    || requirements.durationDays != null,
  )
  return hasDestination && hasDates
}
