/**
 * Sprint 28 — MemoryExtractor
 * Extract structured travel preferences from natural conversation (rule-based).
 * Passport / nationality only when explicitly provided.
 */

import { RequirementExtractor } from '../requirementExtractor'
import type { BrainLocale, CabinClass } from '../types'
import type {
  EnrichedConversationMemory,
  FamilyMember,
  LoyaltyProgramEntry,
  MealPreference,
  MemoryExtractionResult,
  SeatPreference,
  TravelPreferenceProfile,
  VisaStatus,
} from './types'

const AIRLINE_RULES: Array<[RegExp, string]> = [
  [/saudia|السعودية/, 'Saudia'],
  [/emirates|طيران الإمارات|الامارات/, 'Emirates'],
  [/qatar\s*airways|القطرية/, 'Qatar Airways'],
  [/flynas|ناس/, 'flynas'],
  [/etihad|الاتحاد/, 'Etihad'],
  [/turkish\s*airlines|التركية/, 'Turkish Airlines'],
]

const HOTEL_BRAND_RULES: Array<[RegExp, string]> = [
  [/marriott|ماريوت/, 'Marriott'],
  [/hilton|هيلتون/, 'Hilton'],
  [/hyatt|حيات/, 'Hyatt'],
  [/intercontinental|إنتركونتيننتال|انتركونتيننتال/, 'InterContinental'],
  [/rotana|روتانا/, 'Rotana'],
  [/marriott\s*bonvoy|بونفوي/, 'Marriott'],
  [/resort|منتجع/, 'resort'],
  [/boutique|بوتيك/, 'boutique'],
]

const SEAT_RULES: Array<[RegExp, SeatPreference]> = [
  [/\bwindow\b|نافذة|شباك/, 'window'],
  [/\baisle\b|ممر/, 'aisle'],
  [/\bmiddle\b|وسط/, 'middle'],
  [/\bexit\s*row\b|صف الطوارئ/, 'exit_row'],
]

const MEAL_RULES: Array<[RegExp, MealPreference]> = [
  [/\bhalal\b|حلال/, 'halal'],
  [/\bvegan\b|نباتي صرف/, 'vegan'],
  [/\bvegetarian\b|نباتي/, 'vegetarian'],
  [/\bkosher\b|كوشير/, 'kosher'],
  [/\bgluten[\s-]?free\b|خالي من الجلوتين/, 'gluten_free'],
  [/\bdiabetic\b|سكري/, 'diabetic'],
]

const ACCESSIBILITY_RULES: Array<[RegExp, string]> = [
  [/\bwheelchair\b|كرسي متحرك/, 'wheelchair'],
  [/\bmobility\b|تنقل محدود/, 'mobility_assistance'],
  [/\bhearing\b|ضعف سمع/, 'hearing_assistance'],
  [/\bvisual(?:ly)?\s*impaired\b|ضعف بصر|كفيف/, 'visual_assistance'],
  [/\baccessible\s*room\b|غرفة مهيأة/, 'accessible_room'],
]

const LOYALTY_RULES: Array<[RegExp, string]> = [
  [/alfursan|الفرسان/, 'Alfursan'],
  [/skywards|سكاي وردز/, 'Emirates Skywards'],
  [/privilege\s*club|نادي الامتياز/, 'Privilege Club'],
  [/miles?\s*and\s*smiles|مايلز/, 'Miles&Smiles'],
  [/marriott\s*bonvoy|بونفوي/, 'Marriott Bonvoy'],
  [/hilton\s*honors|هيلتون اونرز/, 'Hilton Honors'],
]

