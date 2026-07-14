export type WeatherCondition =
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'fog'
  | 'windy'

export interface WeatherForecast {
  date: string
  tempHigh: number
  tempLow: number
  condition: WeatherCondition
  humidity: number
  windKph: number
}

export interface WeatherInfo {
  id: string
  providerId: string
  destination: string
  forecastPeriod: string
  bestSeason: string
  currentSummary: string
  forecasts: WeatherForecast[]
}
