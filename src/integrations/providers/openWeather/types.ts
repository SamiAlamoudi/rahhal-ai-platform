/** Canonical weather models — never expose raw OpenWeather API shapes outside this package. */

export type CanonicalWeatherCondition =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'fog'
  | 'windy'
  | 'unknown'

export interface CanonicalCurrentWeather {
  destination: string
  observedAt: string | null
  tempC: number
  feelsLikeC: number
  humidity: number
  windKph: number
  visibilityKm: number | null
  uvIndex: number | null
  condition: CanonicalWeatherCondition
  description: string
  sunrise: string | null
  sunset: string | null
  rainProbability: number | null
}

export interface CanonicalHourlyForecast {
  at: string
  tempC: number
  feelsLikeC: number
  humidity: number
  windKph: number
  visibilityKm: number | null
  rainProbability: number | null
  condition: CanonicalWeatherCondition
  description: string
}

export interface CanonicalDailyForecast {
  date: string
  tempHighC: number
  tempLowC: number
  feelsLikeC: number | null
  humidity: number
  windKph: number
  visibilityKm: number | null
  uvIndex: number | null
  rainProbability: number | null
  condition: CanonicalWeatherCondition
  description: string
  sunrise: string | null
  sunset: string | null
}

export interface CanonicalWeatherAlert {
  event: string
  severity: string | null
  start: string | null
  end: string | null
  description: string
  sender: string | null
}

export interface CanonicalWeatherSnapshot {
  destination: string
  summary: string
  averageHighC: number
  averageLowC: number
  season: string | null
  current: CanonicalCurrentWeather | null
  hourly: CanonicalHourlyForecast[]
  daily: CanonicalDailyForecast[]
  alerts: CanonicalWeatherAlert[]
  packingHints: string[]
  travelTips: string[]
}

export type OpenWeatherOperation =
  | 'current'
  | 'forecast'
  | 'onecall'
  | 'uvi'

export interface OpenWeatherClientConfig {
  /** Server-side OpenWeather API key. Never a VITE_* value. */
  apiKey: string | null
  /** SPA proxy URL that holds the key server-side. */
  proxyUrl: string | null
  /** Key used to invoke the proxy (e.g. Supabase anon). */
  invokeApiKey: string | null
  baseUrl: string
  timeoutMs: number
  maxRetries: number
  fetchImpl?: typeof fetch
}
