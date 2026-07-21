/**
 * Sprint 84 — apply hard + soft constraints incrementally.
 */

import type { PackageCandidate, PackageComponent } from '../packageBuilder/PackageCandidate'
import type { RefinementChangeKind } from './RefinementPlanner'

export type HardConstraintKind =
  | 'budget'
  | 'visa'
  | 'flight_availability'
  | 'hotel_availability'
  | 'max_transfers'
  | 'arrival_deadline'
  | 'departure_deadline'
  | 'meeting_schedule'
  | 'children'
  | 'accessibility'
  | 'wheelchair'
  | 'business_travel'

export type SoftConstraintKind =
  | 'walking_distance'
  | 'luxury'
  | 'food'
  | 'beach'
  | 'shopping'
  | 'nature'
  | 'nightlife'
  | 'museums'
  | 'adventure'
  | 'weather'
  | 'quiet_hotels'
  | 'room_type'
  | 'seat_preference'

function retotal(components: PackageComponent[]): number {
  return components.reduce((s, c) => s + c.price, 0)
}

function mapComponents(
  pkg: PackageCandidate,
  kinds: Set<string>,
  mapper: (c: PackageComponent) => PackageComponent,
): PackageCandidate {
  const components = pkg.components.map((c) => (kinds.has(c.kind) ? mapper(c) : c))
  return {
    ...pkg,
    components,
    totalPrice: retotal(components),
  }
}

