/**
 * Wrap existing integration adapters (Amadeus, Booking, RentalCars, Mocks)
 * into MultiProviderAdapter slots for the priority chain.
 * Sprint 30: Expedia / Hotelbeds use hotel foundation sandbox adapters.
 */

import type { ProviderRequest } from '../../../utils/contracts/providers/base'
import type { FlightOffer } from '../../../utils/contracts/models/flight'
import type { HotelOffer } from '../../../utils/contracts/models/hotel'
import type { Vehicle } from '../../../utils/contracts/models/rentalCar'
import type { ActivityOffer } from '../../../utils/contracts/models/activity'
import type { TransferOffer } from '../../../utils/contracts/models/transfer'
import { MockFlightAdapter } from '../../adapters/MockFlightAdapter'
import { MockHotelAdapter } from '../../adapters/MockHotelAdapter'
import { MockRentalCarAdapter } from '../../adapters/MockRentalCarAdapter'
import { MockActivityAdapter } from '../../adapters/MockActivityAdapter'
import { MockTransferAdapter } from '../../adapters/MockTransferAdapter'
import { getProviderRegistry } from '../../registry'
import { getIntegrationConfig } from '../../config'
import { classifyProviderError, classifyThrown } from '../classifyError'
import type { MultiProviderAdapter, TravelDomain } from '../types'
import {
  createExpediaRapidAdapter,
  createHotelbedsAdapter,
  toContractHotelOffers,
  type HotelSearchRequest,
} from '../../../lib/hotels'

function asProviderRequest(req: unknown): ProviderRequest {
  if (req && typeof req === 'object' && 'search' in (req as object)) {
    return req as ProviderRequest
  }
  return { search: req as ProviderRequest['search'] }
}

export function createAmadeusEnterpriseFlightAdapter(): MultiProviderAdapter<FlightOffer[]> {
  return {
    id: 'amadeus_enterprise',
    displayName: 'Amadeus Enterprise',
    domains: ['flight'],
    mocked: false,
    prepared: true,

    isConfigured(): boolean {
      const cfg = getIntegrationConfig()
      const relative = Boolean(cfg.flight.tokenUrl?.startsWith('/'))
      return Boolean(
        cfg.flight.adapter === 'amadeus'
        && cfg.flight.tokenUrl
        && (relative || cfg.flight.invokeApiKey),
      )
    },

    async search(domain, req) {
      const start = Date.now()
      if (domain !== 'flight') {
        return {
          success: false,
          data: null,
          latencyMs: 0,
          reason: 'unavailable',
          errorCode: 'DOMAIN_UNSUPPORTED',
        }
      }
      if (!this.isConfigured()) {
        // Still try registry — tests / env may register Amadeus without adapter flag match.
        const registry = getProviderRegistry()
        const provider = registry.getFlight()
        if (!provider || provider.metadata.id.startsWith('mock')) {
          return {
            success: false,
            data: null,
            latencyMs: Date.now() - start,
            reason: 'not_configured',
            errorCode: 'AMADEUS_NOT_CONFIGURED',
            errorMessage: 'Amadeus Enterprise token proxy is not configured',
          }
        }
      }

      try {
        const registry = getProviderRegistry()
        let provider = registry.getFlight()
        // Force Amadeus path when registered; otherwise not configured.
        if (!provider || provider.metadata.id.startsWith('mock')) {
          return {
            success: false,
            data: null,
            latencyMs: Date.now() - start,
            reason: 'not_configured',
            errorCode: 'AMADEUS_NOT_REGISTERED',
          }
        }

        const result = await provider.searchFlights(asProviderRequest(req))
        if (result.success && result.data && result.data.length > 0) {
          return {
            success: true,
            data: result.data,
            latencyMs: result.latency || Date.now() - start,
            quotaStatus: 'ok',
          }
        }
        const err = result.errors[0]
        return {
          success: false,
          data: null,
          latencyMs: result.latency || Date.now() - start,
          reason: err ? classifyProviderError(err) : 'empty',
          errorCode: err?.code ?? 'AMADEUS_EMPTY',
          errorMessage: err?.message ?? 'No flight offers',
        }
      } catch (err) {
        return {
          success: false,
          data: null,
          latencyMs: Date.now() - start,
          reason: classifyThrown(err),
          errorCode: 'AMADEUS_EXCEPTION',
          errorMessage: err instanceof Error ? err.message : 'Amadeus threw',
        }
      }
    },
  }
}

