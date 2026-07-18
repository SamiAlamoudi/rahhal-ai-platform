/**
 * Amadeus Sandbox helpers for the booking/search funnel (integrations layer).
 *
 * Secrets stay on the Edge token proxy. This module only builds safe client-side
 * deep-links and reports sandbox readiness — no network I/O.
 */

import { isSafeBookingUrl } from '../../../lib/booking/bookingAction'
import { AMADEUS_DEFAULT_HOST, normalizeAmadeusHost } from './amadeusHost'

export const AMADEUS_SANDBOX_HOST = AMADEUS_DEFAULT_HOST
export const AMADEUS_PRODUCTION_HOST = 'https://api.amadeus.com'
export const AMADEUS_FLIGHT_PROVIDER_ID = 'amadeus-flight-001'

export function isAmadeusSandboxHost(baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return true // integrations default host is sandbox
  const host = normalizeAmadeusHost(baseUrl).toLowerCase()
  return host.includes('test.api.amadeus.com')
}

/**
 * Flight Offers Search does not return a merchant checkout URL.
 * Emit a stable HTTPS deep-link that preserves the sandbox offer id for
 * Rahhal redirect booking mode (provider handoff / resume metadata).
 */
export function buildAmadeusSandboxBookingUrl(
  offerId: string,
  options: { host?: string | null } = {},
): string {
  const sandbox = isAmadeusSandboxHost(options.host)
  const url = new URL('https://www.amadeus.com/book/flights')
  url.searchParams.set('offerId', offerId)
  url.searchParams.set('source', 'rahhal')
  url.searchParams.set('env', sandbox ? 'sandbox' : 'live')
  const href = url.toString()
  if (!isSafeBookingUrl(href)) {
    return 'https://www.amadeus.com/book/flights'
  }
  return href
}

export interface AmadeusSandboxReadiness {
  /** Funnel adapter selection wants Amadeus. */
  adapterSelected: boolean
  /** SPA can invoke the Edge token proxy (no Amadeus secrets in VITE_*). */
  tokenProxyConfigured: boolean
  /** Resolved host is sandbox (test.api.amadeus.com) or unset→sandbox default. */
  sandboxHost: boolean
  /** Ready for opt-in sandbox search in the booking funnel. */
  ready: boolean
  host: string
  notes: string[]
}

export function describeAmadeusSandboxReadiness(input: {
  flightAdapter: string
  tokenUrl: string | null
  invokeApiKey: string | null
  baseUrl: string | null
}): AmadeusSandboxReadiness {
  const adapterSelected = input.flightAdapter === 'amadeus'
  const relativeProxy = Boolean(input.tokenUrl?.startsWith('/'))
  const tokenProxyConfigured = Boolean(
    input.tokenUrl && (relativeProxy || input.invokeApiKey),
  )
  const host = normalizeAmadeusHost(input.baseUrl || AMADEUS_SANDBOX_HOST)
  const sandboxHost = isAmadeusSandboxHost(host)
  const notes: string[] = []

  if (!adapterSelected) {
    notes.push('Flight adapter is not amadeus (safe default: mock).')
  }
  if (!tokenProxyConfigured) {
    notes.push('Configure Vercel /api/amadeus-token (AMADEUS_* secrets) or Supabase Edge amadeus-token.')
  }
  if (!sandboxHost) {
    notes.push('Host is not Amadeus sandbox; set VITE_AMADEUS_BASE_URL=https://test.api.amadeus.com')
  }
  if (adapterSelected && tokenProxyConfigured && sandboxHost) {
    notes.push('Sandbox funnel path ready (search via AmadeusFlightAdapter + mock fallback).')
  }

  return {
    adapterSelected,
    tokenProxyConfigured,
    sandboxHost,
    ready: adapterSelected && tokenProxyConfigured && sandboxHost,
    host,
    notes,
  }
}
