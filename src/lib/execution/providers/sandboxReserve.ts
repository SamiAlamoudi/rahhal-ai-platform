/**
 * Sprint 33 — Reservation ports (sandbox).
 * Orchestrates via provider IDs from Flight/Hotel foundations — no embedded supplier logic.
 */

import type { UnifiedFlightLeg, UnifiedHotelStay } from '../../brain/unifiedTravel/types'
import { BookingReferenceGenerator } from '../BookingReferenceGenerator'
import type { ProviderReservationResult } from '../ExecutionTypes'

export interface FlightReservationRequest {
  flight: UnifiedFlightLeg
  adults: number
  currency: string
  signal?: AbortSignal
}

export interface HotelReservationRequest {
  hotel: UnifiedHotelStay
  adults: number
  children: number
  currency: string
  signal?: AbortSignal
}

export interface FlightReservationPort {
  reserve(req: FlightReservationRequest): Promise<ProviderReservationResult>
  cancel?(confirmationNumber: string, providerId: string): Promise<{ success: boolean; latencyMs: number }>
}

export interface HotelReservationPort {
  reserve(req: HotelReservationRequest): Promise<ProviderReservationResult>
  cancel?(confirmationNumber: string, providerId: string): Promise<{ success: boolean; latencyMs: number }>
}

const refs = new BookingReferenceGenerator()

/**
 * Sandbox flight reserver — uses providerId from the selected flight offer only.
 */
export function createSandboxFlightReserver(options?: {
  fail?: boolean
  delayMs?: number
}): FlightReservationPort {
  return {
    async reserve(req) {
      const started = Date.now()
      if (options?.delayMs) await sleep(options.delayMs)
      if (options?.fail) {
        return {
          success: false,
          providerId: req.flight.providerId,
          providerName: req.flight.airline,
          confirmationNumber: null,
          latencyMs: Date.now() - started,
          cancellable: false,
          errorCode: 'FLIGHT_RESERVE_FAILED',
          errorMessage: 'Sandbox flight reservation failed',
        }
      }
      return {
        success: true,
        providerId: req.flight.providerId,
        providerName: req.flight.airline,
        confirmationNumber: refs.flightConfirmation(req.flight.providerId),
        latencyMs: Date.now() - started,
        cancellable: true,
        warning: null,
      }
    },
    async cancel() {
      return { success: true, latencyMs: 1 }
    },
  }
}

/**
 * Sandbox hotel reserver — provider ids mirror Hotel Provider Foundation
 * (booking_connectivity / hotelbeds / expedia_rapid / mock_hotels).
 */
export function createSandboxHotelReserver(options?: {
  fail?: boolean
  delayMs?: number
  providerNameById?: Record<string, string>
}): HotelReservationPort {
  const names = {
    booking_connectivity: 'Booking.com Connectivity',
    hotelbeds: 'Hotelbeds',
    expedia_rapid: 'Expedia Rapid',
    mock_hotels: 'Mock Hotels',
    ...options?.providerNameById,
  }
  return {
    async reserve(req) {
      const started = Date.now()
      if (options?.delayMs) await sleep(options.delayMs)
      const providerId = String(req.hotel.providerId)
      if (options?.fail) {
        return {
          success: false,
          providerId,
          providerName: names[providerId as keyof typeof names] ?? providerId,
          confirmationNumber: null,
          latencyMs: Date.now() - started,
          cancellable: false,
          errorCode: 'HOTEL_RESERVE_FAILED',
          errorMessage: 'Sandbox hotel reservation failed',
        }
      }
      return {
        success: true,
        providerId,
        providerName: names[providerId as keyof typeof names] ?? req.hotel.name,
        confirmationNumber: refs.hotelConfirmation(providerId),
        latencyMs: Date.now() - started,
        cancellable: true,
        warning: req.hotel.freeCancellation ? null : 'Non-refundable rate',
      }
    },
    async cancel() {
      return { success: true, latencyMs: 1 }
    },
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
