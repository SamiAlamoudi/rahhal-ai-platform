import type {
  AccommodationRecommendation,
  AttractionItem,
  FlightRecommendation,
  ItineraryDay,
  TransportationItem,
  TripPlan,
} from '../types'
import type { AgentToolResult } from './types'

/**
 * Merge successful tool outputs into a TripPlan without vendor-specific logic.
 */
export function mergeToolResultsIntoPlan(
  plan: TripPlan,
  results: AgentToolResult[],
): TripPlan {
  let next: TripPlan = {
    ...plan,
    transportation: [...plan.transportation],
    accommodations: [...plan.accommodations],
    flights: [...(plan.flights ?? [])],
    attractions: [...(plan.attractions ?? [])],
    weatherNotes: [...(plan.weatherNotes ?? [])],
    visaNotes: [...(plan.visaNotes ?? [])],
    travelTips: [...(plan.travelTips ?? [])],
    packingSuggestions: [...(plan.packingSuggestions ?? [])],
    notes: [...plan.notes],
    dailyItinerary: plan.dailyItinerary.map((day) => ({
      ...day,
      activities: [...day.activities],
    })),
    estimatedBudget: {
      ...plan.estimatedBudget,
      breakdown: [...plan.estimatedBudget.breakdown],
    },
    summary: plan.summary ?? plan.title,
  }
  next.activities = next.dailyItinerary
  next.estimatedCosts = next.estimatedBudget

  const ok = results.filter((r) => r.status === 'ok')
  for (const result of ok) {
    switch (result.tool) {
      case 'flights':
        next = mergeFlights(next, result)
        break
      case 'hotels':
        next = mergeHotels(next, result)
        break
      case 'weather':
        next = mergeWeather(next, result)
        break
      case 'maps':
        next = mergeMaps(next, result)
        break
      case 'currency':
        next = mergeCurrency(next, result)
        break
      case 'visa':
        next = mergeVisa(next, result)
        break
      case 'attractions':
      case 'local_recommendations':
        next = mergeAttractions(next, result)
        break
      case 'transportation':
        next = mergeTransportation(next, result)
        break
      default:
        break
    }
  }

  const failures = results.filter((r) => r.status === 'error' || r.status === 'timeout')
  for (const failure of failures) {
    next.notes.push(`Tool ${failure.tool}: ${failure.summary}`)
  }

  if (ok.length > 0) {
    next.notes.push(
      next.locale === 'ar'
        ? `تم دمج ${ok.length} نتائج أدوات تجريبية في الخطة.`
        : `Merged ${ok.length} mock tool results into this plan.`,
    )
  }

  next.updatedAt = new Date().toISOString()
  next.activities = next.dailyItinerary
  next.estimatedCosts = next.estimatedBudget
  return next
}

function mergeFlights(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as { offers?: Array<Record<string, unknown>> } | undefined
  const offer = data?.offers?.[0]
  if (!offer) return plan
  const item: TransportationItem = {
    mode: 'flight',
    from: String(offer.from ?? 'Origin'),
    to: String(offer.to ?? plan.destinations[0] ?? 'Destination'),
    notes: `${String(offer.airline ?? 'Airline')} · ${offer.stops ?? 0} stops · mock`,
    estimatedCost: typeof offer.price === 'number' ? offer.price : null,
    currency: typeof offer.currency === 'string' ? offer.currency : plan.estimatedBudget.currency,
  }
  const flight: FlightRecommendation = {
    from: item.from,
    to: item.to,
    airline: typeof offer.airline === 'string' ? offer.airline : null,
    stops: typeof offer.stops === 'number' ? offer.stops : null,
    estimatedCost: item.estimatedCost,
    currency: item.currency,
    notes: item.notes,
  }
  const transportation = [
    item,
    ...plan.transportation.filter((row) => row.mode !== 'flight'),
  ]
  let estimatedBudget = plan.estimatedBudget
  if (item.estimatedCost != null) {
    estimatedBudget = {
      ...estimatedBudget,
      amount: estimatedBudget.amount + item.estimatedCost,
      breakdown: [
        ...estimatedBudget.breakdown.filter((b) => b.label !== 'flights'),
        { label: 'flights', amount: item.estimatedCost },
      ],
    }
  }
  return {
    ...plan,
    transportation,
    flights: [flight, ...plan.flights.filter((f) => f.from !== flight.from || f.to !== flight.to)],
    estimatedBudget,
    estimatedCosts: estimatedBudget,
  }
}

