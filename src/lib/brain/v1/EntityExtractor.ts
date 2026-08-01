/**
 * Sprint 81/87 — EntityExtractor (Brain v1).
 * Rule-based foundation for conversational entity capture + refinement.
 */

import { emptyBrainV1Entities, type BrainV1Entities } from './types'

/** More specific cities first so Agadir wins over Morocco aliases. */
const DESTINATIONS: Array<{ keys: string[]; value: string }> = [
  { keys: ['agadir', 'أغادير', 'اكادير'], value: 'Agadir' },
  { keys: ['marrakech', 'مراكش'], value: 'Marrakech' },
  { keys: ['fes', 'fez', 'فاس'], value: 'Fes' },
  { keys: ['casablanca', 'الدار البيضاء'], value: 'Casablanca' },
  { keys: ['morocco', 'المغرب', 'مغرب'], value: 'Morocco' },
  { keys: ['turkey', 'turkiye', 'türkiye', 'تركيا'], value: 'Turkey' },
  { keys: ['dubai', 'دبي'], value: 'Dubai' },
  { keys: ['istanbul', 'اسطنبول', 'إسطنبول'], value: 'Istanbul' },
  { keys: ['paris', 'باريس'], value: 'Paris' },
  { keys: ['london', 'لندن'], value: 'London' },
  { keys: ['tokyo', 'طوكيو', 'kyoto', 'كيوتو', 'osaka', 'أوساكا', 'japan', 'اليابان'], value: 'Japan' },
  { keys: ['interlaken', 'إنترلاكن', 'zurich', 'زيورخ', 'geneva', 'جنيف', 'switzerland', 'سويسرا'], value: 'Switzerland' },
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

/** All matching destinations in table order (specific cities before countries when ordered so). */
function matchAll(text: string, table: Array<{ keys: string[]; value: string }>): string[] {
  const lower = text.toLowerCase()
  const hits: string[] = []
  for (const row of table) {
    if (row.keys.some((k) => lower.includes(k.toLowerCase()) || text.includes(k))) {
      if (!hits.includes(row.value)) hits.push(row.value)
    }
  }
  return hits
}

/**
 * Prefer the destination the traveler is switching *to* when a refine/instead cue is present.
 * Example: «صرت أبغى تركيا بدل المغرب» → Turkey (not Morocco).
 */
function pickDestination(
  text: string,
  lower: string,
  priorDestination: string | null | undefined,
): string | null {
  const hits = matchAll(text, DESTINATIONS)
  if (hits.length === 0) return null
  if (hits.length === 1) return hits[0]!

  const refine = hasRefineCue(text, lower)
  if (refine) {
    // Prefer token after بدل / instead / change to.
    const afterInstead =
      /(?:بدل|instead(?: of)?|change (?:it )?to|صرت أبغى|صرت ابي)\s+([^\s,.!?،]+)/i.exec(text)
    if (afterInstead?.[1]) {
      const focused = matchFirst(afterInstead[1], DESTINATIONS)
      if (focused) return focused
    }
    if (priorDestination) {
      const next = hits.find((h) => h !== priorDestination)
      if (next) return next
    }
  }
  return hits[0]!
}

function parseIsoDate(text: string): string | null {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(text)
  return m?.[1] ?? null
}

/** Digits or common EN/AR word numbers for traveler counts (no bare "a"/"an"). */
const COUNT_TOKEN =
  '(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|واحد|واحدة|اثنين|اثنان|اثنتين|ثلاثة|اربعة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة|عشرة)'

function parseCountToken(raw: string | undefined): number | null {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (/^\d+$/.test(lower)) return Number(lower)
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    واحد: 1,
    واحدة: 1,
    اثنين: 2,
    اثنان: 2,
    اثنتين: 2,
    ثلاثة: 3,
    اربعة: 4,
    أربعة: 4,
    خمسة: 5,
    ستة: 6,
    سبعة: 7,
    ثمانية: 8,
    تسعة: 9,
    عشرة: 10,
  }
  return words[lower] ?? words[raw] ?? null
}

function hasDestinationCue(text: string, lower: string): boolean {
  return /to |travel to|trip to|visit |إلى |الى |في |سفر|سافر|رحلة/.test(lower)
    || /إلى |الى /.test(text)
}

function hasRefineCue(text: string, lower: string): boolean {
  return /actually|make it|change (?:it )?to|instead|focus on|switch to|only |بدل|خلها|خليها|اجعلها|اجعله|غيّر|غير وجهة|فقط/.test(lower)
    || /بدل|خلها|خليها|اجعل/.test(text)
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

    const destination = pickDestination(text, lower, prior?.destination ?? entities.destination)
    if (destination && destination !== entities.origin) {
      const different = destination !== entities.destination
      const cue = hasDestinationCue(text, lower) || hasRefineCue(text, lower)
      const bareRefine =
        Boolean(prior?.destination)
        && different
        && text.trim().length < 48
        && Boolean(destination)
      if (!entities.destination || (different && (cue || bareRefine))) {
        // Avoid stealing an origin city as destination when "from" is present.
        if (!( /from |من /.test(lower) && destination === matchFirst(text, ORIGINS))) {
          entities.destination = destination
        }
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
      new RegExp(`(?:adults?|بالغ|بالغين)\\s*[:=]?\\s*(${COUNT_TOKEN})\\b`, 'i').exec(text)
      ?? new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:adults?|بالغ|بالغين)`, 'i').exec(text)
    {
      const n = parseCountToken(adults?.[1])
      if (n != null) entities.adults = n
      else if (/\b(?:an?)\s+adults?\b/i.test(text)) entities.adults = 1
    }

    const children =
      new RegExp(`(?:children|child|kids|أطفال|طفل|طفلين)\\s*[:=]?\\s*(${COUNT_TOKEN})\\b`, 'i').exec(text)
      ?? new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:children|child|kids|أطفال|طفل|طفلين)\\b`, 'i').exec(text)
    {
      const n = parseCountToken(children?.[1])
      if (n != null) entities.children = n
    }

    // Family cue without explicit counts → at least mark children unknown but adults 2 later via slots.
    if (
      entities.children == null
      && /family|عائلة|عائلية|with (?:my )?kids|مع الأطفال/.test(lower)
    ) {
      // leave children null; SlotFillingEngine tags tripStyle=family
    }

    const infants =
      new RegExp(`(?:infants?|رض[يى]ع)\\s*[:=]?\\s*(${COUNT_TOKEN})\\b`, 'i').exec(text)
      ?? new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:infants?|رضع)\\b`, 'i').exec(text)
    {
      const n = parseCountToken(infants?.[1])
      if (n != null) entities.infants = n
    }

    const travelers =
      new RegExp(`(?:travelers?|مسافر|أشخاص|persons?)\\s*[:=]?\\s*(${COUNT_TOKEN})\\b`, 'i').exec(text)
      ?? new RegExp(`\\b(${COUNT_TOKEN})\\s*(?:travelers?|أشخاص|مسافر)\\b`, 'i').exec(text)
    {
      const n = parseCountToken(travelers?.[1])
      if (n != null) entities.travelerCount = n
    }
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
