/**
 * Sprint 93 — chronological trip timeline builder.
 */

import type {
  TripActivity,
  TripFlight,
  TripHotel,
  TripTimelineEvent,
  TripTransfer,
} from './types'

export function buildTripTimeline(input: {
  flights: TripFlight[]
  hotel: TripHotel | null
  activities: TripActivity[]
  transfers: TripTransfer[]
}): TripTimelineEvent[] {
  const events: TripTimelineEvent[] = []
  let order = 0

  const outbound = input.flights.find((f) => f.direction === 'outbound') ?? input.flights[0]
  const ret = input.flights.find((f) => f.direction === 'return')
    ?? (input.flights.length > 1 ? input.flights[input.flights.length - 1] : null)

  if (outbound) {
    events.push({
      id: `tl_flight_out_${outbound.id}`,
      kind: 'flight_outbound',
      title: `Outbound flight${outbound.airline ? ` · ${outbound.airline}` : ''}`,
      at: outbound.departureAt,
      endAt: outbound.arrivalAt,
      order: order++,
    })
    events.push({
      id: `tl_arrival_${outbound.id}`,
      kind: 'arrival',
      title: `Arrive ${outbound.destination}`,
      at: outbound.arrivalAt,
      endAt: null,
      order: order++,
    })
  }

  for (const transfer of input.transfers) {
    events.push({
      id: `tl_xfer_${transfer.id}`,
      kind: 'transfer',
      title: transfer.title,
      at: transfer.startAt ?? outbound?.arrivalAt ?? null,
      endAt: null,
      order: order++,
    })
  }

  if (input.hotel) {
    events.push({
      id: `tl_checkin_${input.hotel.id}`,
      kind: 'hotel_check_in',
      title: `Check in · ${input.hotel.name}`,
      at: input.hotel.checkIn,
      endAt: null,
      order: order++,
    })
  }

  for (const activity of input.activities) {
    events.push({
      id: `tl_act_${activity.id}`,
      kind: 'activity',
      title: activity.title,
      at: activity.startAt,
      endAt: activity.endAt,
      order: order++,
    })
  }

  if (input.hotel?.checkOut) {
    events.push({
      id: `tl_checkout_${input.hotel.id}`,
      kind: 'hotel_check_out',
      title: `Check out · ${input.hotel.name}`,
      at: input.hotel.checkOut,
      endAt: null,
      order: order++,
    })
  }

  if (ret && ret.id !== outbound?.id) {
    events.push({
      id: `tl_flight_ret_${ret.id}`,
      kind: 'flight_return',
      title: `Return flight${ret.airline ? ` · ${ret.airline}` : ''}`,
      at: ret.departureAt,
      endAt: ret.arrivalAt,
      order: order++,
    })
  }

  const kindRank: Record<TripTimelineEvent['kind'], number> = {
    flight_outbound: 0,
    arrival: 1,
    transfer: 2,
    hotel_check_in: 3,
    activity: 4,
    hotel_check_out: 5,
    flight_return: 6,
    other: 7,
  }

  return events.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : Number.POSITIVE_INFINITY
    const tb = b.at ? Date.parse(b.at) : Number.POSITIVE_INFINITY
    if (Number.isFinite(ta) && Number.isFinite(tb)) {
      // Same calendar day → keep semantic order (flight before check-in).
      const dayA = Math.floor(ta / 86_400_000)
      const dayB = Math.floor(tb / 86_400_000)
      if (dayA === dayB) {
        const rank = kindRank[a.kind] - kindRank[b.kind]
        if (rank !== 0) return rank
      }
      if (ta !== tb) return ta - tb
    }
    return a.order - b.order
  }).map((e, i) => ({ ...e, order: i }))
}
