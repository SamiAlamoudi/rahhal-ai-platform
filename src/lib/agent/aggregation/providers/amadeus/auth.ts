import { amadeusV1Url, normalizeAmadeusHost } from '../../../../../integrations/providers/amadeus/amadeusHost'
import {
  AmadeusOAuthClient,
  type AmadeusToken,
  type OAuthResult,
} from '../../../../../integrations/providers/amadeus/amadeusOAuthClient'
import type { AmadeusProviderConfig } from './config'

/**
 * Dual-mode Amadeus OAuth for the agent ProviderAdapter:
 * - client_credentials when AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET are provided
 * - server token proxy otherwise (SPA-safe path)
 *
 * Compatible with AmadeusFlightApiClient's OAuth surface (getToken / clearToken / …).
 */
export type AmadeusAuthClient = AmadeusOAuthClient | AmadeusClientCredentialsAuth

export function createAmadeusAuthClient(config: AmadeusProviderConfig): AmadeusAuthClient {
  if (config.clientId && config.clientSecret) {
    return new AmadeusClientCredentialsAuth({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      baseUrl: config.baseUrl,
      timeout: config.timeoutMs,
    })
  }
  if (!config.tokenUrl || !config.invokeApiKey) {
    throw new Error('Amadeus auth is not configured (need client credentials or token proxy)')
  }
  return new AmadeusOAuthClient({
    tokenUrl: config.tokenUrl,
    invokeApiKey: config.invokeApiKey,
    timeout: config.timeoutMs,
  })
}

export class AmadeusClientCredentialsAuth {
  private cachedToken: AmadeusToken | null = null
  private inFlight: Promise<OAuthResult> | null = null
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly host: string
  private readonly timeout: number

  constructor(input: {
    clientId: string
    clientSecret: string
    baseUrl: string
    timeout: number
  }) {
    this.clientId = input.clientId
    this.clientSecret = input.clientSecret
    this.host = normalizeAmadeusHost(input.baseUrl)
    this.timeout = input.timeout
  }

  getTokenRemainingLifetime(): number {
    if (!this.cachedToken) return 0
    return Math.max(0, this.cachedToken.expiresAt - Date.now())
  }

  getTokenStatus(): 'none' | 'valid' | 'expired' {
    if (!this.cachedToken) return 'none'
    return Date.now() < this.cachedToken.expiresAt - 60_000 ? 'valid' : 'expired'
  }

  clearToken(): void {
    this.cachedToken = null
  }

  /**
   * Force OAuth token refresh (client_credentials re-acquire).
   * Used after 401 / expired access tokens — Amadeus does not use refresh_token grants.
   */
  async refreshToken(): Promise<OAuthResult> {
    this.clearToken()
    return this.getToken()
  }

  async getToken(): Promise<OAuthResult> {
    if (this.getTokenStatus() === 'valid' && this.cachedToken) {
      return { token: this.cachedToken, error: null, latency: 0, fromCache: true }
    }
    if (this.inFlight) return this.inFlight
    this.inFlight = this.requestNewToken()
    try {
      return await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  private async requestNewToken(): Promise<OAuthResult> {
    const start = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeout)
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      })
      const response = await fetch(amadeusV1Url(this.host, '/security/oauth2/token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      })
      clearTimeout(timer)
      const latency = Date.now() - start
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        if (response.status === 429) {
          return {
            token: null,
            error: {
              code: 'AMADEUS_QUOTA_EXCEEDED',
              category: 'rate-limit',
              severity: 'warning',
              message: `Rate limited during OAuth (${response.status})`,
              retryable: true,
              timestamp: new Date().toISOString(),
            },
            latency,
            fromCache: false,
          }
        }
        return {
          token: null,
          error: {
            code: response.status === 401 ? 'AMADEUS_INVALID_CREDENTIALS' : 'AMADEUS_AUTH_ERROR',
            category: 'auth',
            severity: 'fatal',
            message: `OAuth failed (${response.status}): ${text}`,
            retryable: false,
            timestamp: new Date().toISOString(),
          },
          latency,
          fromCache: false,
        }
      }
      const data = await response.json() as {
        access_token: string
        token_type?: string
        expires_in: number
        scope?: string | null
      }
      const token: AmadeusToken = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope ?? null,
      }
      this.cachedToken = token
      return { token, error: null, latency, fromCache: false }
    } catch (err) {
      clearTimeout(timer)
      const message = err instanceof Error ? err.message : 'OAuth exception'
      const timeout = message.toLowerCase().includes('abort') || message.toLowerCase().includes('timeout')
      return {
        token: null,
        error: {
          code: timeout ? 'AMADEUS_AUTH_TIMEOUT' : 'AMADEUS_AUTH_NETWORK',
          category: timeout ? 'timeout' : 'network',
          severity: 'error',
          message,
          retryable: true,
          timestamp: new Date().toISOString(),
        },
        latency: Date.now() - start,
        fromCache: false,
      }
    }
  }
}
