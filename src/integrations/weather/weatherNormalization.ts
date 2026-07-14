import type { WeatherInfo, WeatherForecast, WeatherCondition } from '../../utils/contracts/models/weather'
import type { OpenWeatherForecastItem, OpenWeatherResponse } from '../api/openWeatherApiClient'

const CONDITION_MAP: Record<number, WeatherCondition> = {
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

export function mapCondition(weatherId: number): WeatherCondition {
  return CONDITION_MAP[weatherId] ?? 'partly-cloudy'
}

export function normalizeForecastItem(item: OpenWeatherForecastItem): WeatherForecast {
  const condition = item.weather.length > 0 ? mapCondition(item.weather[0].id) : 'partly-cloudy'
  const date = item.dt_txt.split(' ')[0] || new Date(item.dt * 1000).toISOString().split('T')[0]
  return {
    date,
    tempHigh: Math.round(item.main.temp_max),
    tempLow: Math.round(item.main.temp_min),
    condition,
    humidity: item.main.humidity,
    windKph: Math.round(item.wind.speed * 3.6),
  }
}

export function normalizeOpenWeatherResponse(
  raw: OpenWeatherResponse,
  providerId: string,
  destination: string,
): WeatherInfo {
  const forecasts = raw.list.map(normalizeForecastItem)
  const uniqueDates = Array.from(new Set(forecasts.map(f => f.date)))
  const dailyMap = new Map<string, WeatherForecast>()
  for (const date of uniqueDates) {
    const dayItems = forecasts.filter(f => f.date === date)
    if (dayItems.length === 0) continue
    dailyMap.set(date, {
      date,
      tempHigh: Math.max(...dayItems.map(f => f.tempHigh)),
      tempLow: Math.min(...dayItems.map(f => f.tempLow)),
      condition: dayItems[0].condition,
      humidity: Math.round(dayItems.reduce((s, f) => s + f.humidity, 0) / dayItems.length),
      windKph: Math.round(dayItems.reduce((s, f) => s + f.windKph, 0) / dayItems.length),
    })
  }
  const dailyForecasts = Array.from(dailyMap.values()).slice(0, 5)
  const forecastPeriod = dailyForecasts.length > 0
    ? `${dailyForecasts[0].date} to ${dailyForecasts[dailyForecasts.length - 1].date}`
    : 'N/A'
  const avgTemp = dailyForecasts.length > 0
    ? Math.round(dailyForecasts.reduce((s, f) => s + (f.tempHigh + f.tempLow) / 2, 0) / dailyForecasts.length)
    : 20
  const summary = buildSummary(dailyForecasts, avgTemp)

  return {
    id: `OPENWEATHER-${raw.city?.id ?? Date.now()}`,
    providerId,
    destination,
    forecastPeriod,
    bestSeason: '',
    currentSummary: summary,
    forecasts: dailyForecasts,
  }
}

function buildSummary(forecasts: WeatherForecast[], avgTemp: number): string {
  const hasRain = forecasts.some(f => f.condition === 'rain' || f.condition === 'thunderstorm')
  const hasSnow = forecasts.some(f => f.condition === 'snow')
  const allSunny = forecasts.every(f => f.condition === 'sunny' || f.condition === 'partly-cloudy')
  if (hasSnow) return `طقس بارد مع احتمال تساقط ثلوج، متوسط الحرارة ${avgTemp}°م`
  if (hasRain) return `طقس معتدل مع احتمال أمطار، متوسط الحرارة ${avgTemp}°م`
  if (allSunny) return `طقس مشمس جميل، متوسط الحرارة ${avgTemp}°م`
  return `طقس معتدل، متوسط الحرارة ${avgTemp}°م`
}

export interface WeatherTravelScore {
  temperature: number
  condition: WeatherCondition
  humidity: number
  wind: number
  visibility: number
  travelScore: number
  summary: string
  recommendation: string
}

export function computeTravelScore(info: WeatherInfo, visibilityMeters: number | null): WeatherTravelScore {
  const forecasts = info.forecasts
  if (forecasts.length === 0) {
    return {
      temperature: 20,
      condition: 'partly-cloudy',
      humidity: 60,
      wind: 15,
      visibility: visibilityMeters !== null ? Math.round(visibilityMeters / 1000) : 10,
      travelScore: 50,
      summary: info.currentSummary || 'لا تتوفر بيانات كافية',
      recommendation: 'يُنصح بالتحقق من الطقس قبل السفر',
    }
  }

  const avgHigh = forecasts.reduce((s, f) => s + f.tempHigh, 0) / forecasts.length
  const avgLow = forecasts.reduce((s, f) => s + f.tempLow, 0) / forecasts.length
  const avgTemp = Math.round((avgHigh + avgLow) / 2)
  const avgHumidity = Math.round(forecasts.reduce((s, f) => s + f.humidity, 0) / forecasts.length)
  const avgWind = Math.round(forecasts.reduce((s, f) => s + f.windKph, 0) / forecasts.length)
  const primaryCondition = forecasts[0].condition
  const visibilityKm = visibilityMeters !== null ? Math.round(visibilityMeters / 1000) : 10

  let score = 70
  if (avgTemp >= 18 && avgTemp <= 28) score += 20
  else if (avgTemp >= 10 && avgTemp <= 35) score += 10
  else if (avgTemp < 0 || avgTemp > 40) score -= 20

  if (primaryCondition === 'sunny' || primaryCondition === 'partly-cloudy') score += 10
  if (primaryCondition === 'rain') score -= 10
  if (primaryCondition === 'thunderstorm') score -= 20
  if (primaryCondition === 'snow') score -= 5
  if (primaryCondition === 'fog') score -= 10

  if (avgHumidity > 80) score -= 5
  if (avgHumidity < 30) score -= 5
  if (avgWind > 30) score -= 10
  if (visibilityKm < 5) score -= 10

  score = Math.max(0, Math.min(100, score))

  const recommendation = score >= 75
    ? 'طقس ممتاز للسفر، يُنصح بالاستمتاع بالأنشطة الخارجية'
    : score >= 50
      ? 'طقس مناسب للسفر مع مراعاة بعض الظروف'
      : 'طقس غير مثالي، يُنصح بإعادة النظر في موعد الرحلة'

  return {
    temperature: avgTemp,
    condition: primaryCondition,
    humidity: avgHumidity,
    wind: avgWind,
    visibility: visibilityKm,
    travelScore: score,
    summary: info.currentSummary,
    recommendation,
  }
}
