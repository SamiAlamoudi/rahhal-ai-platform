/**
 * Amadeus OAuth token management — Sprint 56 Live Provider Layer.
 *
 * - Client credentials grant
 * - Cached access token with automatic refresh before expiry
 * - Retry failed authentication once after clearing cache
 * - Injectable fetch for tests (no network)
 */

import type { LiveFetch } from './types'

export type AmadeusOAuthToken = {
  accessToken: string
  tokenType: string
  expiresAt: number
}

export type AmadeusOAuthResult = {
  token: AmadeusOAuthToken | null
  error: string | null
  fromCache: boolean
  latencyMs: number
}

export type AmadeusOAuthOptions = {
  clientId: string
  clientSecret: string
  tokenUrl: string
  fetchImpl?: LiveFetch
  /** Refresh this many ms before expiry (default 60s). */
  refreshSkewMs?: number
  now?: () => number
}

export class AmadeusOAuthManager {
  private cached: AmadeusOAuthToken | null = null
  private inFlight: Promise<AmadeusOAuthResult> | null = null
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly tokenUrl: string
  private readonly fetchImpl: LiveFetch
  private readonly refreshSkewMs: number
  private readonly now: () => number
  private refreshCount = 0
  private authRetries = 0

  constructor(options: AmadeusOAuthOptions) {
    this.clientId = options.clientId
    this.clientSecret = options.clientSecret
    this.tokenUrl = options.tokenUrl
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis)
    this.refreshSkewMs = options.refreshSkewMs ?? 60_000
    this.now = options.now ?? (() => Date.now())
  }

  getStatus(): 'none' | 'valid' | 'expired' {
    if (!this.cached) return 'none'
    return this.now() < this.cached.expiresAt - this.refreshSkewMs ? 'valid' : 'expired'
  }

  getRefreshCount(): number {
    return this.refreshCount
  }

  getAuthRetryCount(): number {
    return this.authRetries
  }

  clearToken(): void {
    this.cached = null
  }

  async getToken(): Promise<AmadeusOAuthResult> {
    if (this.getStatus() === 'valid' && this.cached) {
      return { token: this.cached, error: null, fromCache: true, latencyMs: 0 }
    }
    if (this.inFlight) return this.inFlight
    this.inFlight = this.requestToken()
    try {
      return await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  /** Force re-acquire (Amadeus uses client_credentials, not refresh_token). */
  async refreshToken(): Promise<AmadeusOAuthResult> {
    this.clearToken()
    this.refreshCount += 1
    return this.getToken()
  }

  /**
   * Authorized fetch with automatic auth retry on 401.
   */
  async authorizedFetch(
    url: string,
    init: RequestInit = {},
  ): Promise<{ response: Response; authRetried: boolean }> {
    const first = await this.getToken()
    if (!first.token) {
      throw new Error(first.error || 'amadeus_oauth_failed')
    }
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `${first.token.tokenType} ${first.token.accessToken}`,
      },
    })
    if (response.status !== 401) {
      return { response, authRetried: false }
    }
    this.authRetries += 1
    const refreshed = await this.refreshToken()
    if (!refreshed.token) {
      throw new Error(refreshed.error || 'amadeus_oauth_refresh_failed')
    }
    const retry = await this.fetchImpl(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `${refreshed.token.tokenType} ${refreshed.token.accessToken}`,
      },
    })
    return { response: retry, authRetried: true }
  }

  private async requestToken(): Promise<AmadeusOAuthResult> {
    const started = this.now()
    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      })
      const response = await this.fetchImpl(this.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
      const latencyMs = this.now() - started
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return {
          token: null,
          error: `oauth_failed_${response.status}:${text.slice(0, 120)}`,
          fromCache: false,
          latencyMs,
        }
      }
      const data = (await response.json()) as {
        access_token: string
        token_type?: string
        expires_in: number
      }
      const token: AmadeusOAuthToken = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: this.now() + data.expires_in * 1000,
      }
      this.cached = token
      return { token, error: null, fromCache: false, latencyMs }
    } catch (err) {
      return {
        token: null,
        error: err instanceof Error ? err.message : 'oauth_network_error',
        fromCache: false,
        latencyMs: this.now() - started,
      }
    }
  }
}

export function amadeusTokenUrl(baseUrl: string): string {
  const host = baseUrl.replace(/\/$/, '')
  return `${host}/v1/security/oauth2/token`
}
