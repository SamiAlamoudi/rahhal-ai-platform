/**
 * Integration Sprint 3 — conversation → live hotel search orchestrator.
 * Flag OFF (`ai.live_hotel_search`) → returns null (mock engine path unchanged).
 */

import type { HotelSearchEngine, UnifiedHotel } from '../hotelSearchEngine'
import { createHotelSearchEngine } from '../hotelSearchEngine'
import {
  isLiveHotelSearchEnabled,
  runLiveHotelSearch,
  type HotelOffer,
} from '../liveHotelSearch'
import type { AgentToolContext } from '../tools/types'
import {
  ConversationHotelSearchCache,
  getConversationHotelSearchCache,
} from './cache'
import { buildConsultantHotelSummary, hotelHighlightLines } from './consultantSummary'
import {
  adultsFromHotelContext,
  amenityFiltersFromContext,
  buildEngineHotelRequestFromContext,
  buildLiveHotelCriteriaFromContext,
  childrenFromHotelContext,
  roomsFromHotelContext,
} from './criteriaFromContext'
import { rankConversationHotels } from './rankingExplain'
import {
  INTEGRATION_LIVE_HOTEL_SEARCH_VERSION,
  type ConversationHotelSearchResult,
  type RankedConversationHotel,
} from './types'

export type ConversationHotelSearchDeps = {
  enabled?: boolean
  cache?: ConversationHotelSearchCache
  runLive?: typeof runLiveHotelSearch
  engine?: HotelSearchEngine
  fallbackToMock?: boolean
}

function liveOfferToRankable(hotel: HotelOffer) {
  return {
    id: hotel.id,
    hotelId: hotel.hotelId,
    providerId: hotel.provider,
    hotelName: hotel.hotelName,
    city: hotel.city,
    area: hotel.city,
    stars: hotel.stars,
    rating: hotel.rating,
    reviewCount: null as number | null,
    pricePerNight: hotel.price,
    totalPrice: hotel.price,
    currency: hotel.currency,
    roomType: hotel.roomType,
    boardType: hotel.boardType,
    breakfastIncluded: /breakfast|bb|hb|fb/i.test(hotel.boardType ?? ''),
    freeCancellation: hotel.freeCancellation,
    refundable: hotel.freeCancellation,
    amenities: hotel.amenities,
    images: hotel.images,
    distanceKm: null as number | null,
  }
}

function unifiedToRankable(hotel: UnifiedHotel) {
  return {
    id: hotel.hotelId,
    hotelId: hotel.hotelId,
    providerId: hotel.provider,
    hotelName: hotel.hotelName,
    city: hotel.city,
    area: hotel.city,
    stars: hotel.stars,
    rating: hotel.rating,
    reviewCount: hotel.reviewCount,
    pricePerNight: hotel.pricePerNight,
    totalPrice: hotel.totalPrice,
    currency: hotel.currency,
    roomType: hotel.roomTypes[0] ?? null,
    boardType: hotel.boardType,
    breakfastIncluded: hotel.breakfastIncluded,
    freeCancellation: hotel.freeCancellation,
    refundable: hotel.refundable,
    amenities: hotel.amenities,
    images: hotel.images,
    distanceKm: hotel.distanceKm ?? null,
  }
}

function toToolStays(ranked: RankedConversationHotel[], nights: number): Record<string, unknown>[] {
  return ranked.map((h) => ({
    name: h.hotelName,
    hotelId: h.hotelId,
    area: h.area ?? h.city ?? 'Center',
    category: (h.stars ?? 0) >= 4 ? 'boutique' : 'hotel',
    nightly: h.pricePerNight,
    nights,
    total: h.totalPrice ?? ((h.pricePerNight ?? 0) * nights),
    currency: h.currency,
    score: h.score,
    rating: h.rating,
    hotelStars: h.stars,
    provider: h.providerId,
    refundable: h.refundable,
    breakfastIncluded: h.breakfastIncluded,
    freeCancellation: h.freeCancellation,
    amenities: h.amenities,
    images: h.images,
    roomType: h.roomType,
    boardType: h.boardType,
    distanceKm: h.distanceKm,
    why: h.whyEn,
    whyAr: h.whyAr,
    reasons: h.reasons,
  }))
}

function finalize(
  ranked: RankedConversationHotel[],
  meta: {
    usedLive: boolean
    cacheHit: boolean
    empty: boolean
    gracefulMessage?: string
    latencyMs: number
    providerId: string | null
    destination: string
    checkIn: string
    checkOut: string
    adults: number
    children: number
    rooms: number
    currency: string
  },
): ConversationHotelSearchResult {
  const summary = buildConsultantHotelSummary(ranked, {
    destination: meta.destination,
    checkIn: meta.checkIn,
    checkOut: meta.checkOut,
    empty: meta.empty,
    graceful: Boolean(meta.gracefulMessage),
  })
  return {
    version: INTEGRATION_LIVE_HOTEL_SEARCH_VERSION,
    usedLive: meta.usedLive,
    cacheHit: meta.cacheHit,
    empty: meta.empty,
    gracefulMessage: meta.gracefulMessage,
    stays: ranked,
    highlights: hotelHighlightLines(ranked),
    consultantSummaryAr: summary.ar,
    consultantSummaryEn: summary.en,
    diagnostics: {
      providerId: meta.providerId,
      latencyMs: meta.latencyMs,
      destination: meta.destination,
      checkIn: meta.checkIn,
      checkOut: meta.checkOut,
      adults: meta.adults,
      children: meta.children,
      rooms: meta.rooms,
      currency: meta.currency,
    },
  }
}

