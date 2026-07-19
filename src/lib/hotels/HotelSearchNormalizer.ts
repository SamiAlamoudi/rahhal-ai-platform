/**
 * Sprint 30 — HotelSearchNormalizer: vendor-shaped rows → NormalizedHotelResult.
 */

import type {
  HotelCancellationPolicy,
  HotelGuestReviews,
  HotelImage,
  HotelProviderId,
  HotelRoomAvailability,
  HotelTaxesAndFees,
  NormalizedHotelResult,
} from './types'

/** Loose vendor payload accepted by the normalizer (sandbox + future live). */
export interface RawHotelVendorPayload {
  id?: string
  hotelId?: string
  name?: string
  hotelName?: string
  title?: string
  description?: string | null
  currency?: string
  currencyCode?: string
  price?: number | string
  totalPrice?: number | string
  nightly?: number | string
  originalPrice?: number | string | null
  stars?: number | string
  starRating?: number | string
  hotelClass?: number | string
  rating?: number | string
  reviewScore?: number | string
  reviewCount?: number | string
  reviewLabel?: string | null
  location?: string
  address?: string
  area?: string | null
  city?: string
  latitude?: number | string | null
  longitude?: number | string | null
  checkIn?: string
  checkOut?: string
  nights?: number
  familyFriendly?: boolean
  breakfastIncluded?: boolean
  mealPlan?: string | null
  amenities?: string[] | Array<{ name?: string }>
  facilities?: string[] | Array<{ name?: string }>
  images?: Array<string | { url?: string; caption?: string | null; isPrimary?: boolean }>
  photos?: Array<{ url?: string; url_max1080?: string; caption?: string }>
  rooms?: RawHotelRoomPayload[]
  roomTypes?: RawHotelRoomPayload[]
  cancellation?: string | RawCancellationPayload | null
  freeCancellation?: boolean
  taxes?: number | string
  fees?: number | string
  taxesAndFees?: Partial<HotelTaxesAndFees> | null
  bookingUrl?: string | null
  url?: string | null
  sandbox?: boolean
}

export interface RawHotelRoomPayload {
  roomId?: string
  id?: string
  name?: string
  roomName?: string
  bedType?: string
  capacity?: number
  available?: number
  count?: number
  board?: string | null
  nightly?: number | string
  price?: number | string
  currency?: string
  freeCancellation?: boolean
  breakfastIncluded?: boolean
}

export interface RawCancellationPayload {
  freeCancellation?: boolean
  deadline?: string | null
  penaltyAmount?: number | null
  currency?: string | null
  summary?: string
}

export interface HotelNormalizeContext {
  providerId: HotelProviderId
  checkIn: string
  checkOut: string
  nights?: number
  currency?: string
  sandbox?: boolean
  index?: number
}

export class HotelSearchNormalizer {
  normalizeMany(
    rows: RawHotelVendorPayload[],
    ctx: HotelNormalizeContext,
  ): NormalizedHotelResult[] {
    return rows.map((row, index) => this.normalizeOne(row, { ...ctx, index }))
  }

  normalizeOne(row: RawHotelVendorPayload, ctx: HotelNormalizeContext): NormalizedHotelResult {
    const nights = Math.max(1, ctx.nights ?? nightsBetween(ctx.checkIn, ctx.checkOut))
    const currency = String(row.currency ?? row.currencyCode ?? ctx.currency ?? 'SAR')
    const nightly = pickNumber(row.nightly, deriveNightly(row, nights))
    const price = pickNumber(row.price, row.totalPrice, nightly * nights)
    const starRating = clampStars(
      pickNumber(row.starRating, row.stars, row.hotelClass, 4),
    )
    const guestReviews = normalizeReviews(row)
    const amenities = normalizeAmenities(row)
    const images = normalizeImages(row)
    const rooms = normalizeRooms(row, currency, nightly)
    const cancellation = normalizeCancellation(row, currency)
    const taxesAndFees = normalizeTaxes(row, currency, price)

    const id = String(
      row.id
      ?? row.hotelId
      ?? `${ctx.providerId}-${ctx.index ?? 0}-${slug(row.name ?? row.hotelName ?? row.title ?? 'hotel')}`,
    )

    return {
      id,
      providerId: ctx.providerId,
      name: String(row.name ?? row.hotelName ?? row.title ?? 'Hotel'),
      description: row.description ?? null,
      currency,
      price: roundMoney(price),
      nightly: roundMoney(nightly),
      originalPrice: row.originalPrice == null ? null : pickNumber(row.originalPrice, null),
      starRating,
      guestReviews,
      location: String(row.location ?? row.address ?? row.city ?? row.area ?? 'City center'),
      area: row.area ?? row.city ?? null,
      latitude: toNullableNumber(row.latitude),
      longitude: toNullableNumber(row.longitude),
      checkIn: ctx.checkIn,
      checkOut: ctx.checkOut,
      nights,
      familyFriendly: Boolean(row.familyFriendly ?? amenities.some((a) => /family|kids/i.test(a))),
      breakfastIncluded: Boolean(
        row.breakfastIncluded
        ?? /breakfast/i.test(String(row.mealPlan ?? ''))
        ?? amenities.some((a) => /breakfast/i.test(a)),
      ),
      amenities,
      images,
      rooms,
      cancellation,
      taxesAndFees,
      bookingUrl: row.bookingUrl ?? row.url ?? null,
      sandbox: Boolean(row.sandbox ?? ctx.sandbox ?? true),
    }
  }
}

export const hotelSearchNormalizer = new HotelSearchNormalizer()

function deriveNightly(row: RawHotelVendorPayload, nights: number): number {
  const total = pickNumber(row.price, row.totalPrice, 0)
  if (total > 0 && nights > 1 && total > 400) {
    return total / nights
  }
  if (total > 0) return total
  return 350
}

