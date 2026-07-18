/**
 * Configurable provider ordering from environment variables.
 *
 * Examples:
 *   VITE_FLIGHT_PROVIDER_CHAIN=duffel,travelport,sabre,amadeus_enterprise,mock
 *   VITE_HOTEL_PROVIDER_CHAIN=booking,expedia,hotelbeds,mock
 *   VITE_CARS_PROVIDER_CHAIN=rentalcars,mock
 *   VITE_ACTIVITIES_PROVIDER_CHAIN=viator,getyourguide,mock
 *   VITE_TRANSFERS_PROVIDER_CHAIN=mock
 */

import {
  DEFAULT_ACTIVITIES_CHAIN,
  DEFAULT_CARS_CHAIN,
  DEFAULT_FLIGHT_CHAIN,
  DEFAULT_HOTEL_CHAIN,
  DEFAULT_TRANSFERS_CHAIN,
  type MultiProviderId,
  type TravelDomain,
} from './types'

const VALID_IDS = new Set<MultiProviderId>([
  'duffel',
  'travelport',
  'sabre',
  'amadeus_enterprise',
  'amadeus',
  'booking',
  'expedia',
  'hotelbeds',
  'rentalcars',
  'viator',
  'getyourguide',
  'mock',
])

function readEnv(key: string): string | null {
  try {
    const fromMeta = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (fromMeta !== undefined && fromMeta !== null && fromMeta !== '') {
      return String(fromMeta)
    }
  } catch {
    /* ignore */
  }
  // Vitest / Node: vi.stubEnv and process env
  try {
    const fromProcess = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env?.[key]
    if (fromProcess !== undefined && fromProcess !== null && fromProcess !== '') {
      return String(fromProcess)
    }
  } catch {
    /* ignore */
  }
  return null
}

function readBool(key: string, fallback: boolean): boolean {
  const v = readEnv(key)
  if (v === null) return fallback
  return v === 'true' || v === '1'
}

function parseChain(raw: string | null, fallback: MultiProviderId[]): MultiProviderId[] {
  if (!raw) return [...fallback]
  const parts = raw
    .split(/[,|]/)
    .map((p) => p.trim().toLowerCase().replace(/-/g, '_'))
    .filter(Boolean) as MultiProviderId[]

  const chain = parts.filter((id) => VALID_IDS.has(id))
  if (chain.length === 0) return [...fallback]
  // Always ensure mock is last as ultimate safety net.
  if (!chain.includes('mock')) chain.push('mock')
  return chain
}

export interface MultiProviderConfig {
  enabled: boolean
  chains: Record<TravelDomain, MultiProviderId[]>
}

let cachedConfig: MultiProviderConfig | null = null

export function getMultiProviderConfig(): MultiProviderConfig {
  if (cachedConfig) return cachedConfig

  // Enabled by default — Rahhal must never depend on a single supplier.
  // Set VITE_MULTI_PROVIDER_ENABLED=false to force legacy single-adapter path.
  const enabled = readBool('VITE_MULTI_PROVIDER_ENABLED', true)

  cachedConfig = {
    enabled,
    chains: {
      flight: parseChain(readEnv('VITE_FLIGHT_PROVIDER_CHAIN'), DEFAULT_FLIGHT_CHAIN),
      hotel: parseChain(readEnv('VITE_HOTEL_PROVIDER_CHAIN'), DEFAULT_HOTEL_CHAIN),
      cars: parseChain(readEnv('VITE_CARS_PROVIDER_CHAIN'), DEFAULT_CARS_CHAIN),
      activities: parseChain(readEnv('VITE_ACTIVITIES_PROVIDER_CHAIN'), DEFAULT_ACTIVITIES_CHAIN),
      transfers: parseChain(readEnv('VITE_TRANSFERS_PROVIDER_CHAIN'), DEFAULT_TRANSFERS_CHAIN),
    },
  }
  return cachedConfig
}

export function clearMultiProviderConfigCache(): void {
  cachedConfig = null
}

export function getDomainChain(domain: TravelDomain): MultiProviderId[] {
  return [...getMultiProviderConfig().chains[domain]]
}