/** Apply only impacted refinements — reuse untouched components. */
export function resolveConstraints(input: {
  pkg: PackageCandidate
  changes: RefinementChangeKind[]
  budgetCap?: number | null
  hasChildren?: boolean
  hard?: Partial<Record<HardConstraintKind, unknown>>
  soft?: Partial<Record<SoftConstraintKind, unknown>>
}): { pkg: PackageCandidate; touchedIds: string[] } {
  let next = { ...input.pkg, components: [...input.pkg.components] }
  const touched = new Set<string>()
  const changes = new Set(input.changes)

  if (changes.has('luxury_upgrade') || input.soft?.luxury) {
    next = mapComponents(next, new Set(['hotel']), (c) => {
      touched.add(c.id)
      return {
        ...c,
        title: c.title.includes('Luxury') ? c.title : `Luxury ${c.title}`,
        price: Math.round(c.price * 1.35),
        payload: {
          ...c.payload,
          luxury: true,
          stars: Math.max(5, typeof c.payload.stars === 'number' ? c.payload.stars : 5),
          quiet: true,
        },
      }
    })
  }

  if (changes.has('economy_downgrade')) {
    next = mapComponents(next, new Set(['flight', 'hotel']), (c) => {
      touched.add(c.id)
      if (c.kind === 'flight') {
        return {
          ...c,
          price: Math.round(c.price * 0.75),
          payload: { ...c.payload, cabin: 'economy' },
        }
      }
      return {
        ...c,
        price: Math.round(c.price * 0.8),
        payload: { ...c.payload, luxury: false, stars: Math.min(3, typeof c.payload.stars === 'number' ? c.payload.stars : 3) },
      }
    })
  }

  if (changes.has('no_early_flights') || changes.has('flight_change')) {
    next = mapComponents(next, new Set(['flight']), (c) => {
      touched.add(c.id)
      const hour = typeof c.payload.departureHour === 'number' ? c.payload.departureHour : 7
      const nextHour = Math.max(10, hour)
      let departureAt = c.payload.departureAt
      if (typeof departureAt === 'string') {
        const d = new Date(departureAt)
        if (!Number.isNaN(d.getTime()) && d.getUTCHours() < 10) {
          d.setUTCHours(10, 0, 0, 0)
          departureAt = d.toISOString()
        }
      }
      return {
        ...c,
        payload: {
          ...c.payload,
          departureHour: nextHour,
          departureAt,
          avoidEarly: true,
        },
      }
    })
  }

  if (changes.has('child_traveler') || input.hasChildren || input.hard?.children) {
    next = mapComponents(next, new Set(['hotel', 'activity']), (c) => {
      touched.add(c.id)
      return {
        ...c,
        payload: { ...c.payload, familyFriendly: true, childrenOk: true },
      }
    })
  }

  if (changes.has('accessibility') || input.hard?.accessibility || input.hard?.wheelchair) {
    next = mapComponents(next, new Set(['hotel', 'transfer', 'flight']), (c) => {
      touched.add(c.id)
      return {
        ...c,
        payload: { ...c.payload, accessible: true, wheelchair: true },
      }
    })
  }

  if (changes.has('halal_food') || input.soft?.food === 'halal') {
    const hasHalal = next.components.some((c) => c.kind === 'activity' && c.payload.halal === true)
    if (!hasHalal) {
      const restaurant: PackageComponent = {
        kind: 'activity',
        id: `halal_dining_${Date.now()}`,
        title: 'Halal restaurant',
        price: 180,
        currency: next.currency,
        payload: {
          halal: true,
          food: 'halal',
          startAt: next.checkIn ? `${String(next.checkIn).slice(0, 10)}T19:00:00.000Z` : null,
          endAt: next.checkIn ? `${String(next.checkIn).slice(0, 10)}T21:00:00.000Z` : null,
        },
      }
      touched.add(restaurant.id)
      next = {
        ...next,
        components: [...next.components, restaurant],
        totalPrice: retotal([...next.components, restaurant]),
      }
    } else {
      next = mapComponents(next, new Set(['activity']), (c) => {
        if (c.payload.food || c.title.toLowerCase().includes('restaurant')) {
          touched.add(c.id)
          return { ...c, payload: { ...c.payload, halal: true, food: 'halal' } }
        }
        return c
      })
    }
  }

  if (changes.has('restaurant_replacement')) {
    next = mapComponents(next, new Set(['activity']), (c) => {
      if (/restaurant|dining|food/i.test(c.title) || c.payload.food) {
        touched.add(c.id)
        return {
          ...c,
          id: `${c.id}_replaced`,
          title: 'Preferred restaurant',
          payload: { ...c.payload, replaced: true },
        }
      }
      return c
    })
  }

  if (changes.has('activity_remove')) {
    const before = next.components.length
    const components = next.components.filter((c) => {
      if (c.kind !== 'activity') return true
      touched.add(c.id)
      return false
    })
    if (components.length !== before) {
      next = { ...next, components, totalPrice: retotal(components) }
    }
  }

  if (changes.has('activity_add') || changes.has('weather_change')) {
    const title = changes.has('weather_change') ? 'Indoor museum' : 'New activity'
    const act: PackageComponent = {
      kind: 'activity',
      id: `act_add_${Date.now()}`,
      title,
      price: 150,
      currency: next.currency,
      payload: {
        quality: 78,
        weatherSafe: changes.has('weather_change'),
        startAt: next.checkIn ? `${String(next.checkIn).slice(0, 10)}T11:00:00.000Z` : null,
        endAt: next.checkIn ? `${String(next.checkIn).slice(0, 10)}T13:00:00.000Z` : null,
      },
    }
    touched.add(act.id)
    next = {
      ...next,
      components: [...next.components, act],
      totalPrice: retotal([...next.components, act]),
    }
  }

  if (changes.has('extra_day')) {
    next = mapComponents(next, new Set(['hotel']), (c) => {
      touched.add(c.id)
      const nightly = c.price
      let checkOut = c.payload.checkOut
      if (typeof checkOut === 'string') {
        const d = new Date(checkOut)
        if (!Number.isNaN(d.getTime())) {
          d.setUTCDate(d.getUTCDate() + 1)
          checkOut = d.toISOString().slice(0, 10)
        }
      }
      return {
        ...c,
        price: Math.round(nightly + nightly / Math.max(1, 3)),
        payload: { ...c.payload, checkOut, extraNight: true },
      }
    })
    next = { ...next, checkOut: typeof next.components.find((c) => c.kind === 'hotel')?.payload.checkOut === 'string'
      ? String(next.components.find((c) => c.kind === 'hotel')!.payload.checkOut)
      : next.checkOut }
  }

  if (changes.has('extra_traveler')) {
    next = mapComponents(next, new Set(['flight', 'hotel']), (c) => {
      touched.add(c.id)
      return {
        ...c,
        price: Math.round(c.price * (c.kind === 'flight' ? 1.9 : 1.25)),
        payload: { ...c.payload, extraTraveler: true },
      }
    })
  }

  if (changes.has('hotel_replacement')) {
    next = mapComponents(next, new Set(['hotel']), (c) => {
      touched.add(c.id)
      return {
        ...c,
        id: `${c.id}_alt`,
        title: `Alternative ${c.title}`,
        payload: { ...c.payload, replaced: true },
      }
    })
  }

  if (changes.has('late_arrival')) {
    next = mapComponents(next, new Set(['flight']), (c) => {
      touched.add(c.id)
      let arrivalAt = c.payload.arrivalAt
      if (typeof arrivalAt === 'string') {
        const d = new Date(arrivalAt)
        if (!Number.isNaN(d.getTime())) {
          d.setUTCHours(21, 0, 0, 0)
          arrivalAt = d.toISOString()
        }
      }
      return { ...c, payload: { ...c.payload, arrivalAt, lateArrival: true } }
    })
  }

  if (changes.has('early_departure')) {
    next = mapComponents(next, new Set(['flight']), (c) => {
      touched.add(c.id)
      return {
        ...c,
        payload: {
          ...c.payload,
          returnDepartureAt: c.payload.returnDepartureAt ?? c.payload.departureAt,
          earlyDeparture: true,
          departureHour: 7,
        },
      }
    })
  }

  if (changes.has('meeting_insertion') || input.hard?.meeting_schedule) {
    const meeting: PackageComponent = {
      kind: 'activity',
      id: `meeting_${Date.now()}`,
      title: 'Business meeting',
      price: 0,
      currency: next.currency,
      payload: {
        meeting: true,
        startAt: next.checkIn ? `${String(next.checkIn).slice(0, 10)}T10:00:00.000Z` : null,
        endAt: next.checkIn ? `${String(next.checkIn).slice(0, 10)}T11:30:00.000Z` : null,
      },
    }
    touched.add(meeting.id)
    next = {
      ...next,
      components: [...next.components, meeting],
      totalPrice: retotal([...next.components, meeting]),
    }
  }

  if (changes.has('budget_change') && input.budgetCap != null && next.totalPrice > input.budgetCap) {
    // Scale impacted priced components toward budget (activities → hotel → flight).
    const scaleToBudget = (kinds: Set<string>) => {
      if (next.totalPrice <= input.budgetCap!) return
      const scalable = next.components.filter((c) => kinds.has(c.kind) && c.price > 0)
      if (scalable.length === 0) return
      const other = next.totalPrice - scalable.reduce((s, c) => s + c.price, 0)
      const room = Math.max(0, input.budgetCap! - other)
      const scalableSum = scalable.reduce((s, c) => s + c.price, 0) || 1
      const factor = Math.min(1, room / scalableSum)
      next = mapComponents(next, kinds, (c) => {
        if (c.price <= 0) return c
        touched.add(c.id)
        return { ...c, price: Math.max(0, Math.round(c.price * factor)) }
      })
    }
    scaleToBudget(new Set(['activity']))
    scaleToBudget(new Set(['hotel']))
    scaleToBudget(new Set(['flight', 'transfer']))
  }

  // Soft walking preference
  if (input.soft?.walking_distance != null) {
    next = mapComponents(next, new Set(['hotel']), (c) => {
      touched.add(c.id)
      return {
        ...c,
        payload: {
          ...c.payload,
          walkMinutes: Math.min(
            typeof c.payload.walkMinutes === 'number' ? c.payload.walkMinutes : 20,
            Number(input.soft?.walking_distance) || 12,
          ),
        },
      }
    })
  }

  next.totalPrice = retotal(next.components)
  return { pkg: next, touchedIds: [...touched] }
}
