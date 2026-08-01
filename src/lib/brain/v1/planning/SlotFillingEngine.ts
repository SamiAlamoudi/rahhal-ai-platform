/**
 * Sprint 84 — Slot Filling Engine.
 * Fills TravelPlan slots from natural language (rule-based; no providers).
 */

import { EntityExtractor } from '../EntityExtractor'
import {
  emptyTravelPlanSlots,
  type TravelPlanSlotKey,
  type TravelPlanSlots,
} from './types'

const REQUIRED_TRIP_SLOTS: TravelPlanSlotKey[] = [
  'destination',
  'dates',
  'origin',
  'adults',
]

export class SlotFillingEngine {
  private readonly extractor: EntityExtractor

  constructor(extractor?: EntityExtractor) {
    this.extractor = extractor ?? new EntityExtractor()
  }

  /** Extract slot patch from user text (does not mutate prior). */
  extract(text: string, prior?: TravelPlanSlots): Partial<TravelPlanSlots> {
    const entities = this.extractor.extract(text, {
      destination: prior?.destination ?? null,
      origin: prior?.origin ?? null,
      travelDates: prior?.dates ?? { start: null, end: null },
      flexibleDates: prior?.flexibleDates ?? null,
      adults: prior?.adults ?? null,
      children: prior?.children ?? null,
      budget: prior?.budget ?? null,
      cabinClass: prior?.cabin ?? null,
      currency: prior?.currency ?? null,
      language: prior?.language ?? null,
      transportation: prior?.transportation ?? null,
      activities: prior?.activities ?? [],
      visaDestination: prior?.visa ?? null,
      hotelRating: null,
      starLevel: null,
      mealPreference: null,
      nationality: null,
      travelerCount: prior?.adults ?? null,
      infants: null,
      preferredAirline: null,
    })

    const patch: Partial<TravelPlanSlots> = {}
    if (entities.destination) patch.destination = entities.destination
    if (entities.origin) patch.origin = entities.origin
    if (entities.travelDates.start || entities.travelDates.end) {
      patch.dates = {
        start: entities.travelDates.start,
        end: entities.travelDates.end,
      }
    }
    if (entities.flexibleDates != null) patch.flexibleDates = entities.flexibleDates
    if (entities.adults != null) patch.adults = entities.adults
    if (entities.children != null) patch.children = entities.children
    if (entities.cabinClass) patch.cabin = entities.cabinClass
    if (entities.budget != null) patch.budget = entities.budget
    if (entities.transportation) patch.transportation = entities.transportation
    if (entities.activities.length) patch.activities = entities.activities
    if (entities.visaDestination) patch.visa = entities.visaDestination
    if (entities.language) patch.language = entities.language
    if (entities.currency) patch.currency = entities.currency

    const hotel = this.extractHotelPreference(text)
    if (hotel) patch.hotelPreference = hotel

    const special = this.extractSpecialRequests(text)
    if (special) patch.specialRequests = special

    // Flexible dates phrase without ISO still counts as dates satisfaction later.
    return patch
  }

  /** Merge patch into slots — only overwrites when patch provides a value. */
  merge(prior: TravelPlanSlots, patch: Partial<TravelPlanSlots>): TravelPlanSlots {
    return {
      ...prior,
      ...patch,
      dates: {
        start: patch.dates?.start ?? prior.dates.start,
        end: patch.dates?.end ?? prior.dates.end,
      },
      activities: patch.activities
        ? [...new Set([...prior.activities, ...patch.activities])]
        : [...prior.activities],
      origin: patch.origin ?? prior.origin,
      destination: patch.destination ?? prior.destination,
      adults: patch.adults ?? prior.adults,
      children: patch.children ?? prior.children,
      cabin: patch.cabin ?? prior.cabin,
      budget: patch.budget ?? prior.budget,
      hotelPreference: patch.hotelPreference ?? prior.hotelPreference,
      transportation: patch.transportation ?? prior.transportation,
      visa: patch.visa ?? prior.visa,
      language: patch.language ?? prior.language,
      currency: patch.currency ?? prior.currency,
      specialRequests: patch.specialRequests ?? prior.specialRequests,
      flexibleDates: patch.flexibleDates ?? prior.flexibleDates,
    }
  }

  /** Keys that changed between before/after (for revision). */
  diff(before: TravelPlanSlots, after: TravelPlanSlots): TravelPlanSlotKey[] {
    const keys: TravelPlanSlotKey[] = [
      'origin',
      'destination',
      'dates',
      'flexibleDates',
      'adults',
      'children',
      'cabin',
      'budget',
      'hotelPreference',
      'transportation',
      'activities',
      'visa',
      'language',
      'currency',
      'specialRequests',
    ]
    return keys.filter((key) => {
      if (key === 'dates') {
        return (
          before.dates.start !== after.dates.start
          || before.dates.end !== after.dates.end
        )
      }
      if (key === 'activities') {
        return before.activities.join('|') !== after.activities.join('|')
      }
      return before[key] !== after[key]
    })
  }

  missingRequired(slots: TravelPlanSlots): TravelPlanSlotKey[] {
    const missing: TravelPlanSlotKey[] = []
    if (!slots.destination) missing.push('destination')
    if (!slots.dates.start && !slots.flexibleDates) missing.push('dates')
    // Origin after destination+dates (minimum path — Morocco → ask when first).
    if (slots.destination && (slots.dates.start || slots.flexibleDates) && !slots.origin) {
      missing.push('origin')
    }
    if (
      slots.destination
      && (slots.dates.start || slots.flexibleDates)
      && slots.origin
      && slots.adults == null
    ) {
      missing.push('adults')
    }
    return missing
  }

  /** All unsupported/empty optional slots for notes (not all asked). */
  missingOptional(slots: TravelPlanSlots): TravelPlanSlotKey[] {
    const optional: TravelPlanSlotKey[] = [
      'budget',
      'cabin',
      'hotelPreference',
      'transportation',
      'activities',
      'visa',
      'language',
      'currency',
      'specialRequests',
      'children',
    ]
    return optional.filter((key) => {
      if (key === 'activities') return slots.activities.length === 0
      return slots[key] == null
    })
  }

  createEmpty(): TravelPlanSlots {
    return emptyTravelPlanSlots()
  }

  requiredSlotOrder(): TravelPlanSlotKey[] {
    return [...REQUIRED_TRIP_SLOTS]
  }

  private extractHotelPreference(text: string): string | null {
    const lower = text.toLowerCase()
    const star = /(\d)\s*stars?/.exec(lower) || /(\d)\s*نجوم/.exec(text)
    if (star) return `${star[1]}-star`
    if (/riad|رياض/.test(lower) || /رياض/.test(text)) return 'riad'
    if (/resort|منتجع/.test(lower)) return 'resort'
    if (/boutique|بوتيك/.test(lower)) return 'boutique'
    return null
  }

  private extractSpecialRequests(text: string): string | null {
    const lower = text.toLowerCase()
    if (/wheelchair|كرسي متحرك/.test(lower) || /كرسي متحرك/.test(text)) {
      return 'wheelchair_assistance'
    }
    if (/honeymoon|شهر العسل/.test(lower) || /شهر العسل/.test(text)) {
      return 'honeymoon'
    }
    if (/halal|حلال/.test(lower) || /حلال/.test(text)) return 'halal'
    return null
  }
}

export function createSlotFillingEngine(extractor?: EntityExtractor): SlotFillingEngine {
  return new SlotFillingEngine(extractor)
}