export async function tryConversationLiveHotelSearch(
  ctx: AgentToolContext,
  deps: ConversationHotelSearchDeps = {},
): Promise<ConversationHotelSearchResult | null> {
  if (!isLiveHotelSearchEnabled({ enabled: deps.enabled })) {
    return null
  }

  const criteria = buildLiveHotelCriteriaFromContext(ctx)
  const adults = adultsFromHotelContext(ctx)
  const children = childrenFromHotelContext(ctx)
  const rooms = roomsFromHotelContext(ctx)
  const prefs = {
    preferredArea: ctx.requirements.preferredArea,
    hotelPreference: ctx.requirements.hotelPreference,
    breakfastRequired: ctx.requirements.breakfastRequired,
    freeCancellationRequired: ctx.requirements.freeCancellationRequired,
    amenities: amenityFiltersFromContext(ctx),
    maxNightly: ctx.requirements.budgetAmount,
    tripPurpose: ctx.requirements.tripPurpose,
    budgetStyle: ctx.requirements.budgetStyle,
  }

  const cache = deps.cache ?? getConversationHotelSearchCache()
  const cacheKey = ConversationHotelSearchCache.key({
    destination: criteria.destination,
    checkIn: criteria.checkInDate,
    checkOut: criteria.checkOutDate,
    adults,
    children,
    rooms,
    currency: criteria.currency ?? 'SAR',
    hotelPreference: prefs.hotelPreference,
    preferredArea: prefs.preferredArea,
    breakfastRequired: prefs.breakfastRequired,
    freeCancellationRequired: prefs.freeCancellationRequired,
    amenities: prefs.amenities,
    live: true,
  })

  const cached = cache.get(cacheKey)
  if (cached) return cached

  const started = Date.now()
  const runLive = deps.runLive ?? runLiveHotelSearch
  const live = await runLive(criteria, { enabled: true, timeoutMs: criteria.timeoutMs })

  if (live.enabled && live.ok && !live.empty && live.hotels.length > 0) {
    const ranked = rankConversationHotels(live.hotels.map(liveOfferToRankable), prefs)
    const result = finalize(ranked, {
      usedLive: true,
      cacheHit: false,
      empty: false,
      latencyMs: live.latencyMs || Date.now() - started,
      providerId: live.meta.providerId ?? 'amadeus',
      destination: criteria.destination,
      checkIn: criteria.checkInDate,
      checkOut: criteria.checkOutDate,
      adults,
      children,
      rooms,
      currency: criteria.currency ?? 'SAR',
    })
    cache.set(cacheKey, result)
    return result
  }

  const fallbackToMock = deps.fallbackToMock !== false
  if (!fallbackToMock) {
    return finalize([], {
      usedLive: true,
      cacheHit: false,
      empty: true,
      gracefulMessage:
        live.error?.message
        ?? (ctx.locale === 'ar'
          ? 'تعذّر البحث الحي عن الفنادق حالياً'
          : 'Live hotel search is temporarily unavailable'),
      latencyMs: Date.now() - started,
      providerId: live.meta.providerId,
      destination: criteria.destination,
      checkIn: criteria.checkInDate,
      checkOut: criteria.checkOutDate,
      adults,
      children,
      rooms,
      currency: criteria.currency ?? 'SAR',
    })
  }

  const engine = deps.engine ?? createHotelSearchEngine({ forceMock: true })
  const request = buildEngineHotelRequestFromContext(ctx)
  const page = await engine.searchHotels(request)
  const ranked = rankConversationHotels(page.hotels.map(unifiedToRankable), prefs)
  const result = finalize(ranked, {
    usedLive: false,
    cacheHit: false,
    empty: ranked.length === 0,
    gracefulMessage: live.enabled
      ? (live.error?.message ?? page.diagnostics.gracefulMessage)
      : page.diagnostics.gracefulMessage,
    latencyMs: Date.now() - started,
    providerId: page.diagnostics.providersUsed[0] ?? 'mock',
    destination: criteria.destination,
    checkIn: criteria.checkInDate,
    checkOut: criteria.checkOutDate,
    adults,
    children,
    rooms,
    currency: criteria.currency ?? 'SAR',
  })
  cache.set(cacheKey, result)
  return result
}

export function conversationHotelResultToToolData(
  result: ConversationHotelSearchResult,
  nights: number,
): Record<string, unknown> {
  return {
    stays: toToolStays(result.stays, nights),
    searchEngine: result.usedLive ? 'liveHotelSearch' : 'hotelSearchEngine',
    engineVersion: result.version,
    usedLive: result.usedLive,
    cacheHit: result.cacheHit,
    diagnostics: {
      ...result.diagnostics,
      cacheHit: result.cacheHit,
      usedLive: result.usedLive,
    },
    highlights: result.highlights,
    consultantSummaryAr: result.consultantSummaryAr,
    consultantSummaryEn: result.consultantSummaryEn,
  }
}
