/**
 * Sprint 30 — Map NormalizedHotelResult → brain HotelSearchPayload.
 */

import type { HotelSearchPayload } from '../../brain/execution/types'
import type { NormalizedHotelResult } from '../types'

export function toHotelSearchPayload(
  offers: NormalizedHotelResult[],
  options?: { mock?: boolean },
): HotelSearchPayload {
  return {
    kind: 'hotels',
    mock: options?.mock ?? offers.every((o) => o.sandbox),
    offers: offers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      area: offer.area || offer.location || 'City center',
      stars: offer.starRating,
      nightly: offer.nightly,
      currency: offer.currency,
    })),
  }
}
