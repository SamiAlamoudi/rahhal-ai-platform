import type { BrainLocale, BudgetSlot, TravelDates } from '../types'
import type { PlanningField, PlanningSession, PlanningStage } from './types'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export function emptyBudget(): BudgetSlot {
  return { amount: null, currency: null, flexible: false }
}

export function emptyTravelDates(): TravelDates {
  return { startDate: null, endDate: null, durationDays: null, flexible: false }
}

export function createPlanningSession(
  conversationId = newId('plan_sess'),
  locale: BrainLocale = 'ar',
): PlanningSession {
  const now = nowIso()
  return {
    id: newId('ps'),
    conversationId,
    locale,
    stage: 'collect',
    destination: null,
    departureCity: null,
    travelDates: emptyTravelDates(),
    flexibility: false,
    travelerCount: null,
    adults: null,
    children: null,
    infants: null,
    cabinClass: null,
    hotelPreferences: [],
    roomRequirements: null,
    transportation: [],
    activities: [],
    budget: emptyBudget(),
    airlinePreferences: [],
    notes: null,
    askedFields: [],
    answeredFields: [],
    tripPlanId: null,
    createdAt: now,
    updatedAt: now,
  }
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    if (!out.some((v) => v.toLowerCase() === trimmed.toLowerCase())) out.push(trimmed)
  }
  return out
}

function markAnswered(session: PlanningSession, fields: PlanningField[]): void {
  for (const field of fields) {
    if (!session.answeredFields.includes(field)) session.answeredFields.push(field)
  }
}

export const PlanningSessionApi = {
  create: createPlanningSession,

  clone(session: PlanningSession): PlanningSession {
    return {
      ...session,
      travelDates: { ...session.travelDates },
      budget: { ...session.budget },
      hotelPreferences: [...session.hotelPreferences],
      transportation: [...session.transportation],
      activities: [...session.activities],
      airlinePreferences: [...session.airlinePreferences],
      askedFields: [...session.askedFields],
      answeredFields: [...session.answeredFields],
    }
  },

  setStage(session: PlanningSession, stage: PlanningStage): PlanningSession {
    const next = PlanningSessionApi.clone(session)
    next.stage = stage
    next.updatedAt = nowIso()
    return next
  },

  markAsked(session: PlanningSession, fields: PlanningField[]): PlanningSession {
    const next = PlanningSessionApi.clone(session)
    for (const field of fields) {
      if (!next.askedFields.includes(field)) next.askedFields.push(field)
    }
    next.updatedAt = nowIso()
    return next
  },

  applyPartial(
    base: PlanningSession,
    patch: Partial<PlanningSession>,
  ): PlanningSession {
    const next = PlanningSessionApi.clone(base)
    const answered: PlanningField[] = []

    if (patch.destination) {
      next.destination = patch.destination
      answered.push('destination')
    }
    if (patch.departureCity) {
      next.departureCity = patch.departureCity
      answered.push('departureCity')
    }
    if (patch.travelDates) {
      next.travelDates = {
        startDate: patch.travelDates.startDate ?? next.travelDates.startDate,
        endDate: patch.travelDates.endDate ?? next.travelDates.endDate,
        durationDays: patch.travelDates.durationDays ?? next.travelDates.durationDays,
        flexible: patch.travelDates.flexible || next.travelDates.flexible,
      }
      next.flexibility = next.flexibility || next.travelDates.flexible
      if (
        next.travelDates.startDate ||
        next.travelDates.endDate ||
        next.travelDates.durationDays != null ||
        next.travelDates.flexible
      ) {
        answered.push('travelDates')
      }
    }
    if (typeof patch.flexibility === 'boolean' && patch.flexibility) {
      next.flexibility = true
      next.travelDates = { ...next.travelDates, flexible: true }
      answered.push('travelDates')
    }
    if (patch.travelerCount != null || patch.adults != null || patch.children != null || patch.infants != null) {
      next.adults = patch.adults ?? next.adults
      next.children = patch.children ?? next.children
      next.infants = patch.infants ?? next.infants
      const adults = next.adults ?? 0
      const children = next.children ?? 0
      const infants = next.infants ?? 0
      const summed = adults + children + infants
      next.travelerCount =
        patch.travelerCount ?? (summed > 0 ? summed : next.travelerCount)
      if (next.travelerCount != null) answered.push('travelerCount')
    }
    if (patch.cabinClass) {
      next.cabinClass = patch.cabinClass
      answered.push('cabinClass')
    }
    if (patch.hotelPreferences && patch.hotelPreferences.length) {
      next.hotelPreferences = unique([
        ...next.hotelPreferences,
        ...patch.hotelPreferences,
      ])
      answered.push('hotelPreferences')
    }
    if (patch.roomRequirements) {
      next.roomRequirements = patch.roomRequirements
      answered.push('roomRequirements')
    }
    if (patch.transportation && patch.transportation.length) {
      next.transportation = unique([...next.transportation, ...patch.transportation])
      answered.push('transportation')
    }
    if (patch.activities && patch.activities.length) {
      next.activities = unique([...next.activities, ...patch.activities])
      answered.push('activities')
    }
    if (patch.budget) {
      next.budget = {
        amount: patch.budget.amount ?? next.budget.amount,
        currency: patch.budget.currency ?? next.budget.currency,
        flexible: patch.budget.flexible || next.budget.flexible,
      }
      if (next.budget.amount != null || next.budget.flexible) answered.push('budget')
    }
    if (patch.airlinePreferences && patch.airlinePreferences.length) {
      next.airlinePreferences = unique([
        ...next.airlinePreferences,
        ...patch.airlinePreferences,
      ])
      answered.push('airlinePreferences')
    }
    if (patch.notes) {
      next.notes = patch.notes
      answered.push('notes')
    }
    if (patch.locale) next.locale = patch.locale
    if (patch.tripPlanId !== undefined) next.tripPlanId = patch.tripPlanId

    markAnswered(next, answered)
    next.updatedAt = nowIso()
    return next
  },
}
