/**
 * Internal OpenWeather JSON → canonical models.
 * Kept inside this package so raw vendor shapes never cross the adapter boundary.
 */

import type {
  CanonicalCurrentWeather,
  CanonicalDailyForecast,
  CanonicalHourlyForecast,
  CanonicalWeatherAlert,
  CanonicalWeatherCondition,
  CanonicalWeatherSnapshot,
} from './types'

const CONDITION_MAP: Record<number, CanonicalWeatherCondition> = {
  200: 'thunderstorm', 201: 'thunderstorm', 202: 'thunderstorm', 210: 'thunderstorm',
  211: 'thunderstorm', 212: 'thunderstorm', 221: 'thunderstorm', 230: 'thunderstorm',
  231: 'thunderstorm', 232: 'thunderstorm',
  300: 'rain', 301: 'rain', 302: 'rain', 310: 'rain', 311: 'rain', 312: 'rain',
  313: 'rain', 314: 'rain', 321: 'rain',
  500: 'rain', 501: 'rain', 502: 'rain', 503: 'rain', 504: 'rain',
  511: 'snow', 520: 'rain', 521: 'rain', 522: 'rain', 531: 'rain',
  600: 'snow', 601: 'snow', 602: 'snow', 611: 'snow', 612: 'snow',
  613: 'snow', 615: 'snow', 616: 'snow', 620: 'snow', 621: 'snow', 622: 'snow',
  701: 'fog', 711: 'fog', 721: 'fog', 731: 'fog', 741: 'fog',
  751: 'fog', 761: 'fog', 762: 'fog', 771: 'windy', 781: 'thunderstorm',
  800: 'sunny',
  801: 'partly-cloudy', 802: 'partly-cloudy', 803: 'cloudy', 804: 'cloudy',
}

export function mapCondition(weatherId: number | undefined): CanonicalWeatherCondition {
  if (weatherId == null) return 'unknown'
  return CONDITION_MAP[weatherId] ?? 'unknown'
}

export function buildCanonicalSnapshot(input: {
  destination: string
  currentRaw: Record<string, unknown> | null
  forecastRaw: Record<string, unknown> | null
  oneCallRaw: Record<string, unknown> | null
  uvIndex: number | null
}): CanonicalWeatherSnapshot {
  const cityName = readCityName(input.forecastRaw) || readCityName(input.currentRaw) || input.destination
  const hourly = parseHourly(input.forecastRaw, input.oneCallRaw)
  const daily = parseDaily(input.forecastRaw, input.oneCallRaw, input.currentRaw)
  const current = parseCurrent(input.currentRaw, cityName, input.uvIndex, hourly[0] ?? null)
  const alerts = parseAlerts(input.oneCallRaw)
  const averageHighC = daily.length
    ? Math.round(daily.reduce((s, d) => s + d.tempHighC, 0) / daily.length)
    : (current?.tempC ?? 20)
  const averageLowC = daily.length
    ? Math.round(daily.reduce((s, d) => s + d.tempLowC, 0) / daily.length)
    : (current?.tempC ?? 15)
  const season = inferSeason(daily[0]?.date ?? null)
  const summary = buildSummary({ current, daily, averageHighC, destination: cityName })
  const packingHints = buildPackingHints({ current, daily, averageHighC, averageLowC })
  const travelTips = buildTravelTips({ current, daily, alerts })

  return {
    destination: cityName,
    summary,
    averageHighC,
    averageLowC,
    season,
    current,
    hourly,
    daily,
    alerts,
    packingHints,
    travelTips,
  }
}