function mergeHotels(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as {
    stays?: Array<{
      name: string
      area: string
      category: AccommodationRecommendation['category']
      nightly: number
      currency: string
    }>
  } | undefined
  if (!data?.stays?.length) return plan
  const accommodations: AccommodationRecommendation[] = data.stays.map((stay) => ({
    name: stay.name,
    area: stay.area,
    category: stay.category,
    fit: 'From hotel search tool (mock)',
    estimatedNightly: stay.nightly,
    currency: stay.currency,
  }))
  return { ...plan, accommodations }
}

function mergeWeather(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as { summary?: string; averageHighC?: number; season?: string } | undefined
  if (!data?.summary) return plan
  const note = plan.locale === 'ar'
    ? `الطقس: ${data.summary}${data.season ? ` · ${data.season}` : ''}`
    : `Weather: ${data.summary}${data.season ? ` · ${data.season}` : ''}`
  return {
    ...plan,
    weatherNotes: [...plan.weatherNotes.filter((n) => !/Weather:|الطقس:/.test(n)), note],
    notes: [...plan.notes, note],
  }
}

function mergeMaps(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as {
    legs?: Array<{ from: string; to: string; mode: string; distanceKm: number; durationMinutes: number }>
  } | undefined
  if (!data?.legs?.length) return plan
  const extra: TransportationItem[] = data.legs.map((leg) => ({
    mode: leg.mode,
    from: leg.from,
    to: leg.to,
    notes: `${leg.distanceKm} km · ~${leg.durationMinutes} min (mock maps)`,
    estimatedCost: null,
    currency: plan.estimatedBudget.currency,
  }))
  return {
    ...plan,
    transportation: [...plan.transportation, ...extra],
  }
}

function mergeCurrency(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as {
    amount?: number
    fromCurrency?: string
    toCurrency?: string
    convertedAmount?: number
    rate?: number
  } | undefined
  if (!data?.convertedAmount || !data.toCurrency) return plan
  return {
    ...plan,
    notes: [
      ...plan.notes,
      `Budget ${data.amount} ${data.fromCurrency} ≈ ${data.convertedAmount} ${data.toCurrency} (rate ${data.rate})`,
    ],
  }
}

function mergeVisa(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as { guidance?: string } | undefined
  if (!data?.guidance) return plan
  return {
    ...plan,
    visaNotes: [...plan.visaNotes.filter((n) => n !== data.guidance), data.guidance],
    notes: [...plan.notes, data.guidance],
  }
}

function mergeAttractions(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as {
    attractions?: Array<{ title: string; tag?: string }>
  } | undefined
  if (!data?.attractions?.length) return plan

  const attractions: AttractionItem[] = data.attractions.map((row, index) => ({
    title: row.title,
    tag: row.tag ?? null,
    dayHint: (index % Math.max(1, plan.durationDays)) + 1,
  }))

  const dailyItinerary: ItineraryDay[] = plan.dailyItinerary.map((day, index) => {
    const attraction = data.attractions![index % data.attractions!.length]
    const activity = {
      time: '15:30',
      title: attraction.title,
      description: attraction.tag
        ? `Attraction tool · ${attraction.tag}`
        : 'Attraction tool recommendation',
    }
    return {
      ...day,
      activities: [...day.activities, activity],
    }
  })

  return {
    ...plan,
    attractions,
    dailyItinerary,
    activities: dailyItinerary,
  }
}

function mergeTransportation(plan: TripPlan, result: AgentToolResult): TripPlan {
  const data = result.data as {
    options?: Array<{
      mode?: string
      from?: string
      to?: string
      notes?: string
      estimatedCost?: number | null
      currency?: string | null
    }>
  } | undefined
  if (!data?.options?.length) return plan

  const extra: TransportationItem[] = data.options.map((option) => ({
    mode: String(option.mode ?? 'transfer'),
    from: String(option.from ?? plan.destinations[0] ?? 'Origin'),
    to: String(option.to ?? plan.destinations[0] ?? 'Destination'),
    notes: option.notes ?? 'From transportation provider adapter (mock)',
    estimatedCost: typeof option.estimatedCost === 'number' ? option.estimatedCost : null,
    currency: option.currency ?? plan.estimatedBudget.currency,
  }))

  return {
    ...plan,
    transportation: [
      ...plan.transportation,
      ...extra.filter((row) => row.mode !== 'flight'),
    ],
  }
}
