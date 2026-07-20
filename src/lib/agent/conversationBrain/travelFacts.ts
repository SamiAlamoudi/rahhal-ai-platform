/**
 * Experience Sprint 2 — Travel Intelligence facts only.
 * Never user-facing prose. Conversation Brain turns these into language.
 */

import type { AgentLocale, AgentMemory, TripPlan, TripRequirements } from '../types'
import type { AgentToolRunSummary } from '../types'

export type ConversationObjective =
  | 'greet_or_continue'
  | 'collect_missing'
  | 'present_plan'
  | 'acknowledge_save'
  | 'acknowledge_edit'
  | 'advise'
  | 'propose_options'
  | 'confirm_understanding'
  | 'explain_unavailable'
  | 'general'

export interface TravelFactsFlight {
  from: string
  to: string
  airline?: string | null
  estimatedCost?: number | null
  currency?: string | null
  notes?: string | null
}

export interface TravelFactsHotel {
  name: string
  area: string
  category: string
  estimatedNightly?: number | null
  currency?: string | null
  fit?: string | null
}

export interface TravelFactsDay {
  day: number
  title: string
  location: string
  activities: string[]
  weatherSummary?: string | null
}

export interface TravelFacts {
  locale: AgentLocale
  objective: ConversationObjective
  known: Partial<{
    destination: string
    destinations: string[]
    origin: string
    startDate: string
    endDate: string
    durationDays: number
    travelers: number
    travelerType: string
    budgetAmount: number
    budgetCurrency: string
    budgetFlexible: boolean
    budgetStyle: string
    hotelPreference: string
    packageScope: string
    weatherPreference: string
    interests: string[]
    tripPurpose: string
    notes: string
  }>
  /** Hard slots still empty — LLM decides whether/how to ask. */
  missingSlots: string[]
  /** Soft signals / concierge notes (not scripted questions). */
  softSignals?: Record<string, unknown>
  heardSummary?: string[]
  optionHints?: string[]
  warnings?: string[]
  recommendations?: string[]
  plan?: {
    title: string
    summary: string
    destinations: string[]
    durationDays: number
    travelers: number | null
    travelerType: string | null
    dates: string
    estimatedTotal: { amount: number; currency: string } | null
    budgetBreakdown: Array<{ label: string; amount: number; currency: string }>
    days: TravelFactsDay[]
    flights: TravelFactsFlight[]
    hotels: TravelFactsHotel[]
    attractions: string[]
    weatherNotes: string[]
    visaNotes: string[]
    travelTips: string[]
    packingSuggestions: string[]
    whyChoices: string[]
  } | null
  toolSummaries?: Array<{ tool: string; summary: string }>
  savedTitle?: string | null
  phase?: string
  lastIntent?: string
}

export function buildKnownFromRequirements(req: TripRequirements): TravelFacts['known'] {
  const known: TravelFacts['known'] = {}
  if (req.destination) known.destination = req.destination
  if (req.destinations?.length) known.destinations = req.destinations
  if (req.origin) known.origin = req.origin
  if (req.startDate) known.startDate = req.startDate
  if (req.endDate) known.endDate = req.endDate
  if (req.durationDays != null) known.durationDays = req.durationDays
  if (req.travelers != null) known.travelers = req.travelers
  if (req.travelerType) known.travelerType = req.travelerType
  if (req.budgetAmount != null) known.budgetAmount = req.budgetAmount
  if (req.budgetCurrency) known.budgetCurrency = req.budgetCurrency
  if (req.budgetFlexible != null) known.budgetFlexible = req.budgetFlexible
  if (req.budgetStyle) known.budgetStyle = req.budgetStyle
  if (req.hotelPreference) known.hotelPreference = req.hotelPreference
  if (req.packageScope) known.packageScope = req.packageScope
  if (req.weatherPreference) known.weatherPreference = req.weatherPreference
  if (req.interests?.length) known.interests = req.interests
  if (req.tripPurpose) known.tripPurpose = req.tripPurpose
  if (req.notes) known.notes = req.notes
  return known
}

export function buildPlanFacts(plan: TripPlan): NonNullable<TravelFacts['plan']> {
  return {
    title: plan.title,
    summary: plan.summary,
    destinations: plan.destinations,
    durationDays: plan.durationDays,
    travelers: plan.travelers,
    travelerType: plan.travelerType,
    dates: plan.startDate && plan.endDate
      ? `${plan.startDate} → ${plan.endDate}`
      : plan.startDate
        ? `${plan.startDate}`
        : `${plan.durationDays} days (flexible)`,
    estimatedTotal: plan.estimatedCosts
      ? { amount: plan.estimatedCosts.amount, currency: plan.estimatedCosts.currency }
      : null,
    budgetBreakdown: (plan.estimatedBudget?.breakdown ?? []).map((row) => ({
      label: row.label,
      amount: row.amount,
      currency: plan.estimatedBudget.currency,
    })),
    days: plan.dailyItinerary.map((day) => ({
      day: day.day,
      title: day.title,
      location: day.location,
      activities: day.activities.map((a) => [a.time, a.title, a.description].filter(Boolean).join(' — ')),
      weatherSummary: day.weather?.summary ?? null,
    })),
    flights: plan.flights.map((f) => ({
      from: f.from,
      to: f.to,
      airline: f.airline,
      estimatedCost: f.estimatedCost,
      currency: f.currency,
      notes: f.notes,
    })),
    hotels: plan.accommodations.map((h) => ({
      name: h.name,
      area: h.area,
      category: h.category,
      estimatedNightly: h.estimatedNightly,
      currency: h.currency,
      fit: h.fit,
    })),
    attractions: plan.attractions.map((a) => a.tag ? `${a.title} · ${a.tag}` : a.title),
    weatherNotes: plan.weatherNotes,
    visaNotes: plan.visaNotes,
    travelTips: plan.travelTips,
    packingSuggestions: plan.packingSuggestions,
    whyChoices: [
      plan.decision?.flight?.whySelected,
      plan.decision?.hotel?.whySelected,
      plan.decision?.activities?.whySelected,
      ...(plan.decision?.suggestions ?? []).slice(0, 3),
    ].filter((x): x is string => Boolean(x)),
  }
}

export function buildTravelFacts(input: {
  memory: AgentMemory
  objective: ConversationObjective
  tripPlan?: TripPlan | null
  missingSlots?: string[]
  softSignals?: Record<string, unknown>
  heardSummary?: string[]
  optionHints?: string[]
  warnings?: string[]
  recommendations?: string[]
  toolResults?: AgentToolRunSummary[]
  savedTitle?: string | null
}): TravelFacts {
  const plan = input.tripPlan ?? input.memory.tripPlan
  return {
    locale: input.memory.locale,
    objective: input.objective,
    known: buildKnownFromRequirements(input.memory.requirements),
    missingSlots: input.missingSlots ?? input.memory.missingFields.map(String),
    softSignals: input.softSignals,
    heardSummary: input.heardSummary,
    optionHints: input.optionHints,
    warnings: input.warnings,
    recommendations: input.recommendations,
    plan: plan ? buildPlanFacts(plan) : null,
    toolSummaries: input.toolResults?.map((t) => ({ tool: t.tool, summary: t.summary })),
    savedTitle: input.savedTitle,
    phase: input.memory.phase,
    lastIntent: input.memory.lastIntent,
  }
}