function parseCurrent(
  raw: Record<string, unknown> | null,
  destination: string,
  uvIndex: number | null,
  firstHourly: CanonicalHourlyForecast | null,
): CanonicalCurrentWeather | null {
  if (!raw) return null
  const main = asRecord(raw.main)
  const wind = asRecord(raw.wind)
  const weather = Array.isArray(raw.weather) ? asRecord(raw.weather[0]) : null
  const sys = asRecord(raw.sys)
  const tempC = num(main?.temp)
  if (tempC == null) return null
  const condition = mapCondition(num(weather?.id) ?? undefined)
  return {
    destination,
    observedAt: isoFromUnix(num(raw.dt)),
    tempC: Math.round(tempC),
    feelsLikeC: Math.round(num(main?.feels_like) ?? tempC),
    humidity: Math.round(num(main?.humidity) ?? 0),
    windKph: Math.round((num(wind?.speed) ?? 0) * 3.6),
    visibilityKm: num(raw.visibility) != null ? Math.round((num(raw.visibility) as number) / 1000) : null,
    uvIndex,
    condition,
    description: String(weather?.description ?? condition),
    sunrise: isoFromUnix(num(sys?.sunrise)),
    sunset: isoFromUnix(num(sys?.sunset)),
    rainProbability: firstHourly?.rainProbability ?? null,
  }
}

function parseHourly(
  forecastRaw: Record<string, unknown> | null,
  oneCallRaw: Record<string, unknown> | null,
): CanonicalHourlyForecast[] {
  const fromOneCall = Array.isArray(oneCallRaw?.hourly)
    ? (oneCallRaw!.hourly as Array<Record<string, unknown>>).slice(0, 24).map((row) => {
      const weather = Array.isArray(row.weather) ? asRecord(row.weather[0]) : null
      const tempC = Math.round(num(row.temp) ?? 0)
      return {
        at: isoFromUnix(num(row.dt)) ?? new Date().toISOString(),
        tempC,
        feelsLikeC: Math.round(num(row.feels_like) ?? tempC),
        humidity: Math.round(num(row.humidity) ?? 0),
        windKph: Math.round((num(row.wind_speed) ?? 0) * 3.6),
        visibilityKm: num(row.visibility) != null ? Math.round((num(row.visibility) as number) / 1000) : null,
        rainProbability: clamp01(num(row.pop)),
        condition: mapCondition(num(weather?.id) ?? undefined),
        description: String(weather?.description ?? ''),
      } satisfies CanonicalHourlyForecast
    })
    : []

  if (fromOneCall.length) return fromOneCall

  const list = Array.isArray(forecastRaw?.list)
    ? (forecastRaw!.list as Array<Record<string, unknown>>)
    : []
  return list.slice(0, 16).map((row) => {
    const main = asRecord(row.main)
    const wind = asRecord(row.wind)
    const weather = Array.isArray(row.weather) ? asRecord(row.weather[0]) : null
    const tempC = Math.round(num(main?.temp) ?? 0)
    return {
      at: typeof row.dt_txt === 'string' ? `${row.dt_txt.replace(' ', 'T')}Z` : (isoFromUnix(num(row.dt)) ?? ''),
      tempC,
      feelsLikeC: Math.round(num(main?.feels_like) ?? tempC),
      humidity: Math.round(num(main?.humidity) ?? 0),
      windKph: Math.round((num(wind?.speed) ?? 0) * 3.6),
      visibilityKm: num(row.visibility) != null ? Math.round((num(row.visibility) as number) / 1000) : null,
      rainProbability: clamp01(num(row.pop)),
      condition: mapCondition(num(weather?.id) ?? undefined),
      description: String(weather?.description ?? ''),
    }
  })
}