export function createBookingHotelAdapter(): MultiProviderAdapter<HotelOffer[]> {
  return {
    id: 'booking',
    displayName: 'Booking.com',
    domains: ['hotel'],
    mocked: false,
    prepared: true,

    isConfigured(): boolean {
      const cfg = getIntegrationConfig()
      return cfg.hotel.adapter === 'booking' && Boolean(cfg.hotel.apiKey)
    },

    async search(domain, req) {
      const start = Date.now()
      if (domain !== 'hotel') {
        return { success: false, data: null, latencyMs: 0, reason: 'unavailable', errorCode: 'DOMAIN_UNSUPPORTED' }
      }
      try {
        const provider = getProviderRegistry().getHotel()
        if (!provider || provider.metadata.id.startsWith('mock')) {
          return {
            success: false,
            data: null,
            latencyMs: Date.now() - start,
            reason: 'not_configured',
            errorCode: 'BOOKING_NOT_CONFIGURED',
          }
        }
        const result = await provider.searchHotels(asProviderRequest(req))
        if (result.success && result.data && result.data.length > 0) {
          return { success: true, data: result.data, latencyMs: result.latency || Date.now() - start, quotaStatus: 'ok' }
        }
        const err = result.errors[0]
        return {
          success: false,
          data: null,
          latencyMs: result.latency || Date.now() - start,
          reason: err ? classifyProviderError(err) : 'empty',
          errorCode: err?.code ?? 'BOOKING_EMPTY',
          errorMessage: err?.message,
        }
      } catch (err) {
        return {
          success: false,
          data: null,
          latencyMs: Date.now() - start,
          reason: classifyThrown(err),
          errorCode: 'BOOKING_EXCEPTION',
          errorMessage: err instanceof Error ? err.message : 'Booking threw',
        }
      }
    },
  }
}

/** Sprint 30 — Expedia Rapid sandbox hotel adapter (no production credentials). */
export function createExpediaHotelAdapter(): MultiProviderAdapter<HotelOffer[]> {
  return createFoundationHotelMultiAdapter({
    id: 'expedia',
    displayName: 'Expedia Rapid',
    createProvider: () => createExpediaRapidAdapter(),
  })
}

/** Sprint 30 — Hotelbeds sandbox hotel adapter (no production credentials). */
export function createHotelbedsHotelAdapter(): MultiProviderAdapter<HotelOffer[]> {
  return createFoundationHotelMultiAdapter({
    id: 'hotelbeds',
    displayName: 'Hotelbeds',
    createProvider: () => createHotelbedsAdapter(),
  })
}

function createFoundationHotelMultiAdapter(options: {
  id: 'expedia' | 'hotelbeds'
  displayName: string
  createProvider: () => ReturnType<typeof createExpediaRapidAdapter>
}): MultiProviderAdapter<HotelOffer[]> {
  const provider = options.createProvider()
  return {
    id: options.id,
    displayName: options.displayName,
    domains: ['hotel'],
    mocked: true,
    prepared: true,

    isConfigured(): boolean {
      return provider.isAvailable()
    },

    async search(domain, req) {
      const start = Date.now()
      if (domain !== 'hotel') {
        return { success: false, data: null, latencyMs: 0, reason: 'unavailable', errorCode: 'DOMAIN_UNSUPPORTED' }
      }
      try {
        const searchReq = providerRequestToHotelSearch(asProviderRequest(req))
        const result = await provider.searchHotels(searchReq)
        if (result.success && result.data && result.data.length > 0) {
          return {
            success: true,
            data: toContractHotelOffers(result.data),
            latencyMs: result.latencyMs || Date.now() - start,
            quotaStatus: 'ok',
          }
        }
        return {
          success: false,
          data: null,
          latencyMs: result.latencyMs || Date.now() - start,
          reason: 'empty',
          errorCode: result.errors[0]?.code?.toUpperCase() ?? 'HOTEL_EMPTY',
          errorMessage: result.errors[0]?.message,
        }
      } catch (err) {
        return {
          success: false,
          data: null,
          latencyMs: Date.now() - start,
          reason: classifyThrown(err),
          errorCode: 'HOTEL_FOUNDATION_EXCEPTION',
          errorMessage: err instanceof Error ? err.message : `${options.displayName} threw`,
        }
      }
    },
  }
}

