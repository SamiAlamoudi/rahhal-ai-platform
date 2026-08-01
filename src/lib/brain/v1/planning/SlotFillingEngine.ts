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

    const special = this.extractSpecialRequests(text, prior, entities)
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
      specialRequests: this.mergeSpecialRequests(prior.specialRequests, patch.specialRequests),
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
    const star = /(\d)\s*[- ]?\s*stars?/.exec(lower) || /(\d)\s*نجوم/.exec(text)
    if (star) return `${star[1]}-star`
    if (/riad|رياض/.test(lower) || /رياض/.test(text)) return 'riad'
    if (/resort|منتجع/.test(lower)) return 'resort'
    if (/boutique|بوتيك/.test(lower)) return 'boutique'
    if (/luxury|فاخر|فخم/.test(lower)) return 'luxury'
    if (/mid[- ]?range|متوسط/.test(lower)) return 'mid-range'
    return null
  }

  /**
   * Tagged memory fields in specialRequests (pipe-separated):
   * tripStyle= / preferredCity= / food= / hotelLevel= / duration= / visaInterest=
   */
  private extractSpecialRequests(
    text: string,
    prior: TravelPlanSlots | undefined,
    entities: {
      destination: string | null
      mealPreference: string | null
      starLevel: number | null
      transportation: string | null
    },
  ): string | null {
    const lower = text.toLowerCase()
    const tags: string[] = []

    if (/wheelchair|كرسي متحرك/.test(lower) || /كرسي متحرك/.test(text)) {
      tags.push('wheelchair_assistance')
    }
    if (/honeymoon|شهر العسل/.test(lower) || /شهر العسل/.test(text)) {
      tags.push('honeymoon')
    }

    if (/business trip|رحلة عمل|سفر عمل|\bbusiness\b.*\b(trip|travel|to)\b|\b(trip|travel)\b.*\bbusiness\b/.test(lower)
      || /رحلة عمل|سفر عمل/.test(text)) {
      tags.push('tripStyle=business')
    } else if (/weekend|نهاية أسبوع|عطلة قصيرة/.test(lower) || /نهاية أسبوع/.test(text)) {
      tags.push('tripStyle=weekend')
      tags.push('duration=3')
    } else if (/family|عائلة|عائلية|with (?:my )?kids|مع الأطفال/.test(lower) || /عائلة/.test(text)) {
      tags.push('tripStyle=family')
    } else if (/\bsolo\b|فردي|وحدي/.test(lower)) {
      tags.push('tripStyle=solo')
    }

    // City focus when refining inside a country (e.g. Morocco → Agadir).
    if (entities.destination && /agadir|أغادير|اكادير|marrakech|مراكش|fes|فاس|casablanca|الدار/i.test(entities.destination)) {
      tags.push(`preferredCity=${entities.destination}`)
    }

    if (entities.mealPreference) tags.push(`food=${entities.mealPreference}`)
    else if (/halal|حلال/.test(lower)) tags.push('food=halal')
    else if (/vegetarian|نباتي/.test(lower)) tags.push('food=vegetarian')

    if (entities.starLevel != null) tags.push(`hotelLevel=${entities.starLevel}-star`)
    else if (/luxury|فاخر/.test(lower)) tags.push('hotelLevel=luxury')

    if (entities.transportation) tags.push(`transport=${entities.transportation}`)

    if (/visa|تأشير|فيزا/.test(lower)) tags.push('visaInterest=true')

    if (!tags.length) return null
    return this.mergeSpecialRequests(prior?.specialRequests ?? null, tags.join('|'))
  }

  private mergeSpecialRequests(
    prior: string | null | undefined,
    patch: string | null | undefined,
  ): string | null {
    if (!patch) return prior ?? null
    if (!prior) return patch
    const map = new Map<string, string>()
    const ingest = (raw: string) => {
      for (const part of raw.split('|').map((p) => p.trim()).filter(Boolean)) {
        const eq = part.indexOf('=')
        if (eq > 0) map.set(part.slice(0, eq), part)
        else map.set(part, part)
      }
    }
    ingest(prior)
    ingest(patch)
    return [...map.values()].join('|')
  }
}

export function createSlotFillingEngine(extractor?: EntityExtractor): SlotFillingEngine {
  return new SlotFillingEngine(extractor)
}
