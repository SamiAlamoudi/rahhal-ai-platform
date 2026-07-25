/**
 * Integration Sprint 3 — rank hotels + explain WHY (consultant language).
 */

import type { HotelRankReason, RankedConversationHotel } from './types'

export type ConversationHotelRankPrefs = {
  preferredArea?: string | null
  hotelPreference?: string | null
  breakfastRequired?: boolean | null
  freeCancellationRequired?: boolean | null
  amenities?: string[]
  maxNightly?: number | null
  tripPurpose?: string | null
  budgetStyle?: string | null
}

type RankableHotel = {
  id: string
  hotelId: string
  providerId: string
  hotelName: string
  city: string | null
  area?: string | null
  stars: number | null
  rating: number | null
  reviewCount?: number | null
  pricePerNight: number | null
  totalPrice?: number | null
  currency: string
  roomType?: string | null
  boardType?: string | null
  breakfastIncluded: boolean
  freeCancellation: boolean
  refundable: boolean
  amenities: string[]
  images?: string[]
  distanceKm?: number | null
}

function amenityMatchScore(hotel: RankableHotel, wanted: string[]): number {
  if (!wanted.length) return 0.7
  const set = hotel.amenities.map((a) => a.toLowerCase())
  const hit = wanted.filter((w) => set.some((a) => a.includes(w.toLowerCase()))).length
  return hit / wanted.length
}

function locationScore(hotel: RankableHotel, prefs: ConversationHotelRankPrefs): number {
  const area = (hotel.area ?? hotel.city ?? '').toLowerCase()
  const pref = (prefs.preferredArea ?? prefs.hotelPreference ?? '').toLowerCase()
  if (!pref) {
    if (prefs.hotelPreference === 'near_airport') {
      return hotel.amenities.some((a) => /airport|shuttle/i.test(a)) ? 0.95 : 0.55
    }
    return hotel.distanceKm != null ? Math.max(0.2, 1 - Math.min(hotel.distanceKm, 20) / 20) : 0.65
  }
  if (pref.includes('central') || pref.includes('downtown') || pref.includes('وسط')) {
    return /center|central|downtown|وسط|marina|corniche/i.test(area) ? 1 : 0.45
  }
  if (pref.includes('beach') || pref.includes('شاطئ')) {
    return /beach|sea|marina|شاطئ/i.test(area)
      || hotel.amenities.some((a) => /beach|pool/i.test(a))
      ? 1
      : 0.4
  }
  if (pref && area.includes(pref)) return 1
  return 0.5
}

function buildReasons(
  hotel: RankableHotel,
  prefs: ConversationHotelRankPrefs,
  cohort: {
    minPrice: number
    maxPrice: number
    minRating: number
    maxRating: number
  },
): HotelRankReason[] {
  const reasons: HotelRankReason[] = []
  const price = hotel.pricePerNight ?? cohort.maxPrice
  if (price <= cohort.minPrice + (cohort.maxPrice - cohort.minPrice) * 0.3) {
    reasons.push({
      code: 'price',
      labelAr: 'يناسب ميزانيتك',
      labelEn: 'Fits your budget',
      weight: 0.25,
    })
  }
  if ((hotel.rating ?? 0) >= Math.max(4, cohort.minRating + (cohort.maxRating - cohort.minRating) * 0.6)) {
    reasons.push({
      code: 'rating',
      labelAr: 'تقييم ضيوف مرتفع',
      labelEn: 'Strong guest rating',
      weight: 0.2,
    })
  }
  if ((hotel.reviewCount ?? 0) >= 100) {
    reasons.push({
      code: 'reviews',
      labelAr: 'آراء كثيرة من المسافرين',
      labelEn: 'Many traveler reviews',
      weight: 0.1,
    })
  }
  if (hotel.distanceKm != null && hotel.distanceKm <= 3) {
    reasons.push({
      code: 'distance',
      labelAr: `قريب من موقعك (~${hotel.distanceKm.toFixed(1)} كم)`,
      labelEn: `Close to your location (~${hotel.distanceKm.toFixed(1)} km)`,
      weight: 0.15,
    })
  } else if (locationScore(hotel, prefs) >= 0.9) {
    reasons.push({
      code: 'location',
      labelAr: 'موقع يناسب تفضيلك',
      labelEn: 'Location matches your preference',
      weight: 0.15,
    })
  }
  if (hotel.breakfastIncluded || prefs.breakfastRequired) {
    if (hotel.breakfastIncluded) {
      reasons.push({
        code: 'breakfast',
        labelAr: 'يشمل الإفطار',
        labelEn: 'Includes breakfast',
        weight: 0.12,
      })
    }
  }
  if (hotel.freeCancellation || hotel.refundable) {
    reasons.push({
      code: 'cancellation',
      labelAr: 'إلغاء مجاني / مرن',
      labelEn: 'Free / flexible cancellation',
      weight: 0.12,
    })
  }
  const wanted = prefs.amenities ?? []
  if (wanted.length && amenityMatchScore(hotel, wanted) >= 0.5) {
    reasons.push({
      code: 'amenities',
      labelAr: 'مرافق طلبتها متوفرة',
      labelEn: 'Has amenities you asked for',
      weight: 0.12,
    })
  }
  if ((hotel.stars ?? 0) >= 4) {
    reasons.push({
      code: 'stars',
      labelAr: `${hotel.stars} نجوم`,
      labelEn: `${hotel.stars}-star property`,
      weight: 0.08,
    })
  }
  if (prefs.tripPurpose === 'business' && hotel.amenities.some((a) => /gym|wifi|business|desk/i.test(a))) {
    reasons.push({
      code: 'preference_match',
      labelAr: 'مناسب لرحلات العمل',
      labelEn: 'Suited for business travel',
      weight: 0.1,
    })
  }
  if (prefs.tripPurpose === 'family' && hotel.amenities.some((a) => /family|pool|kids/i.test(a))) {
    reasons.push({
      code: 'preference_match',
      labelAr: 'مناسب للعائلات',
      labelEn: 'Family-friendly',
      weight: 0.1,
    })
  }
  return reasons.slice(0, 4)
}

