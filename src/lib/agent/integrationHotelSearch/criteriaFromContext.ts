/**
 * Integration Sprint 3 — map conversation context → live/engine hotel criteria.
 */

import type { LiveHotelSearchCriteria } from '../liveHotelSearch'
import type { HotelSearchRequest } from '../hotelSearchEngine'
import type { AgentToolContext } from '../tools/types'
import { allocateBudget, hotelNightlyCap } from '../budgetIntelligence'

function defaultCheckIn(): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 14)
  return d.toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return defaultCheckIn()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function adultsFromHotelContext(ctx: AgentToolContext): number {
  const fromInput = Number(ctx.input?.adults ?? ctx.input?.travelers)
  if (Number.isFinite(fromInput) && fromInput > 0) return Math.floor(fromInput)
  const children = childrenFromHotelContext(ctx)
  const total = ctx.requirements.travelers
  if (typeof total === 'number' && total > 0) return Math.max(1, Math.floor(total) - children)
  if (ctx.requirements.travelerType === 'solo' || ctx.requirements.travelerType === 'business') return 1
  if (ctx.requirements.travelerType === 'couple') return 2
  if (ctx.requirements.travelerType === 'family') return 2
  return 2
}

export function childrenFromHotelContext(ctx: AgentToolContext): number {
  const fromInput = Number(ctx.input?.children)
  if (Number.isFinite(fromInput) && fromInput >= 0) return Math.floor(fromInput)
  if (typeof ctx.requirements.children === 'number' && ctx.requirements.children >= 0) {
    return Math.floor(ctx.requirements.children)
  }
  return 0
}

export function roomsFromHotelContext(ctx: AgentToolContext): number {
  const fromInput = Number(ctx.input?.rooms)
  if (Number.isFinite(fromInput) && fromInput > 0) return Math.floor(fromInput)
  if (typeof ctx.requirements.rooms === 'number' && ctx.requirements.rooms > 0) {
    return Math.floor(ctx.requirements.rooms)
  }
  const adults = adultsFromHotelContext(ctx)
  if (ctx.requirements.travelerType === 'family') return Math.max(1, Math.ceil(adults / 2))
  return 1
}

export function nightsFromHotelContext(ctx: AgentToolContext): number {
  const nights = Number(ctx.input?.nights)
  if (Number.isFinite(nights) && nights > 0) return Math.floor(nights)
  const duration = ctx.requirements.durationDays ?? 3
  return Math.max(1, duration - 1)
}

function parseStarClass(hotelPreference: string | null | undefined): number | null {
  if (!hotelPreference) return null
  const m = hotelPreference.match(/([1-5])_star/)
  if (m?.[1]) return Number(m[1])
  if (hotelPreference.includes('5_star')) return 5
  return null
}

export function amenityFiltersFromContext(ctx: AgentToolContext): string[] {
  const fromReq = ctx.requirements.hotelAmenities ?? []
  const fromInput = Array.isArray(ctx.input?.amenities)
    ? (ctx.input!.amenities as unknown[]).map(String)
    : []
  return [...new Set([...fromReq, ...fromInput].map((a) => a.trim().toLowerCase()).filter(Boolean))]
}

export function buildLiveHotelCriteriaFromContext(ctx: AgentToolContext): LiveHotelSearchCriteria {
  const req = ctx.requirements
  const destination = String(ctx.input?.destination ?? req.destination ?? req.destinations[0] ?? '')
  const checkIn = String(ctx.input?.checkIn ?? req.startDate ?? defaultCheckIn())
  const nights = nightsFromHotelContext(ctx)
  const checkOut = String(ctx.input?.checkOut ?? req.endDate ?? addDays(checkIn, nights))

  return {
    destination,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    adults: adultsFromHotelContext(ctx),
    children: childrenFromHotelContext(ctx),
    rooms: roomsFromHotelContext(ctx),
    currency: String(ctx.input?.currency ?? req.budgetCurrency ?? 'SAR').toUpperCase(),
    maxResults: 20,
    signal: ctx.signal,
  }
}

export function buildEngineHotelRequestFromContext(ctx: AgentToolContext): HotelSearchRequest {
  const criteria = buildLiveHotelCriteriaFromContext(ctx)
  const req = ctx.requirements
  const nights = nightsFromHotelContext(ctx)
  const style = (req.budgetStyle ?? '').toLowerCase()
  const budget = req.budgetAmount
  const amenities = amenityFiltersFromContext(ctx)
  const minStars = parseStarClass(req.hotelPreference)
  const breakfast = req.breakfastRequired === true
  const freeCancel = req.freeCancellationRequired === true

  const allocation = typeof budget === 'number' && budget > 0
    ? allocateBudget({
      total: budget,
      currency: criteria.currency ?? 'SAR',
      style: req.budgetStyle,
      nights,
      hotelsOnly: false,
      flightsOnly: req.packageScope === 'flights_only',
    })
    : null

  const request: HotelSearchRequest = {
    city: criteria.destination,
    destination: criteria.destination,
    checkIn: criteria.checkInDate,
    checkOut: criteria.checkOutDate,
    adults: criteria.adults,
    children: criteria.children,
    rooms: criteria.rooms,
    currency: criteria.currency,
    sort: 'recommended',
    pageSize: 20,
    signal: ctx.signal,
    parallel: true,
    filters: {},
  }

  if (style === 'luxury' || minStars != null) {
    request.filters = {
      ...request.filters,
      minStars: minStars ?? 4,
      minRating: style === 'luxury' ? 4 : undefined,
    }
  }
  if (allocation) {
    request.filters = {
      ...request.filters,
      maxPrice: hotelNightlyCap(allocation, nights),
    }
  } else if (style === 'budget' && typeof budget === 'number' && budget > 0) {
    request.filters = {
      ...request.filters,
      maxPrice: Math.max(80, Math.round((budget * 0.35) / nights)),
    }
  }
  if (breakfast) request.filters = { ...request.filters, breakfastIncluded: true }
  if (freeCancel) request.filters = { ...request.filters, freeCancellationOnly: true }
  if (amenities.length) request.filters = { ...request.filters, amenities }

  return request
}
