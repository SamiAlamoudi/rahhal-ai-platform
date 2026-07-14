import type { ProviderError } from '../../utils/contracts/result'

export interface OpenWeatherResponse {
  cod: string
  message: number
  cnt: number
  list: OpenWeatherForecastItem[]
  city: {
    id: number
    name: string
    coord: { lat: number; lon: number }
    country: string
    population: number
    timezone: number
  }
}

export interface OpenWeatherForecastItem {
  dt: number
  main: {
    temp: number
    feels_like: number
    temp_min: number
    temp_max: number
    humidity: number
  }
  weather: Array<{
    id: number
    main: string
    description: string
    icon: string
  }>
  clouds: { all: number }
  wind: { speed: number; deg: number }
  visibility: number
  pop: number
  dt_txt: string
}

export interface ApiClientConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  maxRetries: number
}

export interface ApiClientResult<T> {
  data: T | null
  error: ProviderError | null
  latency: number
  attempts: number
}

type LogLevel = 'info' | 'warn' | 'error'

function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  const prefix = `[OpenWeather:${level.toUpperCase()}]`
  const fn = level === 'info' ? console.log : level === 'warn' ? console.warn : console.error
  if (context && Object.keys(context).length > 0) {
    fn(prefix, ts, message, context)
  } else {
    fn(prefix, ts, message)
  }
}

function mapHttpError(status: number, body: string): ProviderError {
  const ts = new Date().toISOString()
  if (status === 401) {
    return { code: 'INVALID_API_KEY', category: 'auth', severity: 'fatal', message: `Invalid API key (401): ${body}`, retryable: false, timestamp: ts }
  }
  if (status === 429) {
    return { code: 'RATE_LIMITED', category: 'rate-limit', severity: 'warning', message: 'Rate limited (429)', retryable: true, timestamp: ts }
  }
  if (status >= 500) {
    return { code: 'SERVER_ERROR', category: 'provider', severity: 'error', message: `Server error (${status})`, retryable: true, timestamp: ts }
  }
  if (status === 404) {
    return { code: 'NOT_FOUND', category: 'validation', severity: 'warning', message: `Location not found (404)`, retryable: false, timestamp: ts }
  }
  return { code: 'HTTP_ERROR', category: 'provider', severity: 'error', message: `HTTP ${status}: ${body}`, retryable: status >= 500, timestamp: ts }
}

function mapNetworkError(err: unknown): ProviderError {
  const ts = new Date().toISOString()
  const message = err instanceof Error ? err.message : 'Unknown network error'
  if (message.includes('timeout') || message.toLowerCase().includes('abort') || message.includes('AbortError')) {
    return { code: 'TIMEOUT', category: 'timeout', severity: 'error', message: 'Request timed out', retryable: true, timestamp: ts }
  }
  if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('network')) {
    return { code: 'NETWORK_FAILURE', category: 'network', severity: 'error', message: `Network failure: ${message}`, retryable: true, timestamp: ts }
  }
  return { code: 'UNCAUGHT', category: 'unknown', severity: 'error', message, retryable: false, timestamp: ts }
}

export class OpenWeatherApiClient {
  private config: ApiClientConfig

  constructor(config: ApiClientConfig) {
    this.config = config
  }

  async getForecast(destination: string): Promise<ApiClientResult<OpenWeatherResponse>> {
    const url = `${this.config.baseUrl}/forecast?q=${encodeURIComponent(destination)}&units=metric&appid=${this.config.apiKey}`
    let lastError: ProviderError | null = null
    const maxAttempts = this.config.maxRetries + 1

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const start = Date.now()
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

      try {
        log('info', `Fetching forecast for "${destination}" (attempt ${attempt}/${maxAttempts})`)
        const response = await fetch(url, { signal: controller.signal })
        clearTimeout(timeoutId)
        const latency = Date.now() - start

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          lastError = mapHttpError(response.status, body)
          log('warn', `HTTP ${response.status} on attempt ${attempt}`, { latency, error: lastError.code })
          if (!lastError.retryable || attempt >= maxAttempts) {
            return { data: null, error: lastError, latency, attempts: attempt }
          }
          continue
        }

        const data = await response.json() as OpenWeatherResponse
        const totalLatency = Date.now() - start
        log('info', `Forecast fetched successfully`, { latency: totalLatency, items: data.list?.length ?? 0 })
        return { data, error: null, latency: totalLatency, attempts: attempt }
      } catch (err) {
        clearTimeout(timeoutId)
        const latency = Date.now() - start
        lastError = mapNetworkError(err)
        log('error', `Request failed on attempt ${attempt}`, { latency, error: lastError.code })
        if (!lastError.retryable || attempt >= maxAttempts) {
          return { data: null, error: lastError, latency, attempts: attempt }
        }
      }
    }

    return { data: null, error: lastError, latency: 0, attempts: maxAttempts }
  }
}
