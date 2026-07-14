import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { WeatherInfo } from '../models/weather'

export interface WeatherProvider extends ProviderContract {
  getWeatherInfo(req: ProviderRequest): Promise<ProviderResult<WeatherInfo>>
}
