import type {
  BrainAction,
  ConversationContext,
  SearchRequestHint,
  TravelIntent,
} from './types'

export interface TravelPlanSketch {
  action: BrainAction
  searchRequests: SearchRequestHint[]
  notes: string[]
}

/**
 * TravelPlanner — decides next domain action from intent + memory (no LLM).
 */
export function TravelPlanner(input: {
  intent: TravelIntent
  context: ConversationContext
  hasMissing: boolean
}): TravelPlanSketch {
  if (input.hasMissing) {
    return { action: 'ask_missing', searchRequests: [], notes: ['awaiting_slots'] }
  }

  const memory = input.context.memory
  const baseSearch = (): SearchRequestHint => ({
    kind: 'flights',
    destination: memory.destination,
    origin: null,
    startDate: memory.travelDates.startDate,
    endDate: memory.travelDates.endDate,
    travelers: memory.travelers.count,
    cabinClass: memory.cabinClass,
    budgetAmount: memory.budget.amount,
    currency: memory.currency ?? memory.budget.currency,
  })

  switch (input.intent) {
    case 'SearchFlights':
      return {
        action: 'search_flights',
        searchRequests: [{ ...baseSearch(), kind: 'flights' }],
        notes: ['ready_for_flight_search'],
      }
    case 'SearchHotels':
      return {
        action: 'search_hotels',
        searchRequests: [{ ...baseSearch(), kind: 'hotels' }],
        notes: ['ready_for_hotel_search'],
      }
    case 'SearchPackages':
      return {
        action: 'search_packages',
        searchRequests: [{ ...baseSearch(), kind: 'packages' }],
        notes: ['ready_for_package_search'],
      }
    case 'AskRecommendation':
      return { action: 'recommend', searchRequests: [], notes: ['recommend'] }
    case 'TravelAdvice':
      return { action: 'advise', searchRequests: [], notes: ['advise'] }
    case 'VisaQuestion':
      return { action: 'visa_info', searchRequests: [], notes: ['visa'] }
    case 'WeatherQuestion':
      return { action: 'weather_info', searchRequests: [], notes: ['weather'] }
    case 'BudgetPlanning':
      return { action: 'budget_plan', searchRequests: [], notes: ['budget'] }
    case 'PackingAdvice':
      return { action: 'packing_advice', searchRequests: [], notes: ['packing'] }
    case 'ModifyTrip':
      return { action: 'modify_trip', searchRequests: [], notes: ['modify'] }
    case 'CancelBooking':
      return { action: 'cancel_booking', searchRequests: [], notes: ['cancel'] }
    case 'ContinueBooking':
      return { action: 'continue_booking', searchRequests: [], notes: ['continue'] }
    default:
      return { action: 'acknowledge', searchRequests: [], notes: ['general'] }
  }
}
