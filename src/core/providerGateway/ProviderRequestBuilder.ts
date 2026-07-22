/**
 * Sprint 104 — unified gateway request → TravelProvider request builders.
 */

import type {
  FlightSearchRequest,
  HotelSearchRequest,
  PackageSearchRequest,
} from '../providers'
import type { GatewayRequest } from './types'

export type BuiltProviderRequest =
  | { kind: 'flights'; request: FlightSearchRequest }
  | { kind: 'hotels'; request: HotelSearchRequest }
  | { kind: 'packages'; request: PackageSearchRequest }

export function buildGatewayFlightRequest(
  request: GatewayRequest,
): FlightSearchRequest | null {
  const flight = request.flight
  if (!flight?.origin?.trim() || !flight.destination?.trim() || !flight.departureDate?.trim()) {
    return null
  }
  return {
    origin: flight.origin.trim().toUpperCase(),
    destination: flight.destination.trim().toUpperCase(),
    departureDate: flight.departureDate.trim(),
    returnDate: flight.returnDate ?? null,
    adults: flight.adults ?? 1,
    children: flight.children,
    cabin: flight.cabin ?? null,
    currency: flight.currency ?? 'SAR',
    maxResults: flight.maxResults,
    nonStop: flight.nonStop,
    signal: request.signal,
  }
}

export function buildGatewayHotelRequest(
  request: GatewayRequest,
): HotelSearchRequest | null {
  const hotel = request.hotel
  if (!hotel?.destination?.trim() || !hotel.checkIn?.trim()) return null
  return {
    destination: hotel.destination.trim(),
    checkIn: hotel.checkIn.trim(),
    checkOut: hotel.checkOut ?? null,
    adults: hotel.adults ?? 1,
    children: hotel.children,
    rooms: hotel.rooms,
    currency: hotel.currency ?? 'SAR',
    maxResults: hotel.maxResults,
    signal: request.signal,
  }
}

export function buildGatewayPackageRequest(
  request: GatewayRequest,
): PackageSearchRequest | null {
  const pkg = request.package
  if (!pkg?.destination?.trim()) return null
  return {
    origin: pkg.origin ?? undefined,
    destination: pkg.destination.trim(),
    departureDate: pkg.departureDate,
    checkIn: pkg.checkIn,
    checkOut: pkg.checkOut ?? null,
    adults: pkg.adults ?? 1,
    currency: pkg.currency ?? 'SAR',
    signal: request.signal,
  }
}

/** Map a gateway operation to the TravelProvider request shape. */
export function buildProviderRequest(
  request: GatewayRequest,
): BuiltProviderRequest | null {
  if (request.operation === 'search_flights') {
    const flight = buildGatewayFlightRequest(request)
    return flight ? { kind: 'flights', request: flight } : null
  }
  if (request.operation === 'search_hotels') {
    const hotel = buildGatewayHotelRequest(request)
    return hotel ? { kind: 'hotels', request: hotel } : null
  }
  if (request.operation === 'search_packages') {
    const pkg = buildGatewayPackageRequest(request)
    return pkg ? { kind: 'packages', request: pkg } : null
  }
  return null
}
