/**
 * Sprint 30 — Brain execution HotelProvider backed by HotelProviderRegistry.
 */

import type {
  HotelProvider as BrainHotelProvider,
  HotelSearchPayload,
  ProviderSearchContext,
} from '../../brain/execution/types'
import {
  createHotelProviderRegistry,
  type HotelProviderRegistry,
} from '../HotelProviderRegistry'
import { toHotelSearchPayload } from './toExecutionPayload'
import type { HotelSearchRequest } from '../types'

export type CreateFoundationHotelExecutionProviderOptions = {
  registry?: HotelProviderRegistry
  id?: string
  providerChain?: string[]
}

export function createFoundationHotelExecutionProvider(
  options: CreateFoundationHotelExecutionProviderOptions = {},
): BrainHotelProvider {
  const registry = options.registry ?? createHotelProviderRegistry()
  return {
    id: options.id ?? 'hotel_foundation',
    async search(ctx: ProviderSearchContext): Promise<HotelSearchPayload> {
      const req = contextToHotelSearch(ctx)
      const result = await registry.search(req, {
        providerChain: options.providerChain as never,
        failover: true,
      })
      return toHotelSearchPayload(result.offers, { mock: result.sandbox })
    },
  }
}

function contextToHotelSearch(ctx: ProviderSearchContext): HotelSearchRequest {
  const meta = ctx.task.metadata
  const trip = ctx.tripPlan
  const checkIn =
    meta.startDate
    || trip.travelDates?.startDate
    || daysFromToday(14)
  const checkOut =
    meta.endDate
    || trip.travelDates?.endDate
    || daysFromToday(17)
  const preferred = [
    ...(meta.preferredHotels ?? []),
    ...(trip.hotelPreferences ?? []),
  ]

  return {
    destination: meta.destination || trip.destination || 'City',
    checkIn,
    checkOut,
    adults: Math.max(1, meta.adults ?? trip.adults ?? 2),
    children: meta.children ?? trip.children ?? undefined,
    currency: meta.currency || trip.budget?.currency || 'SAR',
    preferredHotels: preferred,
    maxResults: 6,
    signal: ctx.signal,
  }
}

function daysFromToday(offset: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
