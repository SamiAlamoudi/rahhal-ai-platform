import type { ProviderResult } from '../result'
import type { ProviderContract, ProviderRequest } from './base'
import type { Vehicle } from '../models/rentalCar'

export interface RentalCarProvider extends ProviderContract {
  searchRentalCars(req: ProviderRequest): Promise<ProviderResult<Vehicle[]>>
}
