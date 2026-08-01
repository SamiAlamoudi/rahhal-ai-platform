/**
 * Sprint 81 — EntityExtractor (Brain v1).
 * Rule-based foundation for conversational entity capture.
 */

import { emptyBrainV1Entities, type BrainV1Entities } from './types'

const DESTINATIONS: Array<{ keys: string[]; value: string }> = [
  { keys: ['morocco', 'المغرب', 'مراكش', 'marrakech', 'casablanca', 'الدار البيضاء'], value: 'Morocco' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول'], value: 'Istanbul' },
  { keys: ['paris', 'باريس'], value: 'Paris' },
  { keys: ['london', 'لندن'], value: 'London' },
  { keys: ['tokyo', 'طوكيو', 'japan', 'اليابان'], value: 'Japan' },
  { keys: ['cairo', 'القاهرة', 'egypt', 'مصر'], value: 'Egypt' },
  { keys: ['maldives', 'المالديف'], value: 'Maldives' },
  { keys: ['bali', 'بالي'], value: 'Bali' },
  { keys: ['riyadh', 'الرياض'], value: 'Riyadh' },
  { keys: ['jeddah', 'جدة'], value: 'Jeddah' },
]

const ORIGINS: Array<{ keys: string[]; value: string }> = [
  { keys: ['from riyadh', 'من الرياض', 'الرياض'], value: 'Riyadh' },
  { keys: ['from jeddah', 'من جدة', 'جدة'], value: 'Jeddah' },
  { keys: ['from dubai', 'من دبي'], value: 'Dubai' },
  { keys: ['from cairo', 'من القاهرة'], value: 'Cairo' },
]

function matchFirst(text: string, table: Array<{ keys: string[]; value: string }>): string | null {
  const lower = text.toLowerCase()
  for (const row of table) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()) || text.includes(k))) return row.value
  }
  return null
}

function parseIsoDate(text: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(text)
  return m?.[1] ?? null
}