function parseDaily(
  forecastRaw: Record<string, unknown> | null,
  oneCallRaw: Record<string, unknown> | null,
  currentRaw: Record<string, unknown> | null,
): CanonicalDailyForecast[] {
  if (Array.isArray(oneCallRaw?.daily)) {
    return (oneCallRaw!.daily as Array<Record<string, unknown>>).slice(0, 8).map((row) => {
      const temp = asRecord(row.temp)
      const feels = asRecord(row.feels_like)
      const weather = Array.isArray(row.weather) ? asRecord(row.weather[0]) : null
      return {
        date: (isoFromUnix(num(row.dt)) ?? '').slice(0, 10),
        tempHighC: Math.round(num(temp?.max) ?? 0),
        tempLowC: Math.round(num(temp?.min) ?? 0),
        feelsLikeC: num(feels?.day) != null ? Math.round(num(feels?.day) as number) : null,
        humidity: Math.round(num(row.humidity) ?? 0),
        windKph: Math.round((num(row.wind_speed) ?? 0) * 3.6),
        visibilityKm: null,
        uvIndex: num(row.uvi),
        rainProbability: clamp01(num(row.pop)),
        condition: mapCondition(num(weather?.id) ?? undefined),
        description: String(weather?.description ?? ''),
        sunrise: isoFromUnix(num(row.sunrise)),
        sunset: isoFromUnix(num(row.sunset)),
      } satisfies CanonicalDailyForecast
    })
  }

  const list = Array.isArray(forecastRaw?.list)
    ? (forecastRaw!.list as Array<Record<string, unknown>>)
    : []
  const byDate = new Map<string, Array<Record<string, unknown>>>()
  for (const row of list) {
    const date = typeof row.dt_txt === 'string'
      ? row.dt_txt.slice(0, 10)
      : (isoFromUnix(num(row.dt)) ?? '').slice(0, 10)
    if (!date) continue
    const bucket = byDate.get(date) ?? []
    bucket.push(row)
    byDate.set(date, bucket)
  }

  const sys = asRecord(currentRaw?.sys)
  const sunrise = isoFromUnix(num(sys?.sunrise))
  const sunset = isoFromUnix(num(sys?.sunset))

  return [...byDate.entries()].slice(0, 5).map(([date, rows]) => {
    const temps = rows.map((r) => num(asRecord(r.main)?.temp)).filter((n): n is number => n != null)
    const feels = rows.map((r) => num(asRecord(r.main)?.feels_like)).filter((n): n is number => n != null)
    const humidity = rows.map((r) => num(asRecord(r.main)?.humidity)).filter((n): n is number => n != null)
    const wind = rows.map((r) => num(asRecord(r.wind)?.speed)).filter((n): n is number => n != null)
    const pops = rows.map((r) => num(r.pop)).filter((n): n is number => n != null)
    const mid = rows[Math.floor(rows.length / 2)] ?? rows[0]
    const weather = Array.isArray(mid.weather) ? asRecord(mid.weather[0]) : null
    const high = temps.length ? Math.max(...temps) : 0
    const low = temps.length ? Math.min(...temps) : 0
    return {
      date,
      tempHighC: Math.round(high),
      tempLowC: Math.round(low),
      feelsLikeC: feels.length ? Math.round(feels.reduce((a, b) => a + b, 0) / feels.length) : null,
      humidity: humidity.length ? Math.round(humidity.reduce((a, b) => a + b, 0) / humidity.length) : 0,
      windKph: wind.length ? Math.round((wind.reduce((a, b) => a + b, 0) / wind.length) * 3.6) : 0,
      visibilityKm: null,
      uvIndex: null,
      rainProbability: pops.length ? clamp01(Math.max(...pops)) : null,
      condition: mapCondition(num(weather?.id) ?? undefined),
      description: String(weather?.description ?? ''),
      sunrise,
      sunset,
    }
  })
}

function parseAlerts(oneCallRaw: Record<string, unknown> | null): CanonicalWeatherAlert[] {
  if (!Array.isArray(oneCallRaw?.alerts)) return []
  return (oneCallRaw!.alerts as Array<Record<string, unknown>>).map((row) => ({
    event: String(row.event ?? 'Alert'),
    severity: typeof row.tags === 'object' && Array.isArray(row.tags) && row.tags[0]
      ? String(row.tags[0])
      : null,
    start: isoFromUnix(num(row.start)),
    end: isoFromUnix(num(row.end)),
    description: String(row.description ?? ''),
    sender: typeof row.sender_name === 'string' ? row.sender_name : null,
  }))
}

