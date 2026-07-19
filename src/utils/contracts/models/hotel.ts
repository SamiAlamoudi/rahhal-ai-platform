export interface RoomType {
  name: string
  capacity: number
  bedType: string
  count: number
}

export interface HotelOffer {
  id: string
  providerId: string
  title: string
  currency: string
  price: number
  originalPrice: number | null
  rating: number | null
  hotelStars: number
  location: string
  area: string | null
  checkIn: string
  checkOut: string
  familyFriendly: boolean
  breakfastIncluded: boolean
  freeCancellation: boolean
  amenities: string[]
  roomTypes: RoomType[]
  /** Sprint 30 additive enrichment (optional; older adapters omit). */
  images?: string[]
  guestReviewCount?: number
  guestReviewLabel?: string | null
  taxesAndFeesTotal?: number
  cancellationSummary?: string
  nightly?: number
  sandbox?: boolean
}
