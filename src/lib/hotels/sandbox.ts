/**
 * Sprint 30 — Sandbox inventory helpers (no production credentials).
 */

import type { HotelProviderId, HotelSearchRequest } from './types'
import type { RawHotelVendorPayload } from './HotelSearchNormalizer'

export const HOTEL_SANDBOX_MODE = 'sandbox' as const

export function isHotelSandboxOnly(): boolean {
  // Sprint 30 ships sandbox/mock only — live credentials are never read.
  return true
}

export function defaultStayDates(req?: Partial<HotelSearchRequest>): {
  checkIn: string
  checkOut: string
  nights: number
} {
  const checkIn = req?.checkIn || daysFromToday(14)
  const checkOut = req?.checkOut || daysFromToday(17)
  const nights = Math.max(1, nightsBetween(checkIn, checkOut))
  return { checkIn, checkOut, nights }
}

export function buildSandboxHotels(
  providerId: HotelProviderId,
  req: HotelSearchRequest,
  brand: string,
): RawHotelVendorPayload[] {
  const destination = req.destination || 'City'
  const { checkIn, checkOut, nights } = defaultStayDates(req)
  const currency = req.currency || 'SAR'
  const preferred = (req.preferredHotels ?? []).map((p) => p.toLowerCase())
  const seed = stableHash(`${providerId}:${destination}:${checkIn}`)

  const catalog = [
    {
      suffix: 'Grand',
      stars: 5,
      nightlyBase: 520,
      review: 9.1,
      amenities: ['WiFi', 'Pool', 'Spa', 'Breakfast', 'Gym', 'Parking'],
      board: 'breakfast',
    },
    {
      suffix: 'Central',
      stars: 4,
      nightlyBase: 380,
      review: 8.4,
      amenities: ['WiFi', 'Breakfast', 'Family rooms', 'Airport shuttle'],
      board: 'breakfast',
    },
    {
      suffix: 'Boutique',
      stars: 4,
      nightlyBase: 310,
      review: 8.7,
      amenities: ['WiFi', 'Rooftop', 'Bar', 'Concierge'],
      board: 'room_only',
    },
    {
      suffix: 'Garden',
      stars: 3,
      nightlyBase: 240,
      review: 7.9,
      amenities: ['WiFi', 'Garden', 'Kids club', 'Breakfast'],
      board: 'breakfast',
    },
  ]

  return catalog.map((item, index) => {
    const preferredBoost =
      preferred.some((p) => `${brand} ${item.suffix}`.toLowerCase().includes(p) || p.includes(brand.toLowerCase()))
        ? 40
        : 0
    const nightly = item.nightlyBase + (seed % 37) + index * 12 - preferredBoost
    const total = nightly * nights
    const hotelName = preferred[0] && index === 0
      ? titleCase(preferred[0])
      : `${brand} ${destination} ${item.suffix}`

    return {
      id: `${providerId}-sandbox-${index + 1}`,
      name: hotelName,
      description: `Sandbox ${brand} stay in ${destination}`,
      currency,
      nightly,
      price: total,
      stars: item.stars,
      reviewScore: item.review,
      reviewCount: 80 + (seed % 400) + index * 17,
      location: `${destination} center`,
      area: `${destination} Downtown`,
      latitude: 24.7 + (seed % 100) / 1000,
      longitude: 46.6 + (index % 10) / 100,
      checkIn,
      checkOut,
      nights,
      familyFriendly: item.amenities.some((a) => /family|kids/i.test(a)),
      breakfastIncluded: /breakfast/i.test(item.board) || item.amenities.includes('Breakfast'),
      amenities: item.amenities,
      images: [
        {
          url: `https://images.example.com/hotels/${providerId}/${index + 1}.jpg`,
          caption: hotelName,
          isPrimary: true,
        },
      ],
      rooms: [
        {
          roomId: `${providerId}-room-${index + 1}a`,
          name: 'Deluxe King',
          bedType: 'king',
          capacity: 2,
          available: 4,
          board: item.board,
          nightly,
          currency,
          freeCancellation: index % 2 === 0,
          breakfastIncluded: item.amenities.includes('Breakfast'),
        },
        {
          roomId: `${providerId}-room-${index + 1}b`,
          name: 'Family Twin',
          bedType: 'twin',
          capacity: 3,
          available: 2,
          board: item.board,
          nightly: nightly + 45,
          currency,
          freeCancellation: true,
          breakfastIncluded: true,
        },
      ],
      freeCancellation: index % 2 === 0,
      cancellation: {
        freeCancellation: index % 2 === 0,
        deadline: index % 2 === 0 ? daysBefore(checkIn, 2) : null,
        penaltyAmount: index % 2 === 0 ? 0 : Math.round(nightly * 0.5),
        currency,
        summary: index % 2 === 0 ? 'Free cancellation until 48h before check-in' : 'Partial refund',
      },
      taxes: roundMoney(total * 0.1),
      fees: roundMoney(total * 0.025),
      bookingUrl: `https://sandbox.example.com/${providerId}/book/${index + 1}`,
      sandbox: true,
    } satisfies RawHotelVendorPayload
  })
}

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function daysBefore(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(checkIn)
  const b = Date.parse(checkOut)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 1
  return Math.max(1, Math.round((b - a) / 86_400_000))
}

function stableHash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase())
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