function buildSummary(input: {
  current: CanonicalCurrentWeather | null
  daily: CanonicalDailyForecast[]
  averageHighC: number
  destination: string
}): string {
  const rainy = input.daily.some((d) => d.condition === 'rain' || d.condition === 'thunderstorm'
    || (d.rainProbability != null && d.rainProbability >= 0.5))
  const snowy = input.daily.some((d) => d.condition === 'snow')
  const extremeHot = input.averageHighC >= 35
  const extremeCold = input.daily.some((d) => d.tempLowC <= 0) || input.averageHighC <= 5
  const condition = input.current?.condition ?? input.daily[0]?.condition ?? 'partly-cloudy'
  if (snowy) return `Cool/snowy outlook in ${input.destination}; highs around ${input.averageHighC}°C`
  if (extremeHot) return `Hot conditions in ${input.destination}; daytime highs near ${input.averageHighC}°C — limit midday heat exposure`
  if (extremeCold) return `Cold stretch in ${input.destination}; highs around ${input.averageHighC}°C — dress in layers`
  if (rainy) return `${capitalize(condition)} with rain chances in ${input.destination}; daytime ~${input.averageHighC}°C`
  return `${capitalize(condition)} conditions in ${input.destination}; daytime ~${input.averageHighC}°C`
}

function buildPackingHints(input: {
  current: CanonicalCurrentWeather | null
  daily: CanonicalDailyForecast[]
  averageHighC: number
  averageLowC: number
}): string[] {
  const hints: string[] = []
  const rainy = input.daily.some((d) => d.condition === 'rain' || d.condition === 'thunderstorm'
    || (d.rainProbability != null && d.rainProbability >= 0.4))
  if (rainy) hints.push('Pack a compact umbrella or light rain jacket')
  if (input.averageHighC >= 28) hints.push('Bring sun protection (hat, sunscreen, light breathable clothes)')
  if (input.averageLowC <= 10) hints.push('Pack a warm layer for cool evenings')
  if (input.daily.some((d) => d.condition === 'snow')) hints.push('Bring waterproof shoes and insulated layers')
  if (input.current && input.current.uvIndex != null && input.current.uvIndex >= 6) {
    hints.push('High UV — pack strong sunscreen and sunglasses')
  }
  if (!hints.length) hints.push('Pack comfortable walking shoes and a light layer')
  return hints
}

function buildTravelTips(input: {
  current: CanonicalCurrentWeather | null
  daily: CanonicalDailyForecast[]
  alerts: CanonicalWeatherAlert[]
}): string[] {
  const tips: string[] = []
  for (const day of input.daily) {
    if (day.condition === 'rain' || day.condition === 'thunderstorm' || (day.rainProbability != null && day.rainProbability >= 0.5)) {
      tips.push(`On ${day.date}, favor indoor museums/cafés during peak rain (${Math.round((day.rainProbability ?? 0.5) * 100)}% chance)`)
    }
    if (day.tempHighC >= 35) {
      tips.push(`On ${day.date}, sightsee early morning / late afternoon — ${day.tempHighC}°C peak heat`)
    }
    if (day.tempLowC <= 0) {
      tips.push(`On ${day.date}, expect near-freezing lows (${day.tempLowC}°C) — shorten early outdoor walks`)
    }
    if (day.sunrise && day.sunset && day.condition === 'sunny') {
      tips.push(`On ${day.date}, best outdoor light between late morning and mid-afternoon`)
    }
  }
  for (const alert of input.alerts.slice(0, 2)) {
    tips.push(`Weather alert: ${alert.event}${alert.description ? ` — ${alert.description.slice(0, 120)}` : ''}`)
  }
  if (input.current?.sunrise && input.current.sunset) {
    tips.push(`Sunrise ${formatClock(input.current.sunrise)} · Sunset ${formatClock(input.current.sunset)}`)
  }
  return [...new Set(tips)].slice(0, 8)
}

function inferSeason(date: string | null): string | null {
  if (!date) return null
  const month = Number(date.slice(5, 7))
  if (!month) return null
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function readCityName(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null
  const city = asRecord(raw.city)
  if (typeof city?.name === 'string' && city.name) return city.name
  if (typeof raw.name === 'string' && raw.name) return raw.name
  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isoFromUnix(value: number | null): string | null {
  if (value == null) return null
  return new Date(value * 1000).toISOString()
}

function clamp01(value: number | null): number | null {
  if (value == null) return null
  return Math.max(0, Math.min(1, value))
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).replace(/-/g, ' ') : value
}

function formatClock(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(11, 16)
  } catch {
    return iso
  }
}
