import type { WeatherProvider, WeatherInfo, ProviderRequest, ProviderResult, ProviderCapabilities } from '../../utils/contracts'
import { okResult, errorResult } from '../../utils/contracts/result'
import { defaultCapabilities } from '../../utils/contracts/capabilities'
import type { ProviderMetadata } from '../../utils/contracts/metadata'
import { OpenWeatherApiClient, type ApiClientConfig } from '../api/openWeatherApiClient'
import { normalizeOpenWeatherResponse } from '../weather/weatherNormalization'

const METADATA: ProviderMetadata = {
  id: 'openweather-001',
  name: 'OpenWeather Real Provider',
  priority: 5,
  enabled: true,
  type: 'weather',
  version: '1.0.0',
}

const CAPABILITIES: ProviderCapabilities = {
  ...defaultCapabilities(),
  supportsRealtime: true,
}

export interface RealWeatherAdapterConfig {
  apiKey: string
  baseUrl: string
  timeout: number
  maxRetries: number
}

export class RealWeatherAdapter implements WeatherProvider {
  readonly metadata = METADATA
  private client: OpenWeatherApiClient

  constructor(config: RealWeatherAdapterConfig) {
    const clientConfig: ApiClientConfig = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || 'https://api.openweathermap.org/data/2.5',
      timeout: config.timeout || 5000,
      maxRetries: config.maxRetries || 2,
    }
    this.client = new OpenWeatherApiClient(clientConfig)
  }

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES
  }

  async getWeatherInfo(req: ProviderRequest): Promise<ProviderResult<WeatherInfo>> {
    const start = Date.now()
    const destination = req.search.destination || 'Unknown'
    const result = await this.client.getForecast(destination)
    const latency = Date.now() - start

    if (result.error || !result.data) {
      return errorResult<WeatherInfo>(
        METADATA.id,
        METADATA.name,
        result.error ? [result.error] : [{
          code: 'NO_DATA',
          category: 'provider',
          severity: 'error',
          message: 'No data returned from OpenWeather',
          retryable: false,
          timestamp: new Date().toISOString(),
        }],
        latency,
        'openweather',
      )
    }

    const data = normalizeOpenWeatherResponse(result.data, METADATA.id, destination)
    return okResult(METADATA.id, METADATA.name, data, latency, 'openweather')
  }
}