export function scoreConversationHotel(
  hotel: RankableHotel,
  prefs: ConversationHotelRankPrefs,
  cohort: {
    minPrice: number
    maxPrice: number
    minRating: number
    maxRating: number
    minDistance: number
    maxDistance: number
  },
): number {
  const price = hotel.pricePerNight ?? cohort.maxPrice
  const rating = hotel.rating ?? cohort.minRating
  const distance = hotel.distanceKm ?? cohort.maxDistance
  const priceRange = Math.max(1, cohort.maxPrice - cohort.minPrice)
  const ratingRange = Math.max(0.1, cohort.maxRating - cohort.minRating)
  const distanceRange = Math.max(0.1, cohort.maxDistance - cohort.minDistance)

  const priceScore = 1 - (price - cohort.minPrice) / priceRange
  const ratingScore = (rating - cohort.minRating) / ratingRange
  const reviewScore = Math.min(1, (hotel.reviewCount ?? 0) / 500)
  const distanceScore = 1 - (distance - cohort.minDistance) / distanceRange
  const starsScore = Math.min(1, (hotel.stars ?? 0) / 5)
  const amenityScore = Math.min(1, hotel.amenities.length / 8)
  const cancelScore = hotel.freeCancellation || hotel.refundable ? 1 : 0.35
  const breakfastScore = hotel.breakfastIncluded ? 1 : prefs.breakfastRequired ? 0.2 : 0.6
  const loc = locationScore(hotel, prefs)
  const prefAmenities = amenityMatchScore(hotel, prefs.amenities ?? [])
  const confidence = hotel.providerId === 'amadeus' || hotel.providerId === 'booking' ? 0.92 : 0.55

  return (
    priceScore * 0.2
    + ratingScore * 0.16
    + distanceScore * 0.12
    + loc * 0.1
    + reviewScore * 0.08
    + starsScore * 0.08
    + amenityScore * 0.06
    + prefAmenities * 0.06
    + cancelScore * 0.06
    + breakfastScore * 0.04
    + confidence * 0.04
  )
}

export function rankConversationHotels(
  hotels: RankableHotel[],
  prefs: ConversationHotelRankPrefs = {},
): RankedConversationHotel[] {
  if (hotels.length === 0) return []
  const prices = hotels.map((h) => h.pricePerNight ?? 0)
  const ratings = hotels.map((h) => h.rating ?? 0)
  const distances = hotels.map((h) => h.distanceKm ?? 0)
  const cohort = {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minRating: Math.min(...ratings),
    maxRating: Math.max(...ratings),
    minDistance: Math.min(...distances),
    maxDistance: Math.max(...distances),
  }

  return hotels
    .map((hotel) => {
      const reasons = buildReasons(hotel, prefs, cohort)
      const score = scoreConversationHotel(hotel, prefs, cohort)
      const whyAr = reasons.length ? reasons.map((r) => r.labelAr).join(' · ') : 'خيار متوازن للإقامة'
      const whyEn = reasons.length
        ? reasons.map((r) => r.labelEn).join(' · ')
        : 'Balanced stay option'
      return {
        id: hotel.id,
        hotelId: hotel.hotelId,
        providerId: hotel.providerId,
        hotelName: hotel.hotelName,
        city: hotel.city,
        area: hotel.area ?? hotel.city,
        stars: hotel.stars,
        rating: hotel.rating,
        reviewCount: hotel.reviewCount ?? null,
        pricePerNight: hotel.pricePerNight,
        totalPrice: hotel.totalPrice ?? null,
        currency: hotel.currency,
        roomType: hotel.roomType ?? null,
        boardType: hotel.boardType ?? null,
        breakfastIncluded: hotel.breakfastIncluded,
        freeCancellation: hotel.freeCancellation,
        refundable: hotel.refundable,
        amenities: hotel.amenities,
        images: hotel.images ?? [],
        distanceKm: hotel.distanceKm ?? null,
        score,
        reasons,
        whyAr,
        whyEn,
      }
    })
    .sort((a, b) => b.score - a.score)
}
