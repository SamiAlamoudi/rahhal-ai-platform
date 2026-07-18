/**
 * Wrap existing integration adapters (Amadeus, Booking, RentalCars, Mocks)
 * into MultiProviderAdapter slots for the priority chain.
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
