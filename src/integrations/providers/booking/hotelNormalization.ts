import type { HotelOffer, RoomType } from '../../../utils/contracts/models/hotel'
import type { BookingComHotelResult, BookingComSearchResponse } from './bookingComApiClient'

export interface Hotel {
  name: string
  rating: number
  stars: number
  price: number
  currency: string
  latitude: number
  longitude: number
  images: string[]
  amenities: string[]
  roomType: string
  breakfastIncluded: boolean
  refundable: boolean
  distanceFromCenter: number
  provider: string
  providerId: string
  bookingUrl: string
}

function parseFloatSafe(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const n = parseFloat(value)
  return isNaN(n) ? fallback : n
}

function extractImages(result: BookingComHotelResult): string[] {
  if (!result.photos || !Array.isArray(result.photos)) return []
  return result.photos.slice(0, 5).map(p => p.url_max1080 || p.url_1440 || p.url_original).filter(Boolean)
}

function extractAmenities(result: BookingComHotelResult): string[] {
  if (!result.facilities || !Array.isArray(result.facilities)) return []
  return result.facilities.map(f => f.name).filter(Boolean)
}

function extractRoomType(result: BookingComHotelResult): string {
  if (!result.room_data || result.room_data.length === 0) return 'Standard Room'
  const room = result.room_data[0]
  const bedInfo = room.bed_configurations?.[0]?.bed_types?.[0]
  return bedInfo ? `${room.room_name} (${bedInfo.count}x ${bedInfo.name})` : room.room_name || 'Standard Room'
}

function extractRoomTypes(result: BookingComHotelResult): RoomType[] {
  if (!result.room_data || result.room_data.length === 0) return []
  return result.room_data.slice(0, 3).map(room => {
    const bedType = room.bed_configurations?.[0]?.bed_types?.[0]?.name ?? 'standard'
    const bedCount = room.bed_configurations?.[0]?.bed_types?.[0]?.count ?? 1
    return {
      name: room.room_name || 'Standard Room',
      capacity: bedCount,
      bedType,
      count: 1,
    }
  })
}

function extractRefundable(result: BookingComHotelResult): boolean {
  if (!result.cancellation) return false
  return /free|gratuit|مجاني/i.test(result.cancellation)
}

export function normalizeBookingComHotel(
  result: BookingComHotelResult,
  providerId: string,
): Hotel {
  return {
    name: result.hotel_name || 'Unknown Hotel',
    rating: result.review_score ?? 0,
    stars: result.hotel_class ?? 0,
    price: parseFloatSafe(result.product_price, 0),
    currency: result.currency_code || 'SAR',
    latitude: parseFloatSafe(result.latitude, 0),
    longitude: parseFloatSafe(result.longitude, 0),
    images: extractImages(result),
    amenities: extractAmenities(result),
    roomType: extractRoomType(result),
    breakfastIncluded: result.mealplan_included ?? false,
    refundable: extractRefundable(result),
    distanceFromCenter: result.distance_to_city_center_km ?? 0,
    provider: 'booking',
    providerId,
    bookingUrl: result.url || '',
  }
}

export function normalizeBookingComToHotelOffer(
  result: BookingComHotelResult,
  providerId: string,
  checkIn: string,
  checkOut: string,
): HotelOffer {
  const price = parseFloatSafe(result.product_price, 0)
  const grossPerNight = result.product_price_breakdown?.gross_amount_per_night
  const originalPrice = grossPerNight && grossPerNight.length > 0
    ? parseFloatSafe(grossPerNight[0].amount, 0)
    : null

  return {
    id: String(result.hotel_id),
    providerId,
    title: result.hotel_name || 'Unknown Hotel',
    currency: result.currency_code || 'SAR',
    price: Math.round(price * 100) / 100,
    originalPrice: originalPrice !== null && originalPrice > price
      ? Math.round(originalPrice * 100) / 100
      : null,
    rating: result.review_score ? Math.round(result.review_score * 10) / 10 : null,
    hotelStars: result.hotel_class ?? 0,
    location: result.address || result.city || '',
    area: result.city || null,
    checkIn,
    checkOut,
    familyFriendly: extractRoomTypes(result).some(r => r.capacity >= 3),
    breakfastIncluded: result.mealplan_included ?? false,
    freeCancellation: extractRefundable(result),
    amenities: extractAmenities(result),
    roomTypes: extractRoomTypes(result),
  }
}

export function normalizeBookingComResponse(
  response: BookingComSearchResponse,
  providerId: string,
  checkIn: string,
  checkOut: string,
): HotelOffer[] {
  if (!response.result || !Array.isArray(response.result)) return []
  return response.result.map(result =>
    normalizeBookingComToHotelOffer(result, providerId, checkIn, checkOut),
  )
}

export function normalizeToHotelModel(
  response: BookingComSearchResponse,
  providerId: string,
): Hotel[] {
  if (!response.result || !Array.isArray(response.result)) return []
  return response.result.map(result =>
    normalizeBookingComHotel(result, providerId),
  )
}
