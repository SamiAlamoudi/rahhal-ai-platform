import { getProviderRegistry } from '../registry'
import { getIntegrationConfig } from '../config'
import type { AmadeusFlightAdapter } from '../providers/amadeus/amadeusFlightAdapter'
import type { BookingComAdapter } from '../providers/booking/bookingComAdapter'
import type { RentalCarsComAdapter } from '../providers/rentalcars/rentalCarsComAdapter'

export interface ProviderHealth {
  providerId: string
  providerName: string
  domain: string
  connected: boolean
  enabled: boolean
  healthy: boolean
  lastCheck: string
  adapter: string
  mode: 'mock' | 'real'
  apiReachable: boolean
  lastResponseTime: number | null
  lastError: string | null
  oauthStatus: 'none' | 'valid' | 'expired' | 'not-configured'
  tokenRemainingLifetime: number | null
  lastResponseCount: number | null
  lastRequestAt: string | null
}

export interface ProviderHealthService {
  checkAll(): ProviderHealth[]
  checkByDomain(domain: string): ProviderHealth | null
}

function assessHealth(adapter: string): {
  connected: boolean
  healthy: boolean
  apiReachable: boolean
  lastResponseTime: number | null
  lastError: string | null
} {
  if (adapter === 'mock') {
    return { connected: true, healthy: true, apiReachable: true, lastResponseTime: 5, lastError: null }
  }
  if (adapter === 'openweather') {
    const config = getIntegrationConfig()
    if (!config.weather.apiKey) {
      return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'No API key configured' }
    }
    return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Not yet probed — real adapter requires runtime call' }
  }
  if (adapter === 'amadeus') {
    const config = getIntegrationConfig()
    if (!config.flight.tokenUrl || !config.flight.invokeApiKey) {
      return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Missing Amadeus token proxy configuration' }
    }
    return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Not yet probed — real adapter requires runtime call' }
  }
  if (adapter === 'booking') {
    const config = getIntegrationConfig()
    if (!config.hotel.apiKey) {
      return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Missing Booking.com API key' }
    }
    return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Not yet probed — real adapter requires runtime call' }
  }
  if (adapter === 'rentalcars') {
    const config = getIntegrationConfig()
    if (!config.rentalCar.apiKey) {
      return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Missing Rental Cars API key' }
    }
    return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Not yet probed — real adapter requires runtime call' }
  }
  return { connected: false, healthy: false, apiReachable: false, lastResponseTime: null, lastError: 'Unknown adapter type' }
}

function assessOAuth(domain: string, adapter: string): {
  oauthStatus: ProviderHealth['oauthStatus']
  tokenRemainingLifetime: number | null
} {
  if (domain !== 'flight' || adapter !== 'amadeus') {
    return { oauthStatus: 'none', tokenRemainingLifetime: null }
  }

  const config = getIntegrationConfig()
  if (!config.flight.tokenUrl || !config.flight.invokeApiKey) {
    return { oauthStatus: 'not-configured', tokenRemainingLifetime: null }
  }

  const registry = getProviderRegistry()
  const provider = registry.getFlight()
  if (!provider || provider.metadata.id !== 'amadeus-flight-001') {
    return { oauthStatus: 'not-configured', tokenRemainingLifetime: null }
  }

  const adapterInstance = provider as unknown as AmadeusFlightAdapter
  const oauthClient = adapterInstance.getOAuthClient()
  const status = oauthClient.getTokenStatus()
  const lifetime = oauthClient.getTokenRemainingLifetime()

  return {
    oauthStatus: status,
    tokenRemainingLifetime: status === 'valid' ? lifetime : null,
  }
}

function assessDomainDiagnostics(domain: string, adapter: string): {
  lastResponseCount: number | null
  lastRequestAt: string | null
} {
  if (adapter === 'mock') {
    return { lastResponseCount: null, lastRequestAt: null }
  }

  const registry = getProviderRegistry()

  if (domain === 'hotel' && adapter === 'booking') {
    const provider = registry.getHotel()
    if (!provider || provider.metadata.id !== 'booking-hotel-001') {
      return { lastResponseCount: null, lastRequestAt: null }
    }
    const adapterInstance = provider as unknown as BookingComAdapter
    const diagnostics = adapterInstance.getDiagnostics()
    return {
      lastResponseCount: diagnostics.lastResponseCount || null,
      lastRequestAt: diagnostics.lastRequestAt,
    }
  }

  if (domain === 'rental-car' && adapter === 'rentalcars') {
    const provider = registry.getRentalCar()
    if (!provider || provider.metadata.id !== 'rentalcars-001') {
      return { lastResponseCount: null, lastRequestAt: null }
    }
    const adapterInstance = provider as unknown as RentalCarsComAdapter
    const diagnostics = adapterInstance.getDiagnostics()
    return {
      lastResponseCount: diagnostics.lastResponseCount || null,
      lastRequestAt: diagnostics.lastRequestAt,
    }
  }

  return { lastResponseCount: null, lastRequestAt: null }
}

export function createProviderHealthService(): ProviderHealthService {
  function buildHealth(domain: string, adapter: string): ProviderHealth | null {
    const registry = getProviderRegistry()
    const meta = registry.getMetadata(domain as never)
    if (!meta) return null
    const { connected, healthy, apiReachable, lastResponseTime, lastError } = assessHealth(adapter)
    const mode: 'mock' | 'real' = adapter === 'mock' ? 'mock' : 'real'
    const { oauthStatus, tokenRemainingLifetime } = assessOAuth(domain, adapter)
    const { lastResponseCount, lastRequestAt } = assessDomainDiagnostics(domain, adapter)
    return {
      providerId: meta.id,
      providerName: meta.name,
      domain,
      connected,
      enabled: registry.isEnabled(domain as never),
      healthy,
      lastCheck: new Date().toISOString(),
      adapter,
      mode,
      apiReachable,
      lastResponseTime,
      lastError,
      oauthStatus,
      tokenRemainingLifetime,
      lastResponseCount,
      lastRequestAt,
    }
  }

  return {
    checkAll() {
      const registry = getProviderRegistry()
      const entries = registry.listAll()
      return entries
        .map(entry => buildHealth(entry.domain, entry.adapterType))
        .filter((h): h is ProviderHealth => h !== null)
    },
    checkByDomain(domain) {
      const registry = getProviderRegistry()
      const entry = registry.listAll().find(e => e.domain === domain)
      if (!entry) return null
      return buildHealth(domain, entry.adapterType)
    },
  }
}

let cachedService: ProviderHealthService | null = null

export function getProviderHealthService(): ProviderHealthService {
  if (cachedService) return cachedService
  cachedService = createProviderHealthService()
  return cachedService
}

export function resetHealthService(): void {
  cachedService = null
}
