/**
 * Integration Sprint 2 — map conversation tool context → live/engine flight criteria.
 */

import type { LiveFlightSearchCriteria } from '../liveFlightSearch'
import type { FlightCabinClass, FlightSearchRequest } from '../flightSearchEngine'
import type { TripRequirements } from '../types'
import type { AgentToolContext } from '../tools/types'
import { resolveAirportCode } from '../airportCodes'
import { normalizeCalendarDate, normalizeTravelerTimezone } from './timezone'
import type { DepartureTimeWindow } from './types'

function defaultDepartureDate(): string {
  return normalizeCalendarDate(null, 7)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return defaultDepartureDate()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function adultsFromContext(ctx: AgentToolContext): number | null {
  const fromInput = Number(ctx.input?.adults ?? ctx.input?.travelers)
  if (Number.isFinite(fromInput) && fromInput > 0) return Math.floor(fromInput)
  const children = childrenFromContext(ctx)
  const total = ctx.requirements.travelers
  if (typeof total === 'number' && total > 0) {
    return Math.max(1, Math.floor(total) - children)
  }
  // Never invent adults from couple/family heuristics.
  return null
}

export function childrenFromContext(ctx: AgentToolContext): number {
  const fromInput = Number(ctx.input?.children)
  if (Number.isFinite(fromInput) && fromInput >= 0) return Math.floor(fromInput)
  const fromReq = ctx.requirements.children
  if (typeof fromReq === 'number' && fromReq >= 0) return Math.floor(fromReq)
  return 0
}

export function cabinFromRequirements(req: TripRequirements): FlightCabinClass {
  const explicit = (req.cabinPreference ?? '').toLowerCase()
  if (explicit.includes('first')) return 'first'
  if (explicit.includes('business') || explicit.includes('رجال')) return 'business'
  if (explicit.includes('premium')) return 'premium_economy'
  if (explicit.includes('economy') || explicit.includes('سياح')) return 'economy'
  const purpose = (req.tripPurpose ?? '').toLowerCase()
  const style = (req.budgetStyle ?? '').toLowerCase()
  if (req.travelerType === 'business' || purpose.includes('business')) return 'business'
  if (style === 'luxury' || purpose.includes('honeymoon')) return 'premium_economy'
  return 'economy'
}

export function preferredAirlineFromContext(ctx: AgentToolContext): string | null {
  const fromInput = ctx.input?.preferredAirline ?? ctx.input?.airline
  if (typeof fromInput === 'string' && fromInput.trim()) return fromInput.trim()
  return ctx.requirements.preferredAirline ?? null
}

export function preferredDepartureFromContext(ctx: AgentToolContext): DepartureTimeWindow | null {
  const fromInput = ctx.input?.preferredDepartureTime
  if (
    fromInput === 'morning'
    || fromInput === 'afternoon'
    || fromInput === 'evening'
    || fromInput === 'night'
  ) {
    return fromInput
  }
  return ctx.requirements.preferredDepartureTime ?? null
}

export function buildLiveCriteriaFromContext(ctx: AgentToolContext): LiveFlightSearchCriteria {
  const req = ctx.requirements
  const originRaw = String(ctx.input?.origin ?? req.origin ?? 'Riyadh')
  const destinationRaw = String(ctx.input?.destination ?? req.destination ?? req.destinations[0] ?? '')
  const departureDate = normalizeCalendarDate(
    String(ctx.input?.startDate ?? req.startDate ?? defaultDepartureDate()),
  )
  const returnRaw = ctx.input?.endDate ?? req.endDate
  const returnDate = returnRaw ? normalizeCalendarDate(String(returnRaw)) : null

  const adults = adultsFromContext(ctx)
  if (adults == null) {
    throw new Error('search_blocked_travelers_unconfirmed')
  }
  return {
    origin: resolveAirportCode(originRaw),
    destination: resolveAirportCode(destinationRaw),
    departureDate,
    returnDate,
    adults,
    children: childrenFromContext(ctx),
    cabin: cabinFromRequirements(req),
    currency: String(ctx.input?.currency ?? req.budgetCurrency ?? 'SAR').toUpperCase(),
    maxResults: 20,
    nonStop: preferredDepartureFromContext(ctx) == null ? false : false,
    signal: ctx.signal,
  }
}

export function buildEngineRequestFromContext(ctx: AgentToolContext): FlightSearchRequest {
  const criteria = buildLiveCriteriaFromContext(ctx)
  const req = ctx.requirements
  const tripType =
    req.destinations.length > 1
      ? 'multi_city'
      : criteria.returnDate
        ? 'round_trip'
        : 'one_way'

  const request: FlightSearchRequest = {
    tripType,
    origin: criteria.origin,
    destination: criteria.destination,
    departureDate: criteria.departureDate,
    returnDate: tripType === 'one_way' ? null : criteria.returnDate,
    adults: criteria.adults,
    children: criteria.children,
    currency: criteria.currency,
    cabin: cabinFromRequirements(req),
    preferredAirlines: preferredAirlineFromContext(ctx)
      ? [preferredAirlineFromContext(ctx)!]
      : undefined,
    sort: 'recommendation',
    pageSize: 20,
    signal: ctx.signal,
    parallel: true,
  }

  const preferredTime = preferredDepartureFromContext(ctx)
  if (preferredTime) {
    const windows: Record<DepartureTimeWindow, { from: string; to: string }> = {
      morning: { from: '05:00', to: '12:00' },
      afternoon: { from: '12:00', to: '17:00' },
      evening: { from: '17:00', to: '21:00' },
      night: { from: '21:00', to: '05:00' },
    }
    const w = windows[preferredTime]
    request.filters = {
      ...request.filters,
      departureTimeFrom: w.from,
      departureTimeTo: w.to,
    }
  }

  if (tripType === 'multi_city' && req.destinations.length > 1) {
    const originRaw = String(ctx.input?.origin ?? req.origin ?? 'Riyadh')
    const hubs = [originRaw, ...req.destinations]
    const legs = []
    for (let i = 0; i < hubs.length - 1; i += 1) {
      legs.push({
        origin: resolveAirportCode(hubs[i]!),
        destination: resolveAirportCode(hubs[i + 1]!),
        departureDate: addDays(criteria.departureDate, i * 3),
      })
    }
    request.legs = legs
  }

  if (typeof req.budgetAmount === 'number' && req.budgetAmount > 0) {
    request.filters = {
      ...request.filters,
      maxPrice: Math.round(req.budgetAmount * (req.packageScope === 'flights_only' ? 0.9 : 0.45)),
    }
  }

  return request
}

export function timezoneFromContext(ctx: AgentToolContext): string {
  const fromInput = ctx.input?.timezone
  if (typeof fromInput === 'string') return normalizeTravelerTimezone(fromInput)
  return normalizeTravelerTimezone(ctx.requirements.travelerTimezone)
}
