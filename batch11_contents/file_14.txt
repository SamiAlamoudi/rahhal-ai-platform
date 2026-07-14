export type VehicleCategory =
  | 'mini'
  | 'economy'
  | 'compact'
  | 'midsize'
  | 'standard'
  | 'fullsize'
  | 'luxury'
  | 'suv'
  | 'van'
  | 'convertible'

export type TransmissionType = 'manual' | 'automatic'
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric'

export interface Vehicle {
  provider: string
  providerId: string
  company: string
  vehicleName: string
  category: VehicleCategory
  transmission: TransmissionType
  fuelType: FuelType
  seats: number
  doors: number
  airConditioning: boolean
  luggageLarge: number
  luggageSmall: number
  price: number
  currency: string
  pickupLocation: string
  dropoffLocation: string
  pickupDate: string
  dropoffDate: string
  unlimitedMileage: boolean
  insuranceIncluded: boolean
  rating: number
  image: string
  bookingUrl: string
}