const NATIONALITY_EXPLICIT =
  /\b(?:i(?:'m| am)|my\s+nationality\s+is|passport\s+(?:is\s+from|from)|holder\s+of)\s+([a-z][a-z\s]{1,30})|\b(?:أنا|انا)\s+(?:من|حام[ل|ة]\s+جواز)\s+([^\s،,]{2,40})|جنسيتي\s+(?:هي\s+)?([^\s،,]{2,40})|جواز(?:ي)?\s+(?:من|سعودي|اماراتي)/i

/**
 * MemoryExtractor — structured preference extraction from user text.
 */
export function MemoryExtractor(input: {
  text: string
  locale?: BrainLocale
}): MemoryExtractionResult {
  const text = input.text.trim()
  const lower = text.toLowerCase()
  const base = RequirementExtractor({ text, locale: input.locale })

  const sessionPatch: Partial<EnrichedConversationMemory> = {
    ...base.patch,
  }
  const entities: Record<string, unknown> = { ...base.entities }
  let explicitSensitiveDisclosure = false

  const airlines = matchList(lower, text, AIRLINE_RULES)
  if (airlines.length) {
    sessionPatch.airlinePreferences = unique([
      ...(sessionPatch.airlinePreferences ?? []),
      ...airlines,
    ])
    entities.airlinePreferences = sessionPatch.airlinePreferences
  }

  const hotels = matchList(lower, text, HOTEL_BRAND_RULES)
  if (hotels.length) {
    sessionPatch.hotelPreferences = unique([
      ...(sessionPatch.hotelPreferences ?? []),
      ...hotels,
    ])
    entities.hotelPreferences = sessionPatch.hotelPreferences
  }

  const seats = matchEnum(lower, text, SEAT_RULES)
  if (seats.length) {
    sessionPatch.seatPreferences = seats
    entities.seatPreferences = seats
  }

  const meals = matchEnum(lower, text, MEAL_RULES)
  if (meals.length) {
    sessionPatch.mealPreferences = meals
    entities.mealPreferences = meals
  }

  const accessibility = matchList(lower, text, ACCESSIBILITY_RULES)
  if (accessibility.length) {
    sessionPatch.accessibilityRequirements = accessibility
    entities.accessibilityRequirements = accessibility
  }

  const loyalty = extractLoyalty(lower, text)
  if (loyalty.length) {
    sessionPatch.loyaltyPrograms = loyalty
    entities.loyaltyPrograms = loyalty.map((l) => ({
      program: l.program,
      hasNumber: Boolean(l.memberNumber),
    }))
  }

  const family = extractFamily(lower, text)
  if (family.length) {
    sessionPatch.familyMembers = family
    entities.familyMembers = family
  }

  const visa = extractVisaStatus(lower, text)
  if (visa) {
    sessionPatch.visaStatus = visa
    sessionPatch.visaRequirements = visa
    entities.visaStatus = visa
  }

  const passport = extractPassportNationality(lower, text)
  if (passport) {
    sessionPatch.passportNationality = passport
    entities.passportNationality = {
      nationality: passport.nationality,
      passportCountry: passport.passportCountry,
      explicitlyProvided: true,
    }
    explicitSensitiveDisclosure = true
  }

  const longTermPatch = toLongTermPatch(sessionPatch)

  return {
    sessionPatch,
    longTermPatch,
    entities,
    explicitSensitiveDisclosure,
  }
}

function toLongTermPatch(
  session: Partial<EnrichedConversationMemory>,
): Partial<TravelPreferenceProfile> {
  const patch: Partial<TravelPreferenceProfile> = {}
  if (session.airlinePreferences?.length) {
    patch.preferredAirlines = [...session.airlinePreferences]
  }
  if (session.hotelPreferences?.length) {
    patch.preferredHotelBrands = [...session.hotelPreferences]
  }
  if (session.cabinClass) {
    patch.cabinClass = session.cabinClass as CabinClass
  }
  if (session.budget?.amount != null || session.budget?.currency) {
    patch.budgetRange = {
      min: null,
      max: session.budget.amount ?? null,
      currency: session.budget.currency ?? null,
    }
  }
  if (session.travelers?.count != null) {
    patch.typicalTravelerCount = session.travelers.count
  }
  if (session.familyMembers?.length) {
    patch.familyMembers = session.familyMembers.map((m) => ({ ...m }))
  }
  if (session.seatPreferences?.length) {
    patch.seatPreferences = [...session.seatPreferences]
  }
  if (session.mealPreferences?.length) {
    patch.mealPreferences = [...session.mealPreferences]
  }
  if (session.accessibilityRequirements?.length) {
    patch.accessibilityRequirements = [...session.accessibilityRequirements]
  }
  if (session.loyaltyPrograms?.length) {
    // Names only long-term — never member numbers.
    patch.loyaltyPrograms = session.loyaltyPrograms.map((l) => l.program)
  }
  if (session.visaStatus) {
    patch.visaStatus = session.visaStatus
  }
  if (
    session.passportNationality?.explicitlyProvided &&
    session.passportNationality.nationality
  ) {
    patch.nationality = session.passportNationality.nationality
  }
  return patch
}

function extractPassportNationality(
  lower: string,
  original: string,
): EnrichedConversationMemory['passportNationality'] | null {
  // Hard gate: only explicit disclosure patterns.
  if (
    !/\bmy nationality\b|\bi(?:'m| am) (?:a |an )?[a-z]|passport (?:is )?from\b|جنسيتي|أنا من|انا من|جواز/.test(
      lower,
    ) &&
    !/جنسيتي|أنا من|انا من|جواز/.test(original)
  ) {
    return null
  }

  const m = lower.match(NATIONALITY_EXPLICIT) || original.match(NATIONALITY_EXPLICIT)
  let nationality: string | null = null
  if (m) {
    nationality = (m[1] || m[2] || m[3] || '').trim() || null
  }

  if (/\bsaudi\b|سعودي/.test(lower) || /سعودي/.test(original)) {
    nationality = nationality ?? 'Saudi'
  } else if (/\bemirati\b|اماراتي|إماراتي/.test(lower)) {
    nationality = nationality ?? 'Emirati'
  } else if (/\begyptian\b|مصري/.test(lower)) {
    nationality = nationality ?? 'Egyptian'
  }

  if (!nationality) return null
  nationality = nationality.replace(/[?.!,].*$/, '').trim()
  if (!nationality || /^(a|an|the|from)$/i.test(nationality)) return null

  const normalized =
    nationality.charAt(0).toUpperCase() + nationality.slice(1).toLowerCase()

  return {
    nationality: normalized,
    passportCountry: normalized,
    explicitlyProvided: true,
  }
}

function extractVisaStatus(lower: string, original: string): VisaStatus | null {
  if (/\bvisa[\s-]?free\b|بدون تأشيرة|بدون تاشيرة/.test(lower) || /بدون\s*تأشيرة/.test(original)) {
    return 'visa_free'
  }
  if (/\bon[\s-]arrival\b|عند الوصول/.test(lower)) return 'on_arrival'
  if (/\b(?:have|got|valid)\s+(?:a\s+)?visa\b|تأشيرة سارية|لدي تأشيرة/.test(lower)) {
    return 'valid'
  }
  if (/\bneed(?:s)?\s+(?:a\s+)?visa\b|أحتاج تأشيرة|نحتاج تأشيرة/.test(lower)) {
    return 'needs_visa'
  }
  if (/\bvisa\b|تأشيرة|تاشيرة|فيزا/.test(lower) || /تأشيرة/.test(original)) {
    return 'needs_check'
  }
  return null
}

function extractFamily(lower: string, original: string): FamilyMember[] {
  const out: FamilyMember[] = []
  if (/\bwith my (?:wife|spouse|husband|partner)\b|مع زوجتي|مع زوجي|مع شريكي/.test(lower)) {
    const relation = /\bwife\b|زوجتي/.test(lower)
      ? 'spouse'
      : /\bhusband\b|زوجي/.test(lower)
        ? 'spouse'
        : 'partner'
    out.push({ label: relation, relation, age: null })
  }

  const kids =
    lower.match(/(\d+)\s*(?:kids?|children|child)/) ||
    original.match(/(\d+)\s*(?:طفل|أطفال|اطفال)/)
  if (kids) {
    const n = Number(kids[1])
    if (Number.isFinite(n) && n > 0) {
      for (let i = 0; i < Math.min(n, 6); i += 1) {
        out.push({ label: `child_${i + 1}`, relation: 'child', age: null })
      }
    }
  } else if (/\bfamily\b|عائلة/.test(lower) || /عائلة/.test(original)) {
    out.push({ label: 'spouse', relation: 'spouse', age: null })
    out.push({ label: 'child_1', relation: 'child', age: null })
    out.push({ label: 'child_2', relation: 'child', age: null })
  }

  const namedChild = lower.match(/\b(?:son|daughter)\s+(?:named\s+)?([a-z]{2,20})\b/)
  if (namedChild?.[1]) {
    out.push({
      label: namedChild[1].charAt(0).toUpperCase() + namedChild[1].slice(1),
      relation: 'child',
      age: null,
    })
  }

  return out
}

function extractLoyalty(lower: string, original: string): LoyaltyProgramEntry[] {
  const programs = matchList(lower, textSafe(original), LOYALTY_RULES)
  const numberMatch =
    lower.match(
      /(?:member(?:ship)?|loyalty|miles?)\s*(?:number|#|no\.?)?\s*[:=]?\s*([a-z0-9]{5,20})/,
    ) ||
    original.match(/(?:رقم|عضوية)\s*[:=]?\s*([a-zA-Z0-9]{5,20})/)

  return programs.map((program, idx) => ({
    program,
    memberNumber: idx === 0 && numberMatch?.[1] ? numberMatch[1] : null,
  }))
}

function textSafe(s: string): string {
  return s
}

function matchList(lower: string, original: string, rules: Array<[RegExp, string]>): string[] {
  const out: string[] = []
  for (const [re, value] of rules) {
    if (re.test(lower) || re.test(original)) out.push(value)
  }
  return unique(out)
}

function matchEnum<T extends string>(
  lower: string,
  original: string,
  rules: Array<[RegExp, T]>,
): T[] {
  const out: T[] = []
  for (const [re, value] of rules) {
    if (re.test(lower) || re.test(original)) out.push(value)
  }
  return [...new Set(out)]
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    if (!out.some((x) => x.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out
}
