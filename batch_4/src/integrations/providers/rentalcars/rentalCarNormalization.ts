import type { Vehicle, VehicleCategory, TransmissionType, FuelType } from '../../../utils/contracts/models/rentalCar'
import type { RentalCarsSearchResult, RentalCarsSearchResponse } from './rentalCarsApiClient'

const CATEGORY_MAP: Record<string, VehicleCategory> = {
  mini: 'mini',
  economy: 'economy',
  compact: 'compact',
  midsize: 'midsize',
  intermediate: 'midsize',
  standard: 'standard',
  fullsize: 'fullsize',
  'full-size': 'fullsize',
  luxury: 'luxury',
  premium: 'luxury',
  suv: 'suv',
  van: 'van',
  minivan: 'van',
  convertible: 'convertible',
}

export function mapCategory(raw: string | undefined): VehicleCategory {
  if (!raw) return 'economy'
  return CATEGORY_MAP[raw.toLowerCase()] ?? 'economy'
}

export function mapTransmission(raw: string | undefined): TransmissionType {
  if (!raw) return 'manual'
  return raw.toLowerCase().startsWith('auto') ? 'automatic' : 'manual'
}

export function mapFuelType(raw: string | undefined): FuelType {
  if (!raw) return 'petrol'
  const lower = raw.toLowerCase()
  if (lower.includes('diesel')) return 'diesel'
  if (lower.includes('hybrid')) return 'hybrid'
  if (lower.includes('electric') || lower.includes('ev')) return 'electric'
  return 'petrol'
}

function parseFloatSafe(value: string | number | undefined, fallback: number): number {
  if (value === undefined || value === null) return fallback
  const n = typeof value === 'number' ? value : parseFloat(value)
  return isNaN(n) ? fallback : n
}

export function normalizeRentalCar(
  result: RentalCarsSearchResult,
  providerId: string,
  pickupDate: string,
  dropoffDate: string,
): Vehicle {
  return {
    provider: 'rentalcars',
    providerId,
    company: result.vendor_name || 'Unknown',
    vehicleName: result.vehicle_name || 'Unknown Vehicle',
    category: mapCategory(result.category),
    transmission: mapTransmission(result.transmission),
    fuelType: mapFuelType(result.fuel_type),
    seats: result.seats ?? 4,
    doors: result.doors ?? 4,
    airConditioning: result.air_conditioning ?? true,
    luggageLarge: result.luggage_large ?? 0,
    luggageSmall: result.luggage_small ?? 0,
    price: parseFloatSafe(result.total_price || result.price_per_day, 0),
    currency: result.currency || 'SAR',
    pickupLocation: result.pickup_location || '',
    dropoffLocation: result.dropoff_location || result.pickup_location || '',
    pickupDate,
    dropoffDate,
    unlimitedMileage: result.unlimited_mileage ?? false,
    insuranceIncluded: result.insurance_included ?? false,
    rating: result.rating ?? 0,
    image: result.image_url || '',
    bookingUrl: result.booking_url || '',
  }
}

export function normalizeRentalCarsResponse(
  response: RentalCarsSearchResponse,
  providerId: string,
  pickupDate: string,
  dropoffDate: string,
): Vehicle[] {
  if (!response.results || !Array.isArray(response.results)) return []
  return response.results.map(result =>
    normalizeRentalCar(result, providerId, pickupDate, dropoffDate),
  )
}
