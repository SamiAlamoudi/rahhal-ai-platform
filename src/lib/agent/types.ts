/**
 * Travel AI Agent domain types — structured planning over the shared chatEngine.
 */

export type AgentLocale = 'ar' | 'en'

export type TravelerType = 'solo' | 'couple' | 'family' | 'friends'

export type AgentPhase = 'collecting' | 'planned' | 'editing'

export type AgentIntent =
  | 'plan'
  | 'answer'
  | 'regenerate'
  | 'edit'
  | 'save'
  | 'unknown'

export interface TripRequirements {
  destination: string | null
  destinations: string[]
  origin: string | null
  startDate: string | null
  endDate: string | null
  durationDays: number | null
  travelers: number | null
  travelerType: TravelerType | null
  budgetAmount: number | null
  budgetCurrency: string | null
  interests: string[]
  notes: string | null
}

export interface ItineraryActivity {
  time: string | null
  title: string
  description: string | null
}

export interface ItineraryDay {
  day: number
  title: string
  location: string
  activities: ItineraryActivity[]
}

export interface TransportationItem {
  mode: string
  from: string
  to: string
  notes: string | null
  estimatedCost: number | null
  currency: string | null
}

export interface BudgetBreakdownLine {
  label: string
  amount: number
}

export interface EstimatedBudget {
  amount: number
  currency: string
  breakdown: BudgetBreakdownLine[]
}

export interface TravelItinerary {
  id: string
  title: string
  locale: AgentLocale
  destinations: string[]
  startDate: string | null
  endDate: string | null
  durationDays: number
  travelers: number
  travelerType: TravelerType | null
  activities: ItineraryDay[]
  transportation: TransportationItem[]
  estimatedBudget: EstimatedBudget
  notes: string[]
  conversationId: string
  requirements: TripRequirements
  updatedAt: string
}

export interface AgentMemory {
  locale: AgentLocale
  phase: AgentPhase
  requirements: TripRequirements
  itinerary: TravelItinerary | null
  missingFields: Array<keyof TripRequirements>
  lastIntent: AgentIntent
}

export interface AgentProviderMeta {
  kind: 'travel_agent'
  version: 1
  memory: AgentMemory
  itinerary: TravelItinerary | null
}

export function emptyRequirements(): TripRequirements {
  return {
    destination: null,
    destinations: [],
    origin: null,
    startDate: null,
    endDate: null,
    durationDays: null,
    travelers: null,
    travelerType: null,
    budgetAmount: null,
    budgetCurrency: null,
    interests: [],
    notes: null,
  }
}

export function emptyMemory(locale: AgentLocale = 'ar'): AgentMemory {
  return {
    locale,
    phase: 'collecting',
    requirements: emptyRequirements(),
    itinerary: null,
    missingFields: ['destination', 'durationDays'],
    lastIntent: 'unknown',
  }
}
