/**
 * Sprint 92 — Amadeus Sandbox (core barrel).
 * Additive TravelProvider — does not modify Provider Readiness sources.
 */

export {
  SPRINT92_AMADEUS_SANDBOX_VERSION,
  AMADEUS_SANDBOX_PROVIDER_ID,
  AMADEUS_SANDBOX_DEFAULT_BASE_URL,
  type AmadeusNormalizedFlight,
  type AmadeusAirportLookup,
  type AmadeusProviderEventName,
  type AmadeusProviderEvent,
  type AmadeusSandboxConfig,
} from './types'

export {
  AmadeusSandboxOAuth,
  amadeusTokenUrl,
  type AmadeusOAuthToken,
  type AmadeusOAuthResult,
  type AmadeusOAuthOptions,
  type AmadeusFetch,
} from './AmadeusAuth'

export {
  resolveAmadeusSandboxConfig,
  readAmadeusClientId,
  readAmadeusClientSecret,
  readAmadeusBaseUrl,
  isProductionDeployTarget,
  parseBoolEnv,
} from './config'

export {
  AMADEUS_AIRLINE_NAMES,
  mapAirlineCode,
  mapCabinToAmadeusTravelClass,
  normalizeCurrency,
  normalizePassengerCounts,
  parseDurationMinutes,
  normalizeAmadeusFlightOffer,
  normalizeAmadeusAirport,
  toDecisionEngineFlightOffer,
  type AmadeusOfferRaw,
} from './normalize'

export {
  emitAmadeusProviderEvent,
  onAmadeusProviderEvent,
  resetAmadeusProviderEventListeners,
} from './events'

export {
  createAmadeusSandboxProvider,
  registerAmadeusSandboxProvider,
  type AmadeusSandboxProvider,
  type AmadeusSandboxProviderOptions,
} from './AmadeusProvider'
