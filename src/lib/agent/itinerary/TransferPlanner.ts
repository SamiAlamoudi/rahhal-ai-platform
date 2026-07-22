/**
 * Sprint 114 — TransferPlanner / CheckInPlanner / MealPlanner / ActivityAllocator
 */

import type { NormalizedItineraryContext } from './DayPlanner'
import type {
  DayPart,
  ItineraryBlockKind,
  ItineraryDayPlan,
  ItineraryTimeBlock,
  TripStyleKind,
} from './types'
import { dayPartForMinutes } from './types'

let blockSeq = 0

function block(input: {
  kind: ItineraryBlockKind
  title: string
  startMinutes: number
  endMinutes: number
  location?: string | null
  notes?: string[]
  why: string
}): ItineraryTimeBlock {
  const start = Math.max(0, Math.min(24 * 60 - 1, input.startMinutes))
  const end = Math.max(start + 15, Math.min(24 * 60, input.endMinutes))
  blockSeq += 1
  return {
    id: `blk_${blockSeq}`,
    kind: input.kind,
    dayPart: dayPartForMinutes(start),
    title: input.title,
    startMinutes: start,
    endMinutes: end,
    durationMinutes: end - start,
    location: input.location ?? null,
    notes: input.notes ?? [],
    why: input.why,
  }
}

export function planCheckInOut(input: {
  day: ItineraryDayPlan
  ctx: NormalizedItineraryContext
  arrivalMinutes: number
}): ItineraryTimeBlock[] {
  const out: ItineraryTimeBlock[] = []
  const hotel = input.ctx.hotelName ?? 'Hotel'
  if (input.day.isArrivalDay) {
    const start = Math.max(input.arrivalMinutes + 45, 14 * 60)
    out.push(
      block({
        kind: 'hotel_check_in',
        title: `Check in at ${hotel}`,
        startMinutes: start,
        endMinutes: start + 45,
        location: hotel,
        why: 'Hotel check-in scheduled after airport transfer and standard check-in time.',
      }),
    )
  }
  if (input.day.isDepartureDay) {
    const dep = input.ctx.flightDepartureMinutes ?? 18 * 60
    const start = Math.max(8 * 60, dep - 3 * 60)
    out.push(
      block({
        kind: 'hotel_check_out',
        title: `Check out from ${hotel}`,
        startMinutes: start,
        endMinutes: start + 30,
        location: hotel,
        why: 'Hotel check-out placed before airport transfer for the departure flight.',
      }),
    )
  }
  return out
}

export function planTransfers(input: {
  day: ItineraryDayPlan
  ctx: NormalizedItineraryContext
  arrivalMinutes: number
}): ItineraryTimeBlock[] {
  const out: ItineraryTimeBlock[] = []
  if (input.day.isArrivalDay) {
    const start = input.arrivalMinutes
    out.push(
      block({
        kind: 'flight_arrival',
        title: `Arrive in ${input.day.city}`,
        startMinutes: start,
        endMinutes: start + 30,
        location: input.day.city,
        why: 'Anchored to inbound flight arrival (including any applied delay).',
      }),
    )
    out.push(
      block({
        kind: 'transfer',
        title: 'Airport → hotel transfer',
        startMinutes: start + 30,
        endMinutes: start + 75,
        location: input.day.city,
        notes: ['Private transfer or taxi'],
        why: 'Transfer bridges flight arrival and hotel check-in.',
      }),
    )
  }
  if (input.day.isDepartureDay) {
    const dep = input.ctx.flightDepartureMinutes ?? 18 * 60
    const transferStart = Math.max(6 * 60, dep - 150)
    out.push(
      block({
        kind: 'transfer',
        title: 'Hotel → airport transfer',
        startMinutes: transferStart,
        endMinutes: transferStart + 45,
        location: input.day.city,
        why: 'Transfer timed to reach the airport before departure.',
      }),
    )
    out.push(
      block({
        kind: 'flight_departure',
        title: `Depart from ${input.day.city}`,
        startMinutes: dep,
        endMinutes: Math.min(24 * 60, dep + 30),
        location: input.day.city,
        why: 'Anchored to outbound/return flight departure time.',
      }),
    )
  }
  // Inter-city transfer when city changes vs previous day is handled by ActivityAllocator callers.
  return out
}

export function planMeals(input: {
  day: ItineraryDayPlan
  style: TripStyleKind
  occupied: Array<{ start: number; end: number }>
}): ItineraryTimeBlock[] {
  const slots: Array<{ part: DayPart; start: number; title: string; kind: ItineraryBlockKind }> = [
    { part: 'morning', start: 8 * 60, title: 'Breakfast', kind: 'meal' },
    { part: 'afternoon', start: 13 * 60, title: 'Lunch', kind: 'meal' },
    { part: 'evening', start: 19 * 60, title: 'Dinner', kind: 'meal' },
  ]

  if (input.day.isArrivalDay) {
    // Skip breakfast if arriving after 11:00
    const arrivalBusy = input.occupied[0]?.start ?? 0
    if (arrivalBusy > 11 * 60) {
      slots.shift()
    }
  }
  if (input.day.isDepartureDay) {
    // Prefer earlier dinner or skip late dinner if departing before 19:00
    const dep = input.occupied.find((o) => o.start >= 12 * 60)?.start
    if (dep != null && dep < 19 * 60) {
      const dinner = slots.find((s) => s.title === 'Dinner')
      if (dinner) dinner.start = Math.max(17 * 60, dep - 120)
    }
  }

  const out: ItineraryTimeBlock[] = []
  for (const slot of slots) {
    const overlaps = input.occupied.some(
      (o) => slot.start < o.end && slot.start + 60 > o.start,
    )
    if (overlaps) continue
    const why =
      input.style === 'family'
        ? `${slot.title} window kept family-friendly and away from transfers.`
        : input.style === 'business'
          ? `${slot.title} placed around meeting and transfer blocks.`
          : `${slot.title} allocated in a natural ${slot.part} window.`
    out.push(
      block({
        kind: slot.kind,
        title: slot.title,
        startMinutes: slot.start,
        endMinutes: slot.start + 60,
        why,
      }),
    )
  }
  return out
}

