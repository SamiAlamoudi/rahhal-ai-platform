/**
 * Sprint 78 — search strategy + tool ordering decisions.
 */

import type { AgentMemory } from '../types'
import type {
  DetectedConstraint,
  PlannerDecisions,
  SearchPlan,
  SearchToolHint,
  TravelPurpose,
  TravelStrategy,
  TripType,
} from './types'

export function buildSearchStrategy(input: {
  purpose: TravelPurpose
  tripType: TripType
  constraints: DetectedConstraint[]
  riskFlags: string[]
  memory?: AgentMemory | null
  missingInformation: string[]
}): {
  decisions: PlannerDecisions
  searchPlan: SearchPlan
  strategy: TravelStrategy
} {
  const { purpose, tripType, constraints, riskFlags, memory, missingInformation } = input
  const has = (kind: DetectedConstraint['kind']) => constraints.some((c) => c.kind === kind)
  const visaSatisfied = riskFlags.includes('visa_satisfied')
    || constraints.some((c) => c.kind === 'visa' && c.value === 'already_have')

  const criticalMissing = missingInformation.filter((m) =>
    ['destination', 'dates', 'travelers'].includes(m),
  )
  const shouldAskQuestion = criticalMissing.length > 0
  const searchImmediately = !shouldAskQuestion

  const needVisaCheck = !visaSatisfied && (
    riskFlags.includes('visa_check_required')
    || isLikelyInternational(memory?.requirements.destination ?? constraints.find((c) => c.kind === 'destination')?.value)
  )
  const needWeather = has('weather')
    || purpose === 'adventure'
    || purpose === 'vacation'
    || purpose === 'weekend'
  const needAirportTransfer = has('meeting_time')
    || has('accessibility')
    || purpose === 'business'
    || purpose === 'conference'
    || purpose === 'medical'
  const needMultiCity = tripType === 'multi_city'
    || (memory?.requirements.destinations?.length ?? 0) > 1
  const needFlexibleDates = constraints.some((c) => c.kind === 'dates' && c.value === 'flexible_window')
    || memory?.requirements.budgetFlexible === true

  const hotelFirst = has('hotel_brand')
    || purpose === 'luxury'
    || purpose === 'honeymoon'
    || purpose === 'medical'
  const flightsFirst = has('direct_flight')
    || has('meeting_time')
    || purpose === 'business'
    || purpose === 'conference'
    || !hotelFirst

  const order: SearchToolHint[] = []
  const skip: SearchToolHint[] = []

  if (needWeather) order.push('weather')
  if (needVisaCheck) order.push('visa')
  else skip.push('visa')

  if (hotelFirst) {
    order.push('hotels', 'flights')
  } else {
    order.push('flights', 'hotels')
  }
  if (needAirportTransfer) order.push('transportation', 'maps')
  else order.push('maps')
  order.push('attractions')
  if (has('budget')) order.push('currency')

  const uniqueOrder = [...new Set(order)]

  const decisions: PlannerDecisions = {
    shouldAskQuestion,
    searchImmediately,
    needVisaCheck,
    needWeather,
    needAirportTransfer,
    needHotelFirst: hotelFirst,
    needFlightsFirst: flightsFirst && !hotelFirst,
    needMultiCity,
    needFlexibleDates,
  }

  const searchPlan: SearchPlan = {
    searchImmediately,
    shouldAskQuestion,
    needVisaCheck,
    needWeather,
    needAirportTransfer,
    hotelFirst,
    flightsFirst: decisions.needFlightsFirst,
    multiCity: needMultiCity,
    flexibleDates: needFlexibleDates,
    recommendedSearchOrder: uniqueOrder,
    skipTools: [...new Set(skip)],
  }

  const rationale: string[] = [
    `purpose=${purpose}`,
    hotelFirst ? 'hotel-first strategy' : 'flights-first strategy',
  ]
  if (needVisaCheck) rationale.push('visa check recommended')
  if (visaSatisfied) rationale.push('visa already satisfied — skip visa tool')
  if (has('direct_flight')) rationale.push('direct flights required')
  if (has('meeting_time')) rationale.push('hard arrival deadline')
  if (needMultiCity) rationale.push('multi-city itinerary')
  if (shouldAskQuestion) rationale.push(`ask before search: ${criticalMissing.join(',')}`)

  const strategy: TravelStrategy = {
    summary: buildSummary(purpose, hotelFirst, shouldAskQuestion),
    approach: shouldAskQuestion
      ? 'clarify_then_search'
      : hotelFirst
        ? 'hotel_anchored_search'
        : 'flight_anchored_search',
    engines: uniqueOrder,
    rationale,
  }

  return { decisions, searchPlan, strategy }
}

function buildSummary(purpose: TravelPurpose, hotelFirst: boolean, ask: boolean): string {
  if (ask) return `Clarify critical details before searching (${purpose}).`
  return hotelFirst
    ? `Anchor on preferred stay, then match flights (${purpose}).`
    : `Lock flights to constraints, then match hotels (${purpose}).`
}

function isLikelyInternational(destination: unknown): boolean {
  if (typeof destination !== 'string' || !destination.trim()) return false
  const local = ['riyadh', 'jeddah', 'dammam', 'الرياض', 'جدة']
  const key = destination.trim().toLowerCase()
  return !local.some((city) => key.includes(city))
}
