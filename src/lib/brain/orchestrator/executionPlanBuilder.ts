/**
 * Sprint 27 — build a provider-independent execution plan from intent + trip context.
 * Does not execute providers; TravelExecutionEngine / adapters do that.
 */

import type { TravelIntent } from '../types'
import type { ExecutionTaskType } from '../execution/types'
import type { TripPlan as EngineTripPlan } from '../tripPlanning/types'
import { domainsForIntent } from './intent'
import type {
  OrchestratorDomain,
  OrchestratorDomainStep,
  OrchestratorExecutionPlan,
} from './types'

const DOMAIN_TO_TASK: Record<OrchestratorDomain, ExecutionTaskType> = {
  flights: 'flight_search',
  hotels: 'hotel_search',
  transport: 'transport_search',
  activities: 'activities_search',
  packages: 'package_search',
}

const DOMAIN_PRIORITY: Record<OrchestratorDomain, number> = {
  flights: 100,
  hotels: 90,
  transport: 80,
  activities: 70,
  packages: 60,
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Decide which domains are enabled given intent + optional complete TripPlan.
 */
export function resolveOrchestratorDomains(input: {
  intent: TravelIntent
  tripPlan?: EngineTripPlan | null
  explicitDomains?: OrchestratorDomain[]
}): OrchestratorDomainStep[] {
  const requested = input.explicitDomains?.length
    ? input.explicitDomains
    : domainsForIntent(input.intent)

  const trip = input.tripPlan
  const notes = (trip?.notes ?? '').toLowerCase()
  const packageScope = trip?.agentTripPlan?.requirements?.packageScope
  const flightsOnly =
    packageScope === 'flights_only' ||
    notes.includes('flights_only') ||
    notes.includes('flights only')
  const hotelOff =
    flightsOnly ||
    (trip != null &&
      trip.hotelPreferences.length === 0 &&
      input.intent === 'SearchFlights')

  return requested.map((domain) => {
    let enabled = true
    let reason = `Requested by intent ${input.intent}`

    if (flightsOnly && domain !== 'flights') {
      enabled = false
      reason = 'Trip scoped to flights only'
    } else if (domain === 'hotels' && hotelOff) {
      enabled = false
      reason = 'Hotel not required for this trip'
    } else if (domain === 'packages' && hotelOff) {
      enabled = false
      reason = 'Packages skipped without hotel'
    } else if (
      domain === 'activities' &&
      trip &&
      trip.activities.length === 0 &&
      input.intent === 'SearchFlights'
    ) {
      enabled = false
      reason = 'No activities requested for flight-only intent'
    }

    return {
      domain,
      taskType: DOMAIN_TO_TASK[domain],
      priority: DOMAIN_PRIORITY[domain],
      enabled,
      reason,
    }
  })
}

export function buildOrchestratorExecutionPlan(input: {
  conversationId: string
  intent: TravelIntent
  confidence: number
  tripPlan?: EngineTripPlan | null
  explicitDomains?: OrchestratorDomain[]
}): OrchestratorExecutionPlan {
  const domains = resolveOrchestratorDomains({
    intent: input.intent,
    tripPlan: input.tripPlan,
    explicitDomains: input.explicitDomains,
  })

  return {
    id: newId('oplan'),
    conversationId: input.conversationId,
    intent: input.intent,
    confidence: input.confidence,
    domains,
    requestedDomains: domains.filter((d) => d.enabled).map((d) => d.domain),
    createdAt: nowIso(),
  }
}
