import type { CurrencyCode, LocaleCode } from '../types'
import type { HotelClass, TransportType } from '../travel/types'
import type { ExtractedEntities } from './types'

const CITY_MAP: Record<string, string> = {
  الرياض: 'Riyadh',
  ruh: 'Riyadh',
  riyadh: 'Riyadh',
  جدة: 'Jeddah',
  jeddah: 'Jeddah',
  jed: 'Jeddah',
  دبي: 'Dubai',
  dubai: 'Dubai',
  dxb: 'Dubai',
  اسطنبول: 'Istanbul',
  إسطنبول: 'Istanbul',
  istanbul: 'Istanbul',
  ist: 'Istanbul',
  القاهرة: 'Cairo',
  cairo: 'Cairo',
  cai: 'Cairo',
  لندن: 'London',
  london: 'London',
  lhr: 'London',
  الدوحة: 'Doha',
  doha: 'Doha',
  doh: 'Doha',
}

const CURRENCY_MAP: Record<string, CurrencyCode> = {
  'ر.س': 'SAR',
  رس: 'SAR',
  sar: 'SAR',
  ريال: 'SAR',
  usd: 'USD',
  $: 'USD',
  eur: 'EUR',
  '€': 'EUR',
  aed: 'AED',
  درهم: 'AED',
  gbp: 'GBP',
  '£': 'GBP',
}

function normalizeCity(token: string): string | undefined {
  return CITY_MAP[token.trim().toLowerCase()] ?? CITY_MAP[token.trim()]
}

function parseIsoLike(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)
  if (iso?.[1]) return iso[1]
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/)
  if (slash) {
    const dd = slash[1]!.padStart(2, '0')
    const mm = slash[2]!.padStart(2, '0')
    return `${slash[3]}-${mm}-${dd}`
  }
  return undefined
}

export class EntityExtractor {
  extract(text: string): ExtractedEntities {
    const rawMentions: string[] = []
    const entities: ExtractedEntities = { rawMentions }
    const lower = text.toLowerCase()

    // Origin / destination (EN + AR)
    const enTo = text.match(/\b(?:from)\s+([A-Za-z\u0600-\u06FF]+)\s+(?:to)\s+([A-Za-z\u0600-\u06FF]+)/i)
    const arTo = text.match(/(?:من)\s+([A-Za-z\u0600-\u06FF]+)\s+(?:إلى|الى)\s+([A-Za-z\u0600-\u06FF]+)/i)
    const pair = enTo ?? arTo
    if (pair) {
      entities.origin = normalizeCity(pair[1]!) ?? pair[1]
      entities.destination = normalizeCity(pair[2]!) ?? pair[2]
      rawMentions.push(pair[1]!, pair[2]!)
    } else {
      for (const [token, city] of Object.entries(CITY_MAP)) {
        if (lower.includes(token) || text.includes(token)) {
          if (!entities.destination) {
            entities.destination = city
            rawMentions.push(token)
          } else if (!entities.origin && city !== entities.destination) {
            entities.origin = city
            rawMentions.push(token)
          }
        }
      }
    }

    const departure = parseIsoLike(text)
    if (departure) {
      entities.dates = { ...entities.dates, departure }
      rawMentions.push(departure)
    }
    const returnMatch = text.match(/(?:return|عودة|رجوع).*?(20\d{2}-\d{2}-\d{2})/i)
    if (returnMatch?.[1]) {
      entities.dates = { ...entities.dates, return: returnMatch[1] }
    }

    const nights = text.match(/(\d+)\s*(?:nights?|ليال[يي]|ليلة)/i)
    if (nights?.[1]) entities.duration = Number(nights[1])

    const budget =
      text.match(
        /(?:budget|ميزانية|بميزانية)\s*(\d{3,6})\s*(ر\.?س|sar|usd|eur|aed|gbp|ريال|درهم|\$|€|£)?/i,
      ) ??
      text.match(/(\d{3,6})\s*(ر\.?س|sar|usd|eur|aed|gbp|ريال|درهم|\$|€|£)/i)
    if (budget?.[1]) {
      entities.budget = Number(budget[1])
      const curRaw = (budget[2] ?? '').toLowerCase()
      if (curRaw && CURRENCY_MAP[curRaw]) entities.currency = CURRENCY_MAP[curRaw]
    }

    const adults = text.match(/(\d+)\s*(?:adults?|بالغ|بالغين|أشخاص|travellers?|travelers?)/i)
    const children = text.match(/(\d+)\s*(?:children|child|أطفال|طفل)/i)
    if (adults?.[1] || children?.[1]) {
      entities.travellers = {
        adults: adults?.[1] ? Number(adults[1]) : 1,
        children: children?.[1] ? Number(children[1]) : 0,
      }
      if (children?.[1]) entities.children = Number(children[1])
    }

    const stars = text.match(/(\d)\s*(?:star|نجوم|نجمة)/i)
    if (stars?.[1]) {
      const n = Number(stars[1]) as HotelClass
      if (n >= 1 && n <= 5) entities.hotelClass = n
    }

    const airline = text.match(/\b(saudia|emirates|qatar airways|flynas|etihad|السعودية|الإمارات|القطرية)\b/i)
    if (airline?.[1]) entities.airline = airline[1]

    const visa = text.match(/(?:visa|تأشيرة|فيزا)\s*(?:for|إلى|الى|ل)?\s*([A-Za-z\u0600-\u06FF]+)/i)
    if (visa?.[1]) entities.visaCountry = normalizeCity(visa[1]) ?? visa[1]

    if (/\bflight\b|طيران/.test(lower) || /طيران/.test(text)) entities.transportType = 'flight'
    else if (/\btrain\b|قطار/.test(lower) || /قطار/.test(text)) entities.transportType = 'train'
    else if (/\btaxi\b|transfer|تاكسي|توصيل/.test(lower) || /تاكسي/.test(text)) {
      entities.transportType = 'transfer' satisfies TransportType
    }

    if (/[\u0600-\u06FF]/.test(text)) entities.language = 'ar' satisfies LocaleCode
    else entities.language = 'en'

    const prefs: string[] = []
    if (/quiet|هادئ|هدوء/.test(lower) || /هادئ/.test(text)) prefs.push('quiet')
    if (/sea view|إطلالة|اطلالة/.test(lower) || /إطلالة/.test(text)) prefs.push('sea_view')
    if (/halal|حلال/.test(lower) || /حلال/.test(text)) prefs.push('halal')
    if (prefs.length) entities.preferences = prefs

    const needs: string[] = []
    if (/wheelchair|كرسي متحرك/.test(lower) || /كرسي متحرك/.test(text)) needs.push('wheelchair')
    if (/infant|رضيع/.test(lower) || /رضيع/.test(text)) needs.push('infant')
    if (needs.length) entities.specialNeeds = needs

    return entities
  }
}