function activityCatalog(style: TripStyleKind, interests: string[]): string[] {
  const base =
    style === 'business'
      ? ['Coworking / prep block', 'Client meeting', 'City overview walk']
      : style === 'family'
        ? ['Family-friendly attraction', 'Park / open space', 'Light cultural stop']
        : ['Old town walk', 'Museum or landmark', 'Viewpoint / waterfront']

  const extras = interests.slice(0, 3).map((i) => `${i} experience`)
  return [...extras, ...base]
}

export function allocateActivities(input: {
  day: ItineraryDayPlan
  ctx: NormalizedItineraryContext
  occupied: Array<{ start: number; end: number }>
}): ItineraryTimeBlock[] {
  const out: ItineraryTimeBlock[] = []
  const catalog = activityCatalog(input.ctx.style, input.ctx.interests)

  const windows: Array<{ start: number; end: number; part: DayPart }> = []
  if (!input.day.isArrivalDay) {
    windows.push({ start: 9 * 60 + 30, end: 12 * 60, part: 'morning' })
  } else {
    // Afternoon activity after check-in when time allows
    windows.push({ start: 16 * 60, end: 18 * 60, part: 'afternoon' })
  }
  if (!input.day.isDepartureDay) {
    windows.push({ start: 14 * 60 + 30, end: 17 * 60, part: 'afternoon' })
    windows.push({ start: 18 * 60 + 30, end: 20 * 60, part: 'evening' })
  }

  let idx = 0
  for (const win of windows) {
    const overlaps = input.occupied.some(
      (o) => win.start < o.end && win.end > o.start,
    )
    if (overlaps) continue
    if (win.end - win.start < 45) continue

    const title = catalog[idx % catalog.length]!
    idx += 1
    const kind: ItineraryBlockKind =
      input.ctx.style === 'business' && /meeting/i.test(title)
        ? 'business_meeting'
        : /walk/i.test(title)
          ? 'walking'
          : 'sightseeing'

    const start = win.start
    const end = Math.min(win.end, start + (kind === 'business_meeting' ? 90 : 120))
    out.push(
      block({
        kind,
        title: `${title} (${input.day.city})`,
        startMinutes: start,
        endMinutes: end,
        location: input.day.city,
        why:
          kind === 'business_meeting'
            ? 'Business meeting placed in a contiguous daytime window with buffer for transfers.'
            : `Sightseeing/activity ordered to fit available ${win.part} time in ${input.day.city}.`,
      }),
    )

    // Walking connector after activity when leisure/family
    if (input.ctx.style !== 'business' && !input.day.isDepartureDay) {
      out.push(
        block({
          kind: 'walking',
          title: 'Short walk / buffer',
          startMinutes: end,
          endMinutes: end + 20,
          location: input.day.city,
          why: 'Walking buffer reduces schedule tightness between activities.',
        }),
      )
    }
  }

  // Free time fill if day is sparse
  const busy = [...input.occupied, ...out.map((b) => ({ start: b.startMinutes, end: b.endMinutes }))]
  const freeStart = input.day.isArrivalDay ? 20 * 60 : 21 * 60
  const freeBusy = busy.some((o) => freeStart < o.end && freeStart + 45 > o.start)
  if (!freeBusy && !input.day.isDepartureDay) {
    out.push(
      block({
        kind: 'free_time',
        title: 'Free time / rest',
        startMinutes: freeStart,
        endMinutes: freeStart + 60,
        location: input.ctx.hotelName,
        why: 'Free time protects comfort and avoids over-scheduling.',
      }),
    )
  }

  return out
}

export function planInterCityTransfer(input: {
  day: ItineraryDayPlan
  previousCity: string | null
}): ItineraryTimeBlock[] {
  if (!input.previousCity || input.previousCity === input.day.city) return []
  return [
    block({
      kind: 'transfer',
      title: `Transfer ${input.previousCity} → ${input.day.city}`,
      startMinutes: 10 * 60,
      endMinutes: 13 * 60,
      location: input.day.city,
      notes: ['Inter-city transfer'],
      why: 'Multi-city trip requires a daytime transfer between stays.',
    }),
  ]
}

export class TransferPlanner {
  plan(input: Parameters<typeof planTransfers>[0]) {
    return planTransfers(input)
  }
}

export class CheckInPlanner {
  plan(input: Parameters<typeof planCheckInOut>[0]) {
    return planCheckInOut(input)
  }
}

export class MealPlanner {
  plan(input: Parameters<typeof planMeals>[0]) {
    return planMeals(input)
  }
}

export class ActivityAllocator {
  allocate(input: Parameters<typeof allocateActivities>[0]) {
    return allocateActivities(input)
  }
}

export function createTransferPlanner(): TransferPlanner {
  return new TransferPlanner()
}
export function createCheckInPlanner(): CheckInPlanner {
  return new CheckInPlanner()
}
export function createMealPlanner(): MealPlanner {
  return new MealPlanner()
}
export function createActivityAllocator(): ActivityAllocator {
  return new ActivityAllocator()
}
