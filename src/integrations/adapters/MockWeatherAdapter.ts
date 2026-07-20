import type { WeatherProvider, ProviderRequest } from '../../utils/contracts/providers'
import type { WeatherInfo, WeatherForecast } from '../../utils/contracts/models'
import type { ProviderResult } from '../../utils/contracts/result'
import type { ProviderCapabilities } from '../../utils/contracts/capabilities'
import { okResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'

const METADATA: ProviderMetadata = {
  id: 'mock-weather-001',
  name: 'Mock Weather Provider',
  priority: 5,
  enabled: true,
  type: 'weather',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsRealtime: true,
}

function buildForecasts(): WeatherForecast[] {
  return [
    { date: '2026-10-15', tempHigh: 22, tempLow: 16, condition: 'partly-cloudy', humidity: 60, windKph: 15 },
    { date: '2026-10-16', tempHigh: 20, tempLow: 14, condition: 'cloudy', humidity: 70, windKph: 18 },
    { date: '2026-10-17', tempHigh: 19, tempLow: 13, condition: 'rain', humidity: 80, windKph: 22 },
    { date: '2026-10-18', tempHigh: 21, tempLow: 15, condition: 'sunny', humidity: 55, windKph: 12 },
    { date: '2026-10-19', tempHigh: 23, tempLow: 17, condition: 'sunny', humidity: 50, windKph: 10 },
  ]
}

function buildWeatherInfo(destination: string): WeatherInfo {
  return {
    id: 'MOCK-WEATHER-001',
    providerId: METADATA.id,
    destination,
    forecastPeriod: '2026-10-15 to 2026-10-19',
    bestSeason: 'الربيع (مارس-مايو) والخريف (أكتوبر-نوفمبر)',
    currentSummary: 'طقس معتدل مع احتمال أمطار خفيفة في منتصف الرحلة',
    forecasts: buildForecasts(),
  }
}

export class MockWeatherAdapter implements WeatherProvider {
  readonly metadata = METADATA

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async getWeatherInfo(req: ProviderRequest): Promise<ProviderResult<WeatherInfo>> {
    const start = Date.now()
    const data = buildWeatherInfo(req.search.destination || 'Unknown')
    return okResult(METADATA.id, METADATA.name, data, Date.now() - start, 'mock')
  }
}
