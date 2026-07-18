/**
 * Unified Amadeus Self-Service client.
 *
 * Wraps OAuth (via server-side token proxy), Flight Offers Search,
 * Airport & City Search, and Airline Codes Lookup.
 * Secrets never live in the SPA — only env-driven proxy URLs / anon keys.
 */

import { AmadeusOAuthClient, type OAuthClientConfig } from './amadeusOAuthClient'
import {
  AmadeusFlightApiClient,
  type ApiClientConfig,
  type ApiClientResult,
  type AmadeusAirlineResult,
  type AmadeusFlightOffersResponse,
  type AmadeusLocationResult,
  type FlightSearchQuery,
} from './amadeusFlightApiClient'
import { AMADEUS_DEFAULT_HOST, normalizeAmadeusHost } from './amadeusHost'

export interface AmadeusClientConfig {
  /** Server-side token proxy URL (Supabase Edge Function). */
  tokenUrl: string
  /** Supabase anon key / JWT used to invoke the proxy — never an Amadeus secret. */
  invokeApiKey: string
  /** Amadeus API host (defaults to sandbox). */
  baseUrl?: string
  timeout?: number
  maxRetries?: number
}

export class AmadeusClient {
  readonly oauth: AmadeusOAuthClient
  readonly api: AmadeusFlightApiClient
  readonly host: string

  constructor(config: AmadeusClientConfig) {
    this.host = normalizeAmadeusHost(config.baseUrl || AMADEUS_DEFAULT_HOST)
    const oauthConfig: OAuthClientConfig = {
      tokenUrl: config.tokenUrl,
      invokeApiKey: config.invokeApiKey,
      timeout: config.timeout ?? 5000,
    }
    this.oauth = new AmadeusOAuthClient(oauthConfig)
    const apiConfig: ApiClientConfig = {
      baseUrl: this.host,
      timeout: config.timeout ?? 5000,
      maxRetries: config.maxRetries ?? 2,
    }
    this.api = new AmadeusFlightApiClient(apiConfig, this.oauth)
  }

  getOAuthClient(): AmadeusOAuthClient {
    return this.oauth
  }

  getApiClient(): AmadeusFlightApiClient {
    return this.api
  }

  /** Flight Offers Search */
  searchFlightOffers(query: FlightSearchQuery): Promise<ApiClientResult<AmadeusFlightOffersResponse>> {
    return this.api.searchFlightOffers(query)
  }

  /** Airport & City Search */
  searchLocations(keyword: string): Promise<ApiClientResult<AmadeusLocationResult[]>> {
    return this.api.searchLocations(keyword)
  }

  /** Airline Codes Lookup */
  lookupAirlines(airlineCodes: string[]): Promise<ApiClientResult<AmadeusAirlineResult[]>> {
    return this.api.lookupAirlines(airlineCodes)
  }
}

export type {
  AmadeusAirlineResult,
  AmadeusFlightOffersResponse,
  AmadeusLocationResult,
  FlightSearchQuery,
  ApiClientResult,
}
