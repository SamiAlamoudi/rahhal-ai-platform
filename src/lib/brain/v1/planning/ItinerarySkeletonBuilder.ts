/**
 * Sprint 84 — Itinerary Skeleton builder.
 * Provider-independent structure only (no provider integration).
 */

import type { ItineraryDaySkeleton, ItinerarySkeleton, TravelPlanSlots } from './types'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dayCount(slots: TravelPlanSlots): number {
  if (slots.dates.start && slots.dates.end) {
    const start = new Date(`${slots.dates.start}T00:00:00.000Z`).getTime()
    const end = new Date(`${slots.dates.end}T00:00:00.000Z`).getTime()
    const diff = Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1
    return Math.max(1, Math.min(14, diff))
  }
  return 3
}

export class ItinerarySkeletonBuilder {
  build(slots: TravelPlanSlots): ItinerarySkeleton {
    const daysN = dayCount(slots)
    const days: ItineraryDaySkeleton[] = []

    for (let i = 0; i < daysN; i += 1) {
      const date = slots.dates.start ? addDays(slots.dates.start, i) : null
      const day: ItineraryDaySkeleton = {
        day: i + 1,
        date,
        flights: [],
        hotels: [],
        transfers: [],
        activities: [],
        freeTime: [],
        notes: [],
      }

      if (i === 0) {
        day.flights.push(
          slots.origin && slots.destination
            ? `Outbound flight stub: ${slots.origin} → ${slots.destination}`
            : 'Outbound flight stub (pending origin/destination)',
        )
        day.transfers.push('Airport → hotel transfer stub')
        day.hotels.push(
          slots.hotelPreference
            ? `Hotel stub (${slots.hotelPreference})`
            : 'Hotel stub (preference pending)',
        )
        day.notes.push('Arrival day — light schedule')
      } else if (i === daysN - 1 && daysN > 1) {
        day.flights.push(
          slots.origin && slots.destination
            ? `Return flight stub: ${slots.destination} → ${slots.origin}`
            : 'Return flight stub (pending)',
        )
        day.transfers.push('Hotel → airport transfer stub')
        day.notes.push('Departure day')
      } else {
        day.hotels.push('Continue hotel stay stub')
        day.freeTime.push('Unstructured exploration block')
      }

      if (slots.activities.length) {
        const activity = slots.activities[i % slots.activities.length]!
        day.activities.push(`Activity stub: ${activity}`)
      } else if (i > 0 && i < daysN - 1) {
        day.activities.push('Activity stub (preferences pending)')
      }

      if (slots.transportation) {
        day.transfers.push(`Local transport preference: ${slots.transportation}`)
      }

      days.push(day)
    }

    const notes = [
      'Provider-independent itinerary skeleton — no live inventory',
      slots.destination ? `Destination focus: ${slots.destination}` : 'Destination pending',
      slots.budget != null
        ? `Budget ceiling: ${slots.budget}${slots.currency ? ` ${slots.currency}` : ''}`
        : 'Budget not set',
    ]

    return {
      destination: slots.destination,
      origin: slots.origin,
      startDate: slots.dates.start,
      endDate: slots.dates.end,
      days,
      notes,
    }
  }
}

export function createItinerarySkeletonBuilder(): ItinerarySkeletonBuilder {
  return new ItinerarySkeletonBuilder()
}