export class EntityExtractor {
  extract(text: string, prior?: Partial<BrainV1Entities>): BrainV1Entities {
    const entities = { ...emptyBrainV1Entities(), ...prior }
    entities.travelDates = {
      start: prior?.travelDates?.start ?? null,
      end: prior?.travelDates?.end ?? null,
    }
    entities.activities = [...(prior?.activities ?? [])]

    const lower = text.toLowerCase()

    const destination = matchFirst(text, DESTINATIONS)
    if (destination && destination !== entities.origin) {
      // Prefer destination from "to X" / "إلى X" cues when present.
      if (/to |إلى |الى |في /.test(lower) || !entities.destination) {
        entities.destination = destination
      }
    }

    const origin = matchFirst(text, ORIGINS)
    if (origin) entities.origin = origin
    // If both matched same city from loose keys, keep origin only when "from" cue exists.
    if (entities.origin && entities.origin === entities.destination && !/from |من /.test(lower)) {
      entities.origin = prior?.origin ?? null
    }

    const start = parseIsoDate(text)
    if (start) entities.travelDates.start = start
    const range = /(\d{4}-\d{2}-\d{2}).{0,20}(\d{4}-\d{2}-\d{2})/.exec(text)
    if (range) {
      entities.travelDates.start = range[1] ?? entities.travelDates.start
      entities.travelDates.end = range[2] ?? entities.travelDates.end
    }

    if (/flexible|مرن|مرنة|أي وقت|anytime/.test(lower)) {
      entities.flexibleDates = true
    }

    const adults =
      /(?:adults?|بالغ|بالغين)\s*[:=]?\s*(\d+)/i.exec(text)
      ?? /(\d+)\s*(?:adults?|بالغ)/i.exec(text)
    if (adults?.[1]) entities.adults = Number(adults[1])

    const children =
      /(?:children|child|أطفال|طفل)\s*[:=]?\s*(\d+)/i.exec(text)
      ?? /(\d+)\s*(?:children|kids|أطفال)/i.exec(text)
    if (children?.[1]) entities.children = Number(children[1])

    const infants =
      /(?:infants?|رض[يى]ع)\s*[:=]?\s*(\d+)/i.exec(text)
      ?? /(\d+)\s*(?:infants?|رضع)/i.exec(text)
    if (infants?.[1]) entities.infants = Number(infants[1])

    const travelers = /(?:travelers?|مسافر|أشخاص|persons?)\s*[:=]?\s*(\d+)/i.exec(text)
      ?? /(\d+)\s*(?:travelers?|أشخاص|مسافر)/i.exec(text)
    if (travelers?.[1]) entities.travelerCount = Number(travelers[1])
    if (entities.travelerCount == null && entities.adults != null) {
      entities.travelerCount =
        (entities.adults ?? 0) + (entities.children ?? 0) + (entities.infants ?? 0)
    }

    const budget = /(?:budget|ميزانية)\s*[:=]?\s*([0-9][0-9,]*)/i.exec(text)
      ?? /([0-9][0-9,]*)\s*(?:sar|riyal|ريال)/i.exec(text)
    if (budget?.[1]) entities.budget = Number(budget[1].replace(/,/g, ''))

    if (/business|درجة رجال|رجال الأعمال/.test(lower)) entities.cabinClass = 'business'
    else if (/first class|أولى|درجة أولى/.test(lower)) entities.cabinClass = 'first'
    else if (/premium economy|اقتصادية مميزة/.test(lower)) entities.cabinClass = 'premium_economy'
    else if (/economy|سياحية|اقتصادية/.test(lower)) entities.cabinClass = 'economy'

    if (/saudia|السعودية/.test(lower)) entities.preferredAirline = 'Saudia'
    else if (/emirates|طيران الإمارات/.test(lower)) entities.preferredAirline = 'Emirates'
    else if (/qatar|القطرية/.test(lower)) entities.preferredAirline = 'Qatar Airways'

    const stars = /([1-5])\s*[- ]?\s*stars?|([1-5])\s*نجوم/.exec(lower)
    if (stars) {
      const n = Number(stars[1] ?? stars[2])
      entities.starLevel = n
      entities.hotelRating = n
    }

    if (/halal|حلال/.test(lower)) entities.mealPreference = 'halal'
    else if (/vegetarian|نباتي/.test(lower)) entities.mealPreference = 'vegetarian'

    for (const activity of ['beach', 'شاطئ', 'museum', 'متحف', 'shopping', 'تسوق', 'ski', 'تزلج']) {
      if (lower.includes(activity) || text.includes(activity)) {
        const normalized =
          /beach|شاطئ/.test(activity) ? 'beach'
            : /museum|متحف/.test(activity) ? 'museum'
              : /shopping|تسوق/.test(activity) ? 'shopping'
                : 'ski'
        if (!entities.activities.includes(normalized)) entities.activities.push(normalized)
      }
    }

    if (/train|قطار/.test(lower)) entities.transportation = 'train'
    else if (/car|سيارة|rent/.test(lower)) entities.transportation = 'car'
    else if (/taxi|أوبر|uber/.test(lower)) entities.transportation = 'taxi'

    if (/english|إنجليزي|انجليزي/.test(lower)) entities.language = 'en'
    else if (/arabic|عربي/.test(lower)) entities.language = 'ar'

    if (/usd|دولار/.test(lower)) entities.currency = 'USD'
    else if (/eur|يورو/.test(lower)) entities.currency = 'EUR'
    else if (/sar|ريال/.test(lower)) entities.currency = 'SAR'

    if (/saudi|سعودي/.test(lower)) entities.nationality = 'SA'
    else if (/egyptian|مصري/.test(lower)) entities.nationality = 'EG'

    if (/visa|تأشير|فيزا/.test(lower)) {
      entities.visaDestination = entities.destination
    }

    return entities
  }
}

export function createEntityExtractor(): EntityExtractor {
  return new EntityExtractor()
}
