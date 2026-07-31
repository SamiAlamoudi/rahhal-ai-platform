/**
 * Build selectable booking options from provider search tool results / trip plan.
 * Never fabricate prices — only map provider-backed rows.
 */

import type { AgentProviderMeta, FlightRecommendation, TripPlan } from './types'
import type { AgentToolResult } from './tools/types'

export type BookingOptionCard = NonNullable<AgentProviderMeta['bookingOptions']>[number]

/** Never surface mock / internal provider ids in traveler UI. */
export function displayProviderLabel(provider: string | null | undefined): string | null {
  if (!provider) return null
  const p = provider.trim()
  if (!p) return null
  if (/^mock/i.test(p) || /^booking_com_mock/i.test(p) || p === 'search' || p === 'simulated') {
    return null
  }
  return p
}

/** Traveler-facing copy — never show literal 0 / fake totals. */
export function formatBookingOptionPrice(
  price: number | null | undefined,
  currency: string | null | undefined,
  locale: 'ar' | 'en',
): string | null {
  if (price == null || !Number.isFinite(price) || !(price > 0)) {
    return locale === 'ar' ? 'السعر غير متوفر' : 'Price unavailable'
  }
  const cur = (currency || 'SAR').trim() || 'SAR'
  const formatted = price.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')
  return `${formatted} ${cur}`
}

/** Strip leftover mock branding from supplier-facing names. */
export function sanitizeTravelerFacingLabel(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/\bMock\s*Hotel\b/gi, 'City Hotel')
    .replace(/\bMockAir\b/gi, 'Saudia')
    .replace(/\bMOCK\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Resolve a card click / "select flight|hotel <id>" turn against prior options.
 * Returns null when the utterance is not a selection.
 */
export function matchBookingOptionSelection(
  text: string,
  options: BookingOptionCard[] | null | undefined,
): BookingOptionCard | null {
  if (!options?.length) return null
  const raw = (text || '').trim()
  if (!raw) return null

  const idMatch = raw.match(/select\s+(flight|hotel)\s+(\S+)/i)
    || raw.match(/أختار\s+(?:رحلة|فندق)?\s*[·•-]?\s*(\S+)/i)
  if (idMatch) {
    const maybeKind = idMatch[1]?.toLowerCase()
    const id = (idMatch[2] || idMatch[1] || '').trim()
    if (id && (maybeKind === 'flight' || maybeKind === 'hotel')) {
      const hit = options.find((o) => o.id === id && o.kind === maybeKind)
      if (hit) return hit
    }
    const byId = options.find((o) => o.id === id)
    if (byId) return byId
  }

  const lower = raw.toLowerCase()
  for (const option of options) {
    if (option.id && lower.includes(option.id.toLowerCase())) return option
  }
  for (const option of options) {
    if (option.kind === 'flight' && option.airline) {
      const airline = option.airline.toLowerCase()
      if (airline.length >= 3 && lower.includes(airline)) return option
    }
    if (option.kind === 'hotel' && option.hotelName) {
      const name = option.hotelName.toLowerCase()
      if (name.length >= 4 && lower.includes(name)) return option
    }
  }
  return null
}

export function bookingOptionSelectionLabel(card: BookingOptionCard): string {
  if (card.kind === 'flight') {
    const airline = sanitizeTravelerFacingLabel(card.airline) || 'Flight'
    return `${airline} ${card.from || ''}→${card.to || ''}`.trim()
  }
  return sanitizeTravelerFacingLabel(card.hotelName) || card.id
}

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
    const airline = sanitizeTravelerFacingLabel(f.airline)
    if (!airline) continue
    out.push({
      id: f.id || `flight-${f.from}-${f.to}-${f.departureTime || out.length}`,
      kind: 'flight',
      airline,
      from: f.from,
      to: destinationLabel || f.to,
      departureTime: f.departureTime ?? null,
      arrivalTime: f.arrivalTime ?? null,
      stops: f.stops,
      durationMinutes: f.durationMinutes ?? null,
      cabin: f.cabin ?? null,
      price: f.estimatedCost,
      currency: f.currency,
      provider: displayProviderLabel(f.provider ?? null),
      selectable: true,
    })
  }

  const hotels = (plan.accommodations ?? []).filter((h) => h.fromProvider === true)
  for (const h of hotels.slice(0, hotelLimit)) {
    // Never show a zero / missing nightly as a real price.
    if (h.estimatedNightly == null || !(h.estimatedNightly > 0) || !h.name) continue
    const hotelName = sanitizeTravelerFacingLabel(h.name)
    if (!hotelName) continue
    out.push({
      id: `hotel-${hotelName}-${out.length}`,
      kind: 'hotel',
      hotelName,
      area: h.area,
      price: h.estimatedNightly,
      currency: h.currency,
      provider: displayProviderLabel(h.provider ?? null),
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
