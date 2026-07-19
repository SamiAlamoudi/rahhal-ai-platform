/**
 * Sprint 25 — map brain SearchOption → BookingSelectedItem (reuses booking mapper URL helpers).
 */

import type { NormalizedTravelOption } from '../../utils/searchOrchestrator'
import type { BookingItemType } from '../booking/bookingTypes'
import {
  resolveBookingUrl,
  resolveProviderName,
  type BookingSelectedItem,
} from '../booking/bookingSelectionMapper'
import type { SearchOption } from '../brain/search/types'

export function searchOptionToBookingType(option: SearchOption): BookingItemType {
  switch (option.kind) {
    case 'flight':
      return 'flight'
    case 'hotel':
      return 'hotel'
    case 'transport':
      return 'transfer'
    case 'activity':
      return 'activity'
    case 'package':
      // Additive packaging via metadata; BookingItemType stays compatible.
      return 'activity'
  }
}

export function searchOptionToNormalized(option: SearchOption): NormalizedTravelOption {
  switch (option.kind) {
    case 'flight':
      return {
        id: option.id,
        type: 'flight',
        title: `${option.airline} ${option.from}→${option.to}`,
        providerIds: [option.providerId],
        price: option.price,
        currency: option.currency,
        durationMinutes: Math.round(option.durationHours * 60),
        stops: option.stops,
        rating: null,
        location: null,
        baggageIncluded: null,
        familyFriendly: null,
        refundable: null,
        attributes: {
          airline: option.airline,
          cabin: option.cabin,
          from: option.from,
          to: option.to,
          sourceTaskId: option.sourceTaskId,
          bookingKind: 'flight',
        },
        decisionScore: null,
        recommendationLevel: null,
        reasons: [],
      }
    case 'hotel':
      return {
        id: option.id,
        type: 'hotel',
        title: option.name,
        providerIds: [option.providerId],
        price: option.nightly,
        currency: option.currency,
        durationMinutes: null,
        stops: null,
        rating: option.stars,
        location: option.area,
        baggageIncluded: null,
        familyFriendly: null,
        refundable: null,
        attributes: {
          area: option.area,
          stars: option.stars,
          sourceTaskId: option.sourceTaskId,
          bookingKind: 'hotel',
        },
        decisionScore: null,
        recommendationLevel: null,
        reasons: [],
      }
    case 'transport':
      return {
        id: option.id,
        type: 'transportation',
        title: `${option.mode} ${option.from}→${option.to}`,
        providerIds: [option.providerId],
        price: option.price,
        currency: option.currency,
        durationMinutes: null,
        stops: null,
        rating: null,
        location: null,
        baggageIncluded: null,
        familyFriendly: null,
        refundable: null,
        attributes: {
          mode: option.mode,
          from: option.from,
          to: option.to,
          sourceTaskId: option.sourceTaskId,
          bookingKind: 'transport',
        },
        decisionScore: null,
        recommendationLevel: null,
        reasons: [],
      }
    case 'activity':
      return {
        id: option.id,
        type: 'activity',
        title: option.title,
        providerIds: [option.providerId],
        price: option.price,
        currency: option.currency,
        durationMinutes: null,
        stops: null,
        rating: null,
        location: null,
        baggageIncluded: null,
        familyFriendly: null,
        refundable: null,
        attributes: {
          category: option.category,
          sourceTaskId: option.sourceTaskId,
          bookingKind: 'activity',
        },
        decisionScore: null,
        recommendationLevel: null,
        reasons: [],
      }
    case 'package':
      return {
        id: option.id,
        type: 'activity',
        title: option.title,
        providerIds: [option.providerId],
        price: option.price,
        currency: option.currency,
        durationMinutes: null,
        stops: null,
        rating: null,
        location: null,
        baggageIncluded: null,
        familyFriendly: null,
        refundable: null,
        attributes: {
          includes: option.includes.join(', '),
          sourceTaskId: option.sourceTaskId,
          bookingKind: 'package',
        },
        decisionScore: null,
        recommendationLevel: null,
        reasons: [],
      }
  }
}

export function searchOptionToBookingSelectedItem(
  option: SearchOption,
  expiresAt: string | null = null,
): BookingSelectedItem {
  const normalized = searchOptionToNormalized(option)
  return {
    option: normalized,
    bookingType: searchOptionToBookingType(option),
    bookingUrl: resolveBookingUrl(normalized),
    providerName: resolveProviderName(normalized),
    expiresAt,
    cancellationInfo: null,
  }
}

export function searchOptionsToBookingSelectedItems(
  options: SearchOption[],
  expiresAt: string | null = null,
): BookingSelectedItem[] {
  return options.map((o) => searchOptionToBookingSelectedItem(o, expiresAt))
}

export function bookingKindOfItem(item: {
  type: BookingItemType
  metadata: Record<string, unknown>
}): 'flight' | 'hotel' | 'transport' | 'activity' | 'package' {
  const kind = item.metadata.bookingKind
  if (kind === 'package') return 'package'
  if (kind === 'transport') return 'transport'
  if (kind === 'activity') return 'activity'
  if (kind === 'hotel') return 'hotel'
  if (kind === 'flight') return 'flight'
  if (item.type === 'flight') return 'flight'
  if (item.type === 'hotel') return 'hotel'
  if (item.type === 'transfer' || item.type === 'rental_car') return 'transport'
  return 'activity'
}