function normalizeReviews(row: RawHotelVendorPayload): HotelGuestReviews {
  const score = toNullableNumber(row.reviewScore ?? row.rating)
  return {
    score,
    count: Math.max(0, Math.round(pickNumber(row.reviewCount, score != null ? 120 : 0))),
    label: row.reviewLabel ?? (score != null ? reviewLabel(score) : null),
  }
}

function reviewLabel(score: number): string {
  if (score >= 9) return 'Superb'
  if (score >= 8) return 'Very good'
  if (score >= 7) return 'Good'
  if (score >= 6) return 'Pleasant'
  return 'Review score'
}

function normalizeAmenities(row: RawHotelVendorPayload): string[] {
  const source = row.amenities ?? row.facilities ?? []
  const names = source
    .map((item) => (typeof item === 'string' ? item : item?.name))
    .filter((v): v is string => Boolean(v && String(v).trim()))
  return [...new Set(names.map((n) => n.trim()))]
}

function normalizeImages(row: RawHotelVendorPayload): HotelImage[] {
  const fromImages = (row.images ?? []).map((img, index) => {
    if (typeof img === 'string') {
      return { url: img, caption: null, isPrimary: index === 0 }
    }
    return {
      url: String(img.url ?? ''),
      caption: img.caption ?? null,
      isPrimary: Boolean(img.isPrimary ?? index === 0),
    }
  })
  const fromPhotos = (row.photos ?? []).map((p, index) => ({
    url: String(p.url_max1080 ?? p.url ?? ''),
    caption: p.caption ?? null,
    isPrimary: index === 0 && fromImages.length === 0,
  }))
  return [...fromImages, ...fromPhotos].filter((i) => i.url)
}

function normalizeRooms(
  row: RawHotelVendorPayload,
  currency: string,
  fallbackNightly: number,
): HotelRoomAvailability[] {
  const source = row.rooms ?? row.roomTypes ?? []
  if (source.length === 0) {
    return [
      {
        roomId: 'std-1',
        name: 'Standard Room',
        bedType: 'queen',
        capacity: 2,
        available: 3,
        board: row.breakfastIncluded ? 'breakfast' : 'room_only',
        nightly: roundMoney(fallbackNightly),
        currency,
        freeCancellation: Boolean(row.freeCancellation),
        breakfastIncluded: Boolean(row.breakfastIncluded),
      },
    ]
  }
  return source.slice(0, 6).map((room, index) => ({
    roomId: String(room.roomId ?? room.id ?? `room-${index + 1}`),
    name: String(room.name ?? room.roomName ?? 'Standard Room'),
    bedType: String(room.bedType ?? 'standard'),
    capacity: Math.max(1, Math.round(pickNumber(room.capacity, 2))),
    available: Math.max(0, Math.round(pickNumber(room.available, room.count, 2))),
    board: room.board ?? null,
    nightly: roundMoney(pickNumber(room.nightly, room.price, fallbackNightly)),
    currency: room.currency ?? currency,
    freeCancellation: Boolean(room.freeCancellation ?? row.freeCancellation),
    breakfastIncluded: Boolean(room.breakfastIncluded ?? row.breakfastIncluded),
  }))
}

function normalizeCancellation(
  row: RawHotelVendorPayload,
  currency: string,
): HotelCancellationPolicy {
  if (row.cancellation && typeof row.cancellation === 'object') {
    const c = row.cancellation
    return {
      freeCancellation: Boolean(c.freeCancellation ?? row.freeCancellation),
      deadline: c.deadline ?? null,
      penaltyAmount: c.penaltyAmount ?? null,
      currency: c.currency ?? currency,
      summary: c.summary ?? (c.freeCancellation ? 'Free cancellation' : 'Non-refundable'),
    }
  }
  const text = typeof row.cancellation === 'string' ? row.cancellation : ''
  const free = Boolean(row.freeCancellation ?? /free|gratuit|مجاني/i.test(text))
  return {
    freeCancellation: free,
    deadline: null,
    penaltyAmount: free ? 0 : null,
    currency,
    summary: text || (free ? 'Free cancellation' : 'See property cancellation rules'),
  }
}

function normalizeTaxes(
  row: RawHotelVendorPayload,
  currency: string,
  total: number,
): HotelTaxesAndFees {
  if (row.taxesAndFees) {
    const t = row.taxesAndFees
    return {
      currency: t.currency ?? currency,
      taxes: pickNumber(t.taxes, 0),
      fees: pickNumber(t.fees, 0),
      totalInclusive: pickNumber(t.totalInclusive, total),
      baseExclusive: t.baseExclusive ?? null,
      notes: t.notes ? [...t.notes] : [],
    }
  }
  const taxes = pickNumber(row.taxes, roundMoney(total * 0.1))
  const fees = pickNumber(row.fees, roundMoney(total * 0.03))
  return {
    currency,
    taxes,
    fees,
    totalInclusive: roundMoney(total),
    baseExclusive: roundMoney(Math.max(0, total - taxes - fees)),
    notes: ['Taxes and fees normalized for sandbox display'],
  }
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn)
  const b = Date.parse(checkOut)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1
  return Math.max(1, Math.round((b - a) / 86_400_000))
}

function pickNumber(...values: Array<number | string | null | undefined>): number {
  for (const value of values) {
    if (value == null || value === '') continue
    const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
    if (Number.isFinite(n)) return n
  }
  return 0
}

function toNullableNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function clampStars(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 3
  if (value > 5 && value <= 10) return Math.round(value / 2)
  return Math.max(1, Math.min(5, Math.round(value)))
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'hotel'
}
