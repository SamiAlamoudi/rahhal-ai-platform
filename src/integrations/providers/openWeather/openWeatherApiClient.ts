import { buildCanonicalSnapshot } from './normalize'
import type {
  CanonicalWeatherSnapshot,
  OpenWeatherClientConfig,
  OpenWeatherOperation,
} from './types'

const DEFAULT_BASE = 'https://api.openweathermap.org/data/2.5'

export class OpenWeatherApiClient {
  private readonly config: OpenWeatherClientConfig
  private readonly fetchImpl: typeof fetch

  constructor(config: OpenWeatherClientConfig) {
    this.config = {
      ...config,
      baseUrl: (config.baseUrl || DEFAULT_BASE).replace(/\/$/, ''),
    }
    this.fetchImpl = config.fetchImpl ?? fetch.bind(globalThis)
  }

  /**
   * Fetch a full canonical weather snapshot for a destination.
   * Raw OpenWeather JSON never leaves this method.
   */
  async getWeatherSnapshot(destination: string): Promise<CanonicalWeatherSnapshot> {
    const forecast = await this.request('forecast', { q: destination, units: 'metric' })
    let current: Record<string, unknown> | null = null
    try {
      current = await this.request('current', { q: destination, units: 'metric' })
    } catch {
      current = null
    }

    const city = forecast.city as { coord?: { lat?: number; lon?: number } } | undefined
    const lat = city?.coord?.lat ?? (current?.coord as { lat?: number } | undefined)?.lat
    const lon = city?.coord?.lon ?? (current?.coord as { lon?: number } | undefined)?.lon

    let oneCall: Record<string, unknown> | null = null
    let uvIndex: number | null = null
    if (typeof lat === 'number' && typeof lon === 'number') {
      try {
        oneCall = await this.request('onecall', {
          lat,
          lon,
          units: 'metric',
          exclude: 'minutely',
        })
      } catch {
        oneCall = null
      }
      if (oneCall && typeof oneCall.current === 'object' && oneCall.current) {
        const uvi = (oneCall.current as { uvi?: number }).uvi
        if (typeof uvi === 'number') uvIndex = uvi
      }
      if (uvIndex == null) {
        try {
          const uviRaw = await this.request('uvi', { lat, lon })
          if (typeof uviRaw.value === 'number') uvIndex = uviRaw.value
        } catch {
          /* UV optional */
        }
      }
    }

    return buildCanonicalSnapshot({
      destination,
      currentRaw: current,
      forecastRaw: forecast,
      oneCallRaw: oneCall,
      uvIndex,
    })
  }

  private async request(
    operation: OpenWeatherOperation,
    params: Record<string, string | number>,
  ): Promise<Record<string, unknown>> {
    if (this.config.proxyUrl && this.config.invokeApiKey) {
      return this.requestViaProxy(operation, params)
    }
    if (!this.config.apiKey) {
      throw Object.assign(new Error('OpenWeather API key is not configured'), {
        code: 'unavailable',
      })
    }
    return this.requestDirect(operation, params)
  }

  private async requestViaProxy(
    operation: OpenWeatherOperation,
    params: Record<string, string | number>,
  ): Promise<Record<string, unknown>> {
    let lastError: unknown
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
      try {
        const response = await this.fetchImpl(this.config.proxyUrl!, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.invokeApiKey}`,
            apikey: this.config.invokeApiKey!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ operation, params }),
          signal: controller.signal,
        })
        clearTimeout(timer)
        const text = await response.text()
        if (response.status === 429) {
          throw Object.assign(new Error('rate_limited'), { code: 'rate_limited' })
        }
        if (!response.ok) {
          throw Object.assign(new Error(`OpenWeather proxy failed (${response.status}): ${text}`), {
            code: response.status === 401 ? 'unavailable' : 'upstream_error',
          })
        }
        return JSON.parse(text) as Record<string, unknown>
      } catch (error) {
        clearTimeout(timer)
        lastError = error
        if (!isRetryable(error) || attempt > this.config.maxRetries) break
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }

  private async requestDirect(
    operation: OpenWeatherOperation,
    params: Record<string, string | number>,
  ): Promise<Record<string, unknown>> {
    const url = buildOpenWeatherUrl(operation, params, this.config.apiKey!, this.config.baseUrl)
    let lastError: unknown
    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt += 1) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs)
      try {
        const response = await this.fetchImpl(url, { signal: controller.signal })
        clearTimeout(timer)
        const text = await response.text()
        if (response.status === 429) {
          throw Object.assign(new Error('rate_limited'), { code: 'rate_limited' })
        }
        if (response.status === 401) {
          throw Object.assign(new Error('OpenWeather request denied'), { code: 'unavailable' })
        }
        if (!response.ok) {
          throw Object.assign(new Error(`OpenWeather HTTP ${response.status}: ${text}`), {
            code: response.status === 404 ? 'invalid_input' : 'upstream_error',
          })
        }
        return JSON.parse(text) as Record<string, unknown>
      } catch (error) {
        clearTimeout(timer)
        lastError = error
        if (!isRetryable(error) || attempt > this.config.maxRetries) break
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError))
  }
}

function buildOpenWeatherUrl(
  operation: OpenWeatherOperation,
  params: Record<string, string | number>,
  apiKey: string,
  baseUrl: string,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) search.set(key, String(value))
  search.set('appid', apiKey)

  if (operation === 'onecall') {
    // One Call is under /data/3.0 when available.
    const host = baseUrl.includes('/data/')
      ? baseUrl.replace(/\/data\/2\.5\/?$/, '/data/3.0')
      : 'https://api.openweathermap.org/data/3.0'
    return `${host}/onecall?${search.toString()}`
  }

  const path = {
    current: 'weather',
    forecast: 'forecast',
    uvi: 'uvi',
    onecall: 'onecall',
  }[operation]
  return `${baseUrl}/${path}?${search.toString()}`
}

function isRetryable(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return code === 'rate_limited'
    || code === 'upstream_error'
    || message.includes('timeout')
    || message.includes('abort')
    || message.includes('network')
}
