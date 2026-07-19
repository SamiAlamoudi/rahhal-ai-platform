import { buildTripPlan as buildAgentTripPlan } from '../../agent/buildItinerary'
import type { AgentLocale, TripRequirements } from '../../agent/types'
import { emptyRequirements } from '../../agent/types'
import type { PlanningSession, TripPlan } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Produce a structured TripPlan from a complete PlanningSession.
 * Embeds agent TripPlan for booking workflow continuity.
 */
export function produceTripPlan(
  session: PlanningSession,
  options?: { partial?: boolean },
): TripPlan {
  const requirements = sessionToRequirements(session)
  const locale = session.locale as AgentLocale
  const complete = !options?.partial
  const agentTripPlan = complete
    ? buildAgentTripPlan({
        requirements,
        conversationId: session.conversationId,
        locale,
        seed: `s22-${session.id}`,
      })
    : null

  return {
    id: newId('engine_plan'),
    sessionId: session.id,
    conversationId: session.conversationId,
    locale: session.locale,
    status: complete ? 'complete' : 'partial',
    destination: session.destination,
    departureCity: session.departureCity,
    travelDates: { ...session.travelDates },
    flexibility: session.flexibility || session.travelDates.flexible,
    travelerCount: session.travelerCount,
    adults: session.adults,
    children: session.children,
    infants: session.infants,
    cabinClass: session.cabinClass,
    hotelPreferences: [...session.hotelPreferences],
    roomRequirements: session.roomRequirements,
    transportation: [...session.transportation],
    activities: [...session.activities],
    budget: { ...session.budget },
    airlinePreferences: [...session.airlinePreferences],
    notes: session.notes,
    agentTripPlan,
    updatedAt: nowIso(),
  }
}

export function sessionToRequirements(session: PlanningSession): TripRequirements {
  const base = emptyRequirements()
  return {
    ...base,
    destination: session.destination,
    destinations: session.destination ? [session.destination] : [],
    origin: session.departureCity,
    startDate: session.travelDates.startDate,
    endDate: session.travelDates.endDate,
    durationDays: session.travelDates.durationDays,
    travelers: session.travelerCount ?? session.adults,
    budgetAmount: session.budget.amount,
    budgetCurrency: session.budget.currency,
    budgetFlexible: session.budget.flexible,
    hotelPreference: session.hotelPreferences[0] ?? null,
    interests: [...session.activities],
    notes: session.notes,
    packageScope:
      session.hotelPreferences.length || session.roomRequirements
        ? 'full_package'
        : session.transportation.includes('flight') && !session.hotelPreferences.length
          ? 'flights_only'
          : null,
  }
}
