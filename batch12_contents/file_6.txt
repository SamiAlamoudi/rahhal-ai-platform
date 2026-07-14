import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { HotelOffer } from '../models/hotel'

export interface HotelProvider extends ProviderContract {
  searchHotels(req: ProviderRequest): Promise<ProviderResult<HotelOffer[]>>
}
