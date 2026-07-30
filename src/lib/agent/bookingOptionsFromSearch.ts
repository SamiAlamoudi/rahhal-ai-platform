/**
 * Build selectable booking options from provider search tool results / trip plan.
 * Never fabricate prices — only map provider-backed rows.
 */

import type { AgentProviderMeta, FlightRecommendation, TripPlan } from './types'
import type { AgentToolResult } from './tools/types'

export type BookingOptionCard = NonNullable<AgentProviderMeta['bookingOptions']>[number]

export function countProviderFlightOffers(toolResults: AgentToolResult[] | null | undefined): number {
  const flight = (toolResults ?? []).find((r) => r.tool === 'flights')
  if (!flight) return 0
  const offers = (flight.data as { offers?: unknown[] } | undefined)?.offers
  return Array.isArray(offers) ? offers.length : 0
}

export function countProviderHotelStays(toolResults: AgentToolResult[] | null | undefined): number {
  const hotels = (toolResults ?? []).find((r) => r.tool === 'hotels')
  if (!hotels) return 0
  const stays = (hotels.data as { stays?: unknown[] } | undefined)?.stays
  return Array.isArray(stays) ? stays.length : 0
}

export function providerFlightError(toolResults: AgentToolResult[] | null | undefined): string | null {
  const flight = (toolResults ?? []).find((r) => r.tool === 'flights')
  if (!flight) return 'flights_tool_not_run'
  if (flight.status === 'ok') {
    const n = countProviderFlightOffers([flight])
    return n > 0 ? null : 'no_results'
  }
  return flight.error || flight.summary || 'flight_search_failed'
}

/** Prefer provider-backed flights; fall back to plan.flights marked fromProvider. */
export function providerFlightsFromPlan(plan: TripPlan | null | undefined): FlightRecommendation[] {
  if (!plan?.flights?.length) return []
  const fromProvider = plan.flights.filter((f) => f.fromProvider === true)
  return fromProvider.length ? fromProvider : []
}

export function buildBookingOptionsFromPlan(
  plan: TripPlan | null | undefined,
  options?: { limitFlights?: number; limitHotels?: number },
): BookingOptionCard[] {
  if (!plan) return []
  const flightLimit = options?.limitFlights ?? 6
  const hotelLimit = options?.limitHotels ?? 3
  const out: BookingOptionCard[] = []

  const flights = providerFlightsFromPlan(plan)
  // Prefer committed destination label (e.g. لبنان) over raw IATA for display.
  const destinationLabel = plan.requirements?.destination
    || plan.destinations?.[0]
    || null
  for (const f of flights.slice(0, flightLimit)) {
    if (f.estimatedCost == null || !(f.estimatedCost > 0) || !f.airline) continue
    if (/^unknown$/i.test(f.airline)) continue
    out.push({
      id: f.id || `flight-${f.from}-${f.to}-${f.departureTime || out.length}`,
      kind: 'flight',
      airline: f.airline,
      from: f.from,
      to: destinationLabel || f.to,
      departureTime: f.departureTime ?? null,
      arrivalTime: f.arrivalTime ?? null,
      stops: f.stops,
      durationMinutes: f.durationMinutes ?? null,
      cabin: f.cabin ?? null,
      price: f.estimatedCost,
      currency: f.currency,
      provider: f.provider ?? null,
      selectable: true,
    })
  }

  const hotels = (plan.accommodations ?? []).filter((h) => h.fromProvider === true)
  for (const h of hotels.slice(0, hotelLimit)) {
    if (h.estimatedNightly == null || !h.name) continue
    out.push({
      id: `hotel-${h.name}-${out.length}`,
      kind: 'hotel',
      hotelName: h.name,
      area: h.area,
      price: h.estimatedNightly,
      currency: h.currency,
      provider: h.provider ?? null,
      selectable: true,
    })
  }

  return out
}

export function formatDuration(minutes: number | null | undefined, locale: 'ar' | 'en'): string {
  if (minutes == null || !Number.isFinite(minutes)) return locale === 'ar' ? '—' : '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (locale === 'ar') return `${h}س ${m}د`
  return `${h}h ${m}m`
}

export function formatClock(iso: string | null | undefined, locale: 'ar' | 'en'): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  try {
    return new Date(t).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