function providerRequestToHotelSearch(req: ProviderRequest): HotelSearchRequest {
  const search = req.search
  const destination = String(
    (search as { destination?: string }).destination
    ?? (search as { to?: string }).to
    ?? 'City',
  )
  const checkIn = String(
    (search as { checkIn?: string }).checkIn
    ?? (search as { startDate?: string }).startDate
    ?? '',
  )
  const checkOut = String(
    (search as { checkOut?: string }).checkOut
    ?? (search as { endDate?: string }).endDate
    ?? '',
  )
  const adults = Number(
    (search as { adults?: number }).adults
    ?? (search as { travelers?: number }).travelers
    ?? 2,
  )
  return {
    destination,
    checkIn: checkIn || new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    checkOut: checkOut || new Date(Date.now() + 17 * 86_400_000).toISOString().slice(0, 10),
    adults: Number.isFinite(adults) && adults > 0 ? adults : 2,
    children: Number((search as { children?: number }).children ?? 0) || undefined,
    currency: String((search as { currency?: string }).currency ?? 'SAR'),
  }
}

export function createRentalCarsAdapter(): MultiProviderAdapter<Vehicle[]> {
  return {
    id: 'rentalcars',
    displayName: 'RentalCars',
    domains: ['cars'],
    mocked: false,
    prepared: true,

    isConfigured(): boolean {
      const cfg = getIntegrationConfig()
      return cfg.rentalCar.adapter === 'rentalcars' && Boolean(cfg.rentalCar.apiKey)
    },

    async search(domain, req) {
      const start = Date.now()
      if (domain !== 'cars') {
        return { success: false, data: null, latencyMs: 0, reason: 'unavailable', errorCode: 'DOMAIN_UNSUPPORTED' }
      }
      try {
        const provider = getProviderRegistry().getRentalCar()
        if (!provider || provider.metadata.id.startsWith('mock')) {
          return {
            success: false,
            data: null,
            latencyMs: Date.now() - start,
            reason: 'not_configured',
            errorCode: 'RENTALCARS_NOT_CONFIGURED',
          }
        }
        const result = await provider.searchRentalCars(asProviderRequest(req))
        if (result.success && result.data && result.data.length > 0) {
          return { success: true, data: result.data, latencyMs: result.latency || Date.now() - start, quotaStatus: 'ok' }
        }
        const err = result.errors[0]
        return {
          success: false,
          data: null,
          latencyMs: result.latency || Date.now() - start,
          reason: err ? classifyProviderError(err) : 'empty',
          errorCode: err?.code ?? 'RENTALCARS_EMPTY',
          errorMessage: err?.message,
        }
      } catch (err) {
        return {
          success: false,
          data: null,
          latencyMs: Date.now() - start,
          reason: classifyThrown(err),
          errorCode: 'RENTALCARS_EXCEPTION',
          errorMessage: err instanceof Error ? err.message : 'RentalCars threw',
        }
      }
    },
  }
}

export function createMockDomainAdapter(domain: TravelDomain): MultiProviderAdapter {
  return {
    id: 'mock',
    displayName: 'Mock Provider',
    domains: [domain],
    mocked: true,
    prepared: false,

    isConfigured(): boolean {
      return true
    },

    async search(searchDomain, req) {
      const start = Date.now()
      const providerReq = asProviderRequest(req)

      if (searchDomain === 'flight') {
        const result = await new MockFlightAdapter().searchFlights(providerReq)
        return {
          success: result.success && Boolean(result.data?.length),
          data: result.data,
          latencyMs: result.latency || Date.now() - start,
        }
      }
      if (searchDomain === 'hotel') {
        const result = await new MockHotelAdapter().searchHotels(providerReq)
        return {
          success: result.success && Boolean(result.data?.length),
          data: result.data,
          latencyMs: result.latency || Date.now() - start,
        }
      }
      if (searchDomain === 'cars') {
        const result = await new MockRentalCarAdapter().searchRentalCars(providerReq)
        return {
          success: result.success && Boolean(result.data?.length),
          data: result.data,
          latencyMs: result.latency || Date.now() - start,
        }
      }
      if (searchDomain === 'activities') {
        const result = await new MockActivityAdapter().searchActivities(providerReq)
        return {
          success: result.success && Boolean(result.data?.length),
          data: result.data as ActivityOffer[] | null,
          latencyMs: result.latency || Date.now() - start,
        }
      }
      if (searchDomain === 'transfers') {
        const result = await new MockTransferAdapter().searchTransfers(providerReq)
        return {
          success: result.success && Boolean(result.data?.length),
          data: result.data as TransferOffer[] | null,
          latencyMs: result.latency || Date.now() - start,
        }
      }
      return {
        success: false,
        data: null,
        latencyMs: Date.now() - start,
        reason: 'unavailable',
        errorCode: 'DOMAIN_UNSUPPORTED',
      }
    },
  }
}
