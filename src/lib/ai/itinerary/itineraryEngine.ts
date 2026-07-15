/**
 * Phase AD — ItineraryEngine v1.
 * Builds complete explainable itineraries from recommendations + preferences.
 */

import { createRecommendationEngine } from '../recommendations/recommendationEngine'
import type { RecommendationEngine } from '../recommendations/recommendationEngine'
import type {
  ActivitySlot,
  CostBreakdown,
  Itinerary,
  ItineraryDay,
  ItineraryEngineInput,
  ItineraryFlightLeg,
  ItineraryHotelStay,
  ItineraryOptimizationGoal,
  ItineraryTransportLeg,
} from './models'
import {
  buildOptimizationResult,
  computeOptimizationScores,
  optimizeDayForTravelTime,
  optimizeDaysForBudget,
  optimizeDaysForDiversity,
  optimizeDaysForPreferences,
} from './optimizer'

const INTEREST_CATALOG = [
  'culture',
  'food',
  'shopping',
  'nature',
  'adventure',
  'museum',
  'nightlife',
  'family',
] as const

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function addDays(isoDate: string | null | undefined, offset: number): string | null {
  if (!isoDate) return null
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function clampDuration(days: number): number {
  return Math.max(1, Math.min(21, Math.floor(days)))
}

export class ItineraryEngine {
  private readonly recommendations: RecommendationEngine

  constructor(recommendationEngine: RecommendationEngine = createRecommendationEngine()) {
    this.recommendations = recommendationEngine
  }

  generate(input: ItineraryEngineInput): Itinerary {
    const locale = input.locale ?? 'en'
    const durationDays = clampDuration(input.durationDays)
    const destinations = uniqueDestinations(input.destinations?.length
      ? input.destinations
      : [input.destination])
    const destination = destinations[0] ?? input.destination
    const currency = input.budgetCurrency ?? 'SAR'
    const interests = uniqueStrings([
      ...(input.interests ?? []),
      ...(input.profile?.interests ?? []),
    ])
    const goal: ItineraryOptimizationGoal = input.optimizationGoal ?? 'preference_score'
    const maxActivities = input.constraints?.maxActivitiesPerDay ?? 3

    const seeded = this.seedFromRecommendations(input, interests, locale)
    const flights = buildFlights(input, destination, currency, locale)
    const hotels = buildHotels(input, destination, durationDays, currency, locale)
    let days = buildDays({
      durationDays,
      startDate: input.startDate ?? null,
      destinations,
      interests: interests.length ? interests : ['culture', 'food'],
      seeded,
      currency,
      locale,
      maxActivities,
      flights,
      hotels,
    })

    const transportBase = buildTransportation(days, currency)
    let applied: string[] = []

    if (goal === 'minimum_travel_time') {
      days = days.map(optimizeDayForTravelTime)
      applied.push('Clustered same-tag activities to reduce travel time')
    } else if (goal === 'budget_fit') {
      const result = optimizeDaysForBudget(days, input.budgetAmount ?? null)
      days = result.days
      applied = result.applied
    } else if (goal === 'preference_score') {
      days = optimizeDaysForPreferences(days, interests)
      applied.push('Prioritized activities matching traveler interests')
    } else if (goal === 'activity_diversity') {
      days = optimizeDaysForDiversity(days)
      applied.push('Rotated activity tags to improve diversity')
    }

    // Always ensure free-time blocks exist.
    days = days.map((day) => ensureFreeTime(day, currency, locale))

    const transportation = rebuildTransportCosts(days, transportBase, goal)
    const costs = buildCostBreakdown(days, flights, hotels, transportation, currency, input.budgetAmount ?? null)
    const transportMinutes = transportation.reduce((n, t) => n + t.durationMinutes, 0)
    const scores = computeOptimizationScores({
      days,
      transportMinutes,
      totalCost: costs.total,
      budgetAmount: input.budgetAmount ?? null,
      interests,
    })
    const optimization = buildOptimizationResult({
      goal,
      scores,
      locale,
      applied,
    })

    const matchedPreferences = uniqueStrings([
      ...seeded.flatMap((s) => s.matchedPreferences),
      ...interests.map((i) => `interest:${i}`),
    ])
    const unmatchedPreferences = (input.constraints?.mustAvoid ?? []).map((x) => `avoid:${x}`)

    const explanation = buildExplanation({
      locale,
      optimizationSummary: optimization.summary,
      scoresConfidence: scores.overall,
      assumptions: buildAssumptions(input, destination, durationDays, locale),
      tradeOffs: optimization.tradeOffs,
      matchedPreferences,
      unmatchedPreferences,
    })

    return {
      id: generateId('itinerary'),
      title: locale === 'ar'
        ? `خطة ${durationDays} أيام إلى ${destination}`
        : `${durationDays}-day plan to ${destination}`,
      destination,
      destinations,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? addDays(input.startDate, durationDays - 1),
      durationDays,
      locale,
      days,
      flights,
      hotels,
      transportation,
      costs,
      optimization,
      explanation,
      recommendationIds: seeded.map((s) => s.id),
      version: 1,
      createdAt: new Date().toISOString(),
    }
  }

  private seedFromRecommendations(
    input: ItineraryEngineInput,
    interests: string[],
    locale: 'ar' | 'en',
  ): Array<{
    id: string
    title: string
    tags: string[]
    estimatedCost: number
    matchedPreferences: string[]
  }> {
    if (input.recommendations?.length) {
      return input.recommendations.map((r) => ({
        id: r.id,
        title: r.title,
        tags: uniqueStrings([...(r.tags ?? []), ...(r.matchedPreferences ?? []).map(stripPrefPrefix)]),
        estimatedCost: r.estimatedCost ?? 120,
        matchedPreferences: r.matchedPreferences ?? [],
      }))
    }

    // Use RecommendationEngine to score synthetic activity candidates.
    const month = input.startDate ? Number(input.startDate.slice(5, 7)) : null
    const candidates = INTEREST_CATALOG.map((tag, idx) => ({
      id: `seed_${tag}`,
      kind: 'activity' as const,
      title: locale === 'ar' ? `نشاط ${tag}` : `${capitalize(tag)} experience`,
      estimatedCost: 80 + idx * 25,
      durationDays: 1,
      popularity: interests.includes(tag) ? 0.85 : 0.5,
      seasonalityTags: ['spring', 'autumn', 'summer', 'winter'] as Array<'spring' | 'autumn' | 'summer' | 'winter'>,
      travelStyles: [input.travelStyle ?? input.profile?.travelStyle ?? 'balanced'].filter(Boolean) as string[],
      travelerTypes: input.travelerType ? [input.travelerType] : [],
      tags: [tag],
      destination: input.destination,
      baseScore: interests.includes(tag) ? 80 : 55,
    }))

    const result = this.recommendations.recommendV1({
      context: {
        destination: input.destination,
        destinations: input.destinations ?? [input.destination],
        locale,
        tripDurationDays: input.durationDays,
        travelMonth: month,
        season: null,
        budgetAmount: input.budgetAmount ?? null,
        budgetCurrency: input.budgetCurrency ?? 'SAR',
        travelerType: input.travelerType ?? null,
        travelStyle: input.travelStyle ?? input.profile?.travelStyle ?? null,
        interests,
      },
      candidates,
      maxResults: Math.min(6, candidates.length),
    })

    return result.recommendations.map((r) => ({
      id: r.candidateId,
      title: r.title,
      tags: uniqueStrings(r.matchedPreferences.map(stripPrefPrefix).concat(
        candidates.find((c) => c.id === r.candidateId)?.tags ?? [],
      )),
      estimatedCost: candidates.find((c) => c.id === r.candidateId)?.estimatedCost ?? 100,
      matchedPreferences: r.matchedPreferences,
    }))
  }
}

function buildFlights(
  input: ItineraryEngineInput,
  destination: string,
  currency: string,
  locale: 'ar' | 'en',
): ItineraryFlightLeg[] {
  const origin = input.origin ?? (locale === 'ar' ? 'الرياض' : 'Riyadh')
  const direct = input.constraints?.preferDirectFlights
    ?? input.profile?.preferDirectFlights
    ?? true
  const cost = direct ? 1800 : 1400
  return [
    {
      id: 'flight_outbound',
      from: origin,
      to: destination,
      airline: 'Mock Air',
      departAt: input.startDate ? `${input.startDate}T08:00:00.000Z` : null,
      arriveAt: input.startDate ? `${input.startDate}T14:00:00.000Z` : null,
      estimatedCost: cost,
      currency,
      direct,
    },
    {
      id: 'flight_return',
      from: destination,
      to: origin,
      airline: 'Mock Air',
      departAt: input.endDate ? `${input.endDate}T16:00:00.000Z` : null,
      arriveAt: input.endDate ? `${input.endDate}T22:00:00.000Z` : null,
      estimatedCost: cost,
      currency,
      direct,
    },
  ]
}

function buildHotels(
  input: ItineraryEngineInput,
  destination: string,
  durationDays: number,
  currency: string,
  locale: 'ar' | 'en',
): ItineraryHotelStay[] {
  const nights = Math.max(1, durationDays - 1)
  const central = input.constraints?.preferCentralHotels
    ?? input.profile?.preferCentralHotels
    ?? true
  const style = input.profile?.budgetStyle ?? 'midrange'
  const nightly = style === 'luxury' ? 900 : style === 'budget' ? 250 : 450
  return [{
    id: 'hotel_main',
    name: locale === 'ar'
      ? (central ? `فندق وسط ${destination}` : `إقامة في ${destination}`)
      : (central ? `${destination} Central Stay` : `${destination} Stay`),
    area: central ? (locale === 'ar' ? 'وسط المدينة' : 'City center') : (locale === 'ar' ? 'ضاحية' : 'District'),
    checkIn: input.startDate ?? null,
    checkOut: input.endDate ?? addDays(input.startDate, nights),
    nights,
    estimatedNightly: nightly,
    estimatedTotal: nightly * nights,
    currency,
    tags: central ? ['central', 'hotel'] : ['hotel'],
  }]
}

function buildDays(input: {
  durationDays: number
  startDate: string | null
  destinations: string[]
  interests: string[]
  seeded: Array<{ id: string; title: string; tags: string[]; estimatedCost: number }>
  currency: string
  locale: 'ar' | 'en'
  maxActivities: number
  flights: ItineraryFlightLeg[]
  hotels: ItineraryHotelStay[]
}): ItineraryDay[] {
  const days: ItineraryDay[] = []
  for (let day = 1; day <= input.durationDays; day += 1) {
    const location = input.destinations[(day - 1) % input.destinations.length]!
    const date = addDays(input.startDate, day - 1)
    const slots: ActivitySlot[] = []

    if (day === 1) {
      slots.push({
        id: `slot_flight_${day}`,
        kind: 'flight',
        title: input.locale === 'ar' ? 'وصول الرحلة' : 'Flight arrival',
        startTime: '08:00',
        endTime: '10:00',
        location,
        estimatedCost: 0,
        currency: input.currency,
        preferenceTags: ['flight'],
        notes: input.flights[0]?.airline ?? null,
      })
      slots.push({
        id: `slot_hotel_${day}`,
        kind: 'hotel',
        title: input.locale === 'ar' ? 'تسجيل الوصول للفندق' : 'Hotel check-in',
        startTime: '15:00',
        endTime: '16:00',
        location: input.hotels[0]?.area ?? location,
        estimatedCost: 0,
        currency: input.currency,
        preferenceTags: input.hotels[0]?.tags ?? ['hotel'],
        notes: input.hotels[0]?.name ?? null,
      })
    }

    const activitiesForDay = pickActivitiesForDay(input.seeded, input.interests, day, input.maxActivities)
    activitiesForDay.forEach((act, idx) => {
      const startHour = 10 + idx * 2
      slots.push({
        id: `slot_act_${day}_${act.id}`,
        kind: 'activity',
        title: act.title,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(startHour + 1).padStart(2, '0')}:30`,
        location,
        estimatedCost: act.estimatedCost,
        currency: input.currency,
        preferenceTags: act.tags,
        notes: null,
      })
      if (idx < activitiesForDay.length - 1) {
        slots.push({
          id: `slot_transport_${day}_${idx}`,
          kind: 'transport',
          title: input.locale === 'ar' ? 'تنقل محلي' : 'Local transfer',
          startTime: `${String(startHour + 1).padStart(2, '0')}:30`,
          endTime: `${String(startHour + 2).padStart(2, '0')}:00`,
          location,
          estimatedCost: 35,
          currency: input.currency,
          preferenceTags: ['transport'],
          notes: null,
        })
      }
    })

    if (day === input.durationDays) {
      slots.push({
        id: `slot_meal_${day}`,
        kind: 'meal',
        title: input.locale === 'ar' ? 'وجبة وداع' : 'Farewell meal',
        startTime: '12:30',
        endTime: '13:30',
        location,
        estimatedCost: 90,
        currency: input.currency,
        preferenceTags: ['food'],
        notes: null,
      })
    }

    slots.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))
    const estimatedDayCost = slots.reduce((n, s) => n + s.estimatedCost, 0)
    days.push({
      day,
      date,
      title: input.locale === 'ar' ? `اليوم ${day} — ${location}` : `Day ${day} — ${location}`,
      location,
      slots,
      activities: slots.filter((s) => s.kind !== 'free_time'),
      freeTimeMinutes: 0,
      estimatedDayCost: Number(estimatedDayCost.toFixed(2)),
    })
  }
  return days
}

function pickActivitiesForDay(
  seeded: Array<{ id: string; title: string; tags: string[]; estimatedCost: number }>,
  interests: string[],
  day: number,
  maxActivities: number,
): Array<{ id: string; title: string; tags: string[]; estimatedCost: number }> {
  if (!seeded.length) {
    return interests.slice(0, maxActivities).map((interest, idx) => ({
      id: `gen_${interest}_${day}_${idx}`,
      title: capitalize(interest),
      tags: [interest],
      estimatedCost: 100 + idx * 20,
    }))
  }
  const rotated = [
    ...seeded.slice((day - 1) % seeded.length),
    ...seeded.slice(0, (day - 1) % seeded.length),
  ]
  return rotated.slice(0, maxActivities)
}

function buildTransportation(days: ItineraryDay[], currency: string): ItineraryTransportLeg[] {
  const legs: ItineraryTransportLeg[] = []
  for (const day of days) {
    const transports = day.slots.filter((s) => s.kind === 'transport')
    transports.forEach((slot, idx) => {
      legs.push({
        id: `transport_${day.day}_${idx}`,
        mode: 'local_transfer',
        from: day.location,
        to: day.location,
        day: day.day,
        estimatedCost: slot.estimatedCost,
        currency,
        durationMinutes: 30,
      })
    })
  }
  return legs
}

function rebuildTransportCosts(
  days: ItineraryDay[],
  previous: ItineraryTransportLeg[],
  goal: ItineraryOptimizationGoal,
): ItineraryTransportLeg[] {
  const factor = goal === 'minimum_travel_time' ? 0.75 : 1
  return buildTransportation(days, previous[0]?.currency ?? 'SAR').map((leg, idx) => ({
    ...leg,
    durationMinutes: Math.max(15, Math.round((previous[idx]?.durationMinutes ?? 30) * factor)),
    estimatedCost: Number((leg.estimatedCost * factor).toFixed(2)),
  }))
}

function ensureFreeTime(day: ItineraryDay, currency: string, locale: 'ar' | 'en'): ItineraryDay {
  const hasFree = day.slots.some((s) => s.kind === 'free_time')
  const slots = hasFree
    ? day.slots
    : [
      ...day.slots,
      {
        id: `free_${day.day}`,
        kind: 'free_time' as const,
        title: locale === 'ar' ? 'وقت حر' : 'Free time',
        startTime: '18:00',
        endTime: '19:30',
        location: day.location,
        estimatedCost: 0,
        currency,
        preferenceTags: [],
        notes: null,
      },
    ].sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id))

  const freeTimeMinutes = slots
    .filter((s) => s.kind === 'free_time')
    .reduce((n, s) => n + minutesBetween(s.startTime, s.endTime), 0)
  return {
    ...day,
    slots,
    activities: slots.filter((s) => s.kind !== 'free_time'),
    freeTimeMinutes,
    estimatedDayCost: Number(slots.reduce((n, s) => n + s.estimatedCost, 0).toFixed(2)),
  }
}

function buildCostBreakdown(
  days: ItineraryDay[],
  flights: ItineraryFlightLeg[],
  hotels: ItineraryHotelStay[],
  transportation: ItineraryTransportLeg[],
  currency: string,
  budgetAmount: number | null,
): CostBreakdown {
  const activities = days
    .flatMap((d) => d.slots)
    .filter((s) => s.kind === 'activity')
    .reduce((n, s) => n + s.estimatedCost, 0)
  const meals = days
    .flatMap((d) => d.slots)
    .filter((s) => s.kind === 'meal')
    .reduce((n, s) => n + s.estimatedCost, 0)
  const flightCost = flights.reduce((n, f) => n + f.estimatedCost, 0)
  const hotelCost = hotels.reduce((n, h) => n + h.estimatedTotal, 0)
  const transportCost = transportation.reduce((n, t) => n + t.estimatedCost, 0)
  const total = flightCost + hotelCost + activities + transportCost + meals
  const budgetDelta = budgetAmount == null ? null : Number((budgetAmount - total).toFixed(2))
  return {
    currency,
    flights: Number(flightCost.toFixed(2)),
    hotels: Number(hotelCost.toFixed(2)),
    activities: Number(activities.toFixed(2)),
    transportation: Number(transportCost.toFixed(2)),
    meals: Number(meals.toFixed(2)),
    other: 0,
    total: Number(total.toFixed(2)),
    budgetAmount,
    budgetDelta,
    withinBudget: budgetAmount == null ? null : total <= budgetAmount,
  }
}

function buildAssumptions(
  input: ItineraryEngineInput,
  destination: string,
  durationDays: number,
  locale: 'ar' | 'en',
): string[] {
  if (locale === 'ar') {
    return [
      `مدة الرحلة ${durationDays} أيام إلى ${destination}`,
      input.budgetAmount != null ? `الميزانية المستهدفة ${input.budgetAmount} ${input.budgetCurrency ?? 'SAR'}` : 'لم تُحدد ميزانية صارمة',
      'يتم استخدام مزودي البيانات الوهميين (mock) في هذه المرحلة',
    ]
  }
  return [
    `Trip length is ${durationDays} days to ${destination}`,
    input.budgetAmount != null
      ? `Target budget is ${input.budgetAmount} ${input.budgetCurrency ?? 'SAR'}`
      : 'No hard budget ceiling was provided',
    'Mock travel providers remain the active source in this phase',
  ]
}

function buildExplanation(input: {
  locale: 'ar' | 'en'
  optimizationSummary: string
  scoresConfidence: number
  assumptions: string[]
  tradeOffs: string[]
  matchedPreferences: string[]
  unmatchedPreferences: string[]
}): Itinerary['explanation'] {
  return {
    confidence: Number(clamp(input.scoresConfidence, 0, 1).toFixed(4)),
    optimizationSummary: input.optimizationSummary,
    assumptions: input.assumptions,
    tradeOffs: input.tradeOffs,
    matchedPreferences: [...input.matchedPreferences].sort(),
    unmatchedPreferences: [...input.unmatchedPreferences].sort(),
  }
}

function uniqueDestinations(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))]
}

function stripPrefPrefix(value: string): string {
  return value.includes(':') ? value.split(':').slice(1).join(':') : value
}

function capitalize(value: string): string {
  return value ? value[0]!.toUpperCase() + value.slice(1) : value
}

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0)))
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function createItineraryEngine(): ItineraryEngine {
  return new ItineraryEngine()
}
