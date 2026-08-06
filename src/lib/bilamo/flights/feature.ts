/**
 * Bilamo Live Flights gate.
 * Live mode requires server Amadeus credentials + opt-in env.
 * Default: demo (deterministic, no paid keys).
 */

import { isLiveFlightSearchEnabled } from '../../agent/liveFlightSearch/feature'
import type { FlightProviderMode } from './types'

function readEnvBag(
  env?: Record<string, string | undefined>,
): Record<string, string | undefined> {
  if (env) return env
  const out: Record<string, string | undefined> = {}
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env ?? {}
    for (const [k, v] of Object.entries(vite)) {
      if (typeof v === 'string') out[k] = v
    }
  } catch {
    /* ignore */
  }
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    for (const [k, v] of Object.entries(proc?.env ?? {})) {
      if (typeof v === 'string' && out[k] === undefined) out[k] = v
    }
  } catch {
    /* ignore */
  }
  return out
}

/**
 * Opt into Bilamo live flight search.
 * Server secrets (AMADEUS_*) are never read here — only the public toggle.
 */
export function resolveBilamoFlightMode(options?: {
  forceMode?: FlightProviderMode
  env?: Record<string, string | undefined>
  liveFlightSearchEnabled?: boolean
}): FlightProviderMode {
  if (options?.forceMode === 'demo' || options?.forceMode === 'live') {
    return options.forceMode
  }
  const env = readEnvBag(options?.env)
  const raw = (env.VITE_BILAMO_LIVE_FLIGHTS || env.BILAMO_LIVE_FLIGHTS || '').toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'demo') return 'demo'
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'live') {
    // Also respect the product live-flight-search registry when available.
    const registryOn = isLiveFlightSearchEnabled({
      enabled: options?.liveFlightSearchEnabled,
    })
    // Public toggle alone is enough to attempt live via the server API;
    // server falls back to demo if credentials are missing.
    return registryOn || raw === 'live' || raw === 'true' || raw === '1' || raw === 'on'
      ? 'live'
      : 'demo'
  }
  return 'demo'
}

export function isBilamoLiveFlightsEnabled(options?: {
  forceMode?: FlightProviderMode
  env?: Record<string, string | undefined>
}): boolean {
  return resolveBilamoFlightMode(options) === 'live'
}
