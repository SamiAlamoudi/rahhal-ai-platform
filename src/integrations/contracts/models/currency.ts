export interface CurrencyRate {
  base: string
  quote: string
  rate: number
  fetchedAt: string
}

export interface CurrencyInfo {
  id: string
  providerId: string
  base: string
  rates: CurrencyRate[]
  fetchedAt: string
}
