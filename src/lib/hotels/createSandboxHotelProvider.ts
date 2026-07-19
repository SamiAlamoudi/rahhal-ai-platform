/**
 * Sprint 30 — Shared sandbox HotelProvider base (search / rooms / pricing / cancel).
 */

import type { HotelProvider } from './HotelProvider'
import { hotelSearchNormalizer } from './HotelSearchNormalizer'
import { buildSandboxHotels, defaultStayDates, isHotelSandboxOnly } from './sandbox'
import type {
  HotelCancellationPolicy,
  HotelPricingRequest,
  HotelProviderCapabilities,
  HotelProviderMetadata,
  HotelProviderResult,
  HotelRoomAvailability,
  HotelRoomAvailabilityRequest,
  HotelSearchRequest,
  HotelTaxesAndFees,
  NormalizedHotelResult,
} from './types'

export interface CreateSandboxHotelProviderOptions {
  metadata: HotelProviderMetadata
  brand: string
  rateLimitPerMinute?: number
  /** Artificial latency for timeout tests (ms). */
  delayMs?: number
  /** Force failure codes for failover tests. */
  failWith?: {
    code: HotelProviderResult<unknown>['errors'][number]['code']
    message: string
    retryable?: boolean
  } | null
  /** Optional inject for unit tests. */
  inventory?: (req: HotelSearchRequest) => NormalizedHotelResult[]
}

export function createSandboxHotelProvider(
  options: CreateSandboxHotelProviderOptions,
): HotelProvider {
  const rateLimitPerMinute = options.rateLimitPerMinute ?? 60
  const capabilities: HotelProviderCapabilities = {
    providerId: options.metadata.id,
    search: true,
    roomAvailability: true,
    pricing: true,
    cancellationPolicy: true,
    taxesAndFees: true,
    images: true,
    amenities: true,
    starRating: true,
    guestReviews: true,
    sandboxOnly: isHotelSandboxOnly(),
    rateLimitPerMinute,
  }

  let lastOffers: NormalizedHotelResult[] = []

  const provider: HotelProvider = {
    metadata: options.metadata,
    getCapabilities: () => ({ ...capabilities }),
    isAvailable: () => options.failWith == null,
    async searchHotels(req) {
      const started = Date.now()
      if (options.delayMs) await sleep(options.delayMs)
      if (options.failWith) {
        return errorResult(options.metadata, started, options.failWith)
      }
      if (!req.destination?.trim()) {
        return errorResult(options.metadata, started, {
          code: 'invalid_input',
          message: 'destination is required',
          retryable: false,
        })
      }

      const { checkIn, checkOut, nights } = defaultStayDates(req)
      const searchReq: HotelSearchRequest = { ...req, checkIn, checkOut }
      const offers = options.inventory
        ? options.inventory(searchReq)
        : hotelSearchNormalizer.normalizeMany(
          buildSandboxHotels(options.metadata.id, searchReq, options.brand),
          {
            providerId: options.metadata.id,
            checkIn,
            checkOut,
            nights,
            currency: req.currency,
            sandbox: true,
          },
        )

      const limited = offers.slice(0, req.maxResults ?? offers.length)
      lastOffers = limited
      return okResult(options.metadata, started, limited)
    },

    async getRoomAvailability(req: HotelRoomAvailabilityRequest) {
      const started = Date.now()
      if (options.failWith) return errorResult(options.metadata, started, options.failWith)
      const hotel = await ensureHotel(provider, lastOffers, req.hotelId, req)
      if (!hotel) {
        return errorResult(options.metadata, started, {
          code: 'empty',
          message: `Hotel ${req.hotelId} not found in sandbox inventory`,
          retryable: false,
        })
      }
      return okResult(options.metadata, started, hotel.rooms)
    },

    async getPricing(req: HotelPricingRequest) {
      const started = Date.now()
      if (options.failWith) return errorResult(options.metadata, started, options.failWith)
      const hotel = await ensureHotel(provider, lastOffers, req.hotelId, req)
      if (!hotel) {
        return errorResult(options.metadata, started, {
          code: 'empty',
          message: `Hotel ${req.hotelId} not found`,
          retryable: false,
        })
      }
      const room = req.roomId
        ? hotel.rooms.find((r) => r.roomId === req.roomId) ?? hotel.rooms[0]
        : hotel.rooms[0]
      const nightly = room?.nightly ?? hotel.nightly
      const nights = Math.max(1, hotel.nights)
      const total = roundMoney(nightly * nights)
      const taxesAndFees: HotelTaxesAndFees = {
        ...hotel.taxesAndFees,
        totalInclusive: total,
        baseExclusive: roundMoney(total - hotel.taxesAndFees.taxes - hotel.taxesAndFees.fees),
      }
      return okResult(options.metadata, started, { nightly, total, taxesAndFees })
    },

    async getCancellationPolicy(hotelId: string, roomId?: string) {
      const started = Date.now()
      if (options.failWith) return errorResult(options.metadata, started, options.failWith)
      const hotel = lastOffers.find((o) => o.id === hotelId)
        ?? (await provider.searchHotels({
          destination: 'City',
          checkIn: defaultStayDates().checkIn,
          checkOut: defaultStayDates().checkOut,
          adults: 2,
        })).data?.find((o) => o.id === hotelId)

      if (!hotel) {
        return errorResult(options.metadata, started, {
          code: 'empty',
          message: `Hotel ${hotelId} not found`,
          retryable: false,
        })
      }
      const room = roomId ? hotel.rooms.find((r) => r.roomId === roomId) : null
      const policy: HotelCancellationPolicy = room
        ? {
          ...hotel.cancellation,
          freeCancellation: room.freeCancellation,
          summary: room.freeCancellation
            ? 'Free cancellation for selected room'
            : hotel.cancellation.summary,
        }
        : hotel.cancellation
      return okResult(options.metadata, started, policy)
    },
  }

  return provider
}

async function ensureHotel(
  provider: HotelProvider,
  lastOffers: NormalizedHotelResult[],
  hotelId: string,
  req: { checkIn: string; checkOut: string; adults: number; children?: number; currency?: string },
): Promise<NormalizedHotelResult | null> {
  const cached = lastOffers.find((o) => o.id === hotelId)
  if (cached) return cached
  const searched = await provider.searchHotels({
    destination: 'City',
    checkIn: req.checkIn,
    checkOut: req.checkOut,
    adults: req.adults,
    children: req.children,
    currency: req.currency,
  })
  return searched.data?.find((o) => o.id === hotelId) ?? searched.data?.[0] ?? null
}

function okResult<T>(
  metadata: HotelProviderMetadata,
  started: number,
  data: T,
): HotelProviderResult<T> {
  return {
    providerId: metadata.id,
    providerName: metadata.displayName,
    success: true,
    latencyMs: Date.now() - started,
    fromCache: false,
    data,
    errors: [],
    warnings: [],
    sandbox: true,
  }
}

function errorResult<T>(
  metadata: HotelProviderMetadata,
  started: number,
  fail: { code: HotelProviderResult<T>['errors'][number]['code']; message: string; retryable?: boolean },
): HotelProviderResult<T> {
  return {
    providerId: metadata.id,
    providerName: metadata.displayName,
    success: false,
    latencyMs: Date.now() - started,
    fromCache: false,
    data: null,
    errors: [{
      code: fail.code,
      message: fail.message,
      retryable: fail.retryable ?? fail.code !== 'invalid_input' && fail.code !== 'not_configured',
    }],
    warnings: [],
    sandbox: true,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

/** Re-export for adapters that need room types in signatures. */
export type { HotelRoomAvailability }
