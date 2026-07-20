/**
 * Normalize provider booking responses into UnifiedBooking — Sprint 57.
 */

import type { MoneyAmount } from '../bookingIntelligence/types'
import type {
  BookingExecutionDomain,
  BookingLifecycleStatus,
  BookingTravelerInfo,
  UnifiedBooking,
} from './types'

export function normalizeProviderBooking(input: {
  sessionId: string
  domain: BookingExecutionDomain
  providerId: string
  offerId: string
  confirmationId?: string | null
  reservationId?: string | null
  status: BookingLifecycleStatus
  travelers: BookingTravelerInfo[]
  pricing: MoneyAmount
  taxes?: MoneyAmount
  title?: string
  now?: () => number
  expiresAt?: string | null
  raw?: unknown
}): UnifiedBooking {
  const now = input.now ?? (() => Date.now())
  const at = new Date(now()).toISOString()
  const confirmation = input.confirmationId ?? null
  const pnr =
    input.domain === 'flights' && confirmation
      ? confirmation.replace(/^sim-book-|^live-book-|^duffel-order-stub-/i, '').slice(0, 6).toUpperCase()
      : null

  return {
    id: `bkg_${Math.random().toString(36).slice(2, 10)}`,
    sessionId: input.sessionId,
    domain: input.domain,
    provider: input.providerId,
    confirmation,
    pnr,
    reservationId: input.reservationId ?? null,
    status: input.status,
    travelerInfo: input.travelers.map((t) => ({ ...t })),
    pricing: { ...input.pricing },
    taxes: input.taxes ?? {
      amount: Math.round(input.pricing.amount * 0.05),
      currency: input.pricing.currency,
    },
    tickets:
      input.domain === 'flights' && confirmation
        ? [
            {
              id: `tkt_${confirmation}`,
              number: confirmation,
              segmentLabel: input.title ?? null,
              issuedAt: input.status === 'ticketed' || input.status === 'confirmed' ? at : null,
            },
          ]
        : [],
    documents:
      confirmation
        ? [
            {
              id: `doc_${confirmation}`,
              type: input.domain === 'flights' ? 'eticket' : 'voucher',
              url: null,
              label: `${input.domain} confirmation`,
            },
          ]
        : [],
    offerId: input.offerId,
    createdAt: at,
    updatedAt: at,
    expiresAt: input.expiresAt ?? null,
    raw: input.raw,
  }
}

export function withBookingStatus(
  booking: UnifiedBooking,
  status: BookingLifecycleStatus,
  now: () => number = () => Date.now(),
): UnifiedBooking {
  return {
    ...booking,
    status,
    updatedAt: new Date(now()).toISOString(),
    tickets:
      status === 'ticketed' || status === 'confirmed'
        ? booking.tickets.map((t) => ({
            ...t,
            issuedAt: t.issuedAt ?? new Date(now()).toISOString(),
          }))
        : booking.tickets,
  }
}
