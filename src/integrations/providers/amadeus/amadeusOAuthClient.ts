import type { ProviderError } from '../../../utils/contracts/result'

export interface AmadeusToken {
  accessToken: string
  tokenType: string
  expiresAt: number
  scope: string | null
}

export interface OAuthClientConfig {
  clientId: string
  clientSecret: string
  baseUrl: string
  timeout: number
}

export interface OAuthResult {
  token: AmadeusToken | null
  error: ProviderError | null
  latency: number
  fromCache: boolean
}

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[Amadeus:OAuth:${level.toUpperCase()}]`
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error
  if (context && Object.keys(context).length > 0) {
    fn(prefix, ts, message, context)
  } else {
    fn(prefix, ts, message)
  }
}

function mapOAuthError(err: unknown, status?: number): ProviderError {
  const ts = new Date().toISOString()
  if (status === 401) {
    return { code: 'AMADEUS_INVALID_CREDENTIALS', category: 'auth', severity: 'fatal', message: 'Invalid Amadeus credentials (401)', retryable: false, timestamp: ts }
  }
  if (status === 429) {
    return { code: 'AMADEUS_QUOTA_EXCEEDED', category: 'rate-limit', severity: 'warning', message: 'Quota exceeded (429)', retryable: true, timestamp: ts }
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('abort') || msg.includes('timeout')) {
      return { code: 'AMADEUS_AUTH_TIMEOUT', category: 'timeout', severity: 'error', message: 'OAuth request timed out', retryable: true, timestamp: ts }
    }
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return { code: 'AMADEUS_AUTH_NETWORK', category: 'network', severity: 'error', message: `Network failure: ${err.message}`, retryable: true, timestamp: ts }
    }
  }
  return { code: 'AMADEUS_AUTH_ERROR', category: 'auth', severity: 'error', message: err instanceof Error ? err.message : 'Unknown OAuth error', retryable: false, timestamp: ts }
}

const SAFETY_MARGIN_MS = 60_000

export class AmadeusOAuthClient {
  private config: OAuthClientConfig
  private cachedToken: AmadeusToken | null = null
  private inFlight: Promise<OAuthResult> | null = null

  constructor(config: OAuthClientConfig) {
    this.config = config
  }

  private isTokenValid(): boolean {
    if (!this.cachedToken) return false
    return Date.now() < this.cachedToken.expiresAt - SAFETY_MARGIN_MS
  }

  getTokenRemainingLifetime(): number {
    if (!this.cachedToken) return 0
    return Math.max(0, this.cachedToken.expiresAt - Date.now())
  }

  getTokenStatus(): 'none' | 'valid' | 'expired' {
    if (!this.cachedToken) return 'none'
    return this.isTokenValid() ? 'valid' : 'expired'
  }

  clearToken(): void {
    this.cachedToken = null
  }

  async getToken(): Promise<OAuthResult> {
    if (this.isTokenValid() && this.cachedToken) {
      log('info', 'Using cached token', { remainingMs: this.getTokenRemainingLifetime() })
      return { token: this.cachedToken, error: null, latency: 0, fromCache: true }
    }

    if (this.inFlight) {
      log('info', 'Awaiting in-flight token request')
      return this.inFlight
    }

    this.inFlight = this.requestNewToken()
    try {
      return await this.inFlight
    } finally {
      this.inFlight = null
    }
  }

  private async requestNewToken(): Promise<OAuthResult> {
    const start = Date.now()
    const url = `${this.config.baseUrl}/security/oauth2/token`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      })

      log('info', 'Requesting new access token')
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const latency = Date.now() - start

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        const error = mapOAuthError(new Error(`HTTP ${response.status}: ${errorBody}`), response.status)
        log('error', `Token request failed (${response.status})`, { latency, error: error.code })
        return { token: null, error, latency, fromCache: false }
      }

      const data = await response.json() as {
        access_token: string
        token_type: string
        expires_in: number
        scope?: string
      }

      const token: AmadeusToken = {
        accessToken: data.access_token,
        tokenType: data.token_type || 'Bearer',
        expiresAt: Date.now() + data.expires_in * 1000,
        scope: data.scope ?? null,
      }

      this.cachedToken = token
      log('info', 'Token acquired and cached', { latency, expiresIn: data.expires_in, expiresAt: new Date(token.expiresAt).toISOString() })
      return { token, error: null, latency, fromCache: false }
    } catch (err) {
      clearTimeout(timeoutId)
      const latency = Date.now() - start
      const error = mapOAuthError(err)
      log('error', 'Token request exception', { latency, error: error.code })
      return { token: null, error, latency, fromCache: false }
    }
  }
}
