import type { TravelSession } from './travelSessionTypes'

// ── Types for the analysis profile ──────────────────────────────────────────

export type TravelPurpose =
  | '' | 'vacation' | 'honeymoon' | 'business' | 'family'
  | 'adventure' | 'luxury' | 'shopping' | 'medical' | 'religious'
  | 'visiting' | 'discovery'

export type TravelerType =
  | '' | 'solo' | 'couple' | 'family-with-kids' | 'family-with-infants'
  | 'group' | 'business-traveler' | 'senior'

export type PreferredClimate =
  | '' | 'hot' | 'warm' | 'mild' | 'cool' | 'cold' | 'tropical' | 'desert'

export type HotelCategory =
  | '' | 'budget' | 'mid-range' | 'comfort' | 'luxury' | 'ultra-luxury'

export type ActivityStyle =
  | '' | 'relaxed' | 'balanced' | 'packed' | 'adventurous' | 'cultural'

export type FoodPreference =
  | '' | 'any' | 'halal' | 'vegetarian' | 'vegan' | 'local-cuisine' | 'international'

export type TransportationPreference =
  | '' | 'public-transport' | 'private-transfer' | 'rental-car' | 'taxi-ride-hail'

export type BudgetPriority = '' | 'lowest-price' | 'balanced' | 'premium'
export type PriorityLevel = 0 | 1 | 2 | 3 // 0 = none, 3 = very high
export type FlightTimePreference = '' | 'morning' | 'afternoon' | 'evening' | 'night' | 'any'
export type PreferredLanguage = '' | 'ar' | 'en' | 'ar-en'
export type VisaConcern = '' | 'none' | 'low' | 'medium' | 'high'
export type HotelAreaPreference = '' | 'city-center' | 'beachfront' | 'airport' | 'quiet' | 'shopping-district'

// ── Confidence model ────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none'

export interface FieldConfidence {
  travelPurpose: ConfidenceLevel
  travelerType: ConfidenceLevel
  preferredClimate: ConfidenceLevel
  hotelCategory: ConfidenceLevel
  activityStyle: ConfidenceLevel
  foodPreference: ConfidenceLevel
  transportationPreference: ConfidenceLevel
  flexibilityScore: ConfidenceLevel
  budgetPriority: ConfidenceLevel
  comfortPriority: ConfidenceLevel
  luxuryPriority: ConfidenceLevel
  familyRequirements: ConfidenceLevel
  childFriendlyRequired: ConfidenceLevel
  accessibilityNeeds: ConfidenceLevel
  preferredFlightTime: ConfidenceLevel
  preferredHotelArea: ConfidenceLevel
  preferredLanguage: ConfidenceLevel
  visaConcern: ConfidenceLevel
  shoppingInterest: ConfidenceLevel
  natureInterest: ConfidenceLevel
  cultureInterest: ConfidenceLevel
  entertainmentInterest: ConfidenceLevel
  beachInterest: ConfidenceLevel
  cityInterest: ConfidenceLevel
  safetyPriority: ConfidenceLevel
}

export function createEmptyConfidence(): FieldConfidence {
  return {
    travelPurpose: 'none',
    travelerType: 'none',
    preferredClimate: 'none',
    hotelCategory: 'none',
    activityStyle: 'none',
    foodPreference: 'none',
    transportationPreference: 'none',
    flexibilityScore: 'none',
    budgetPriority: 'none',
    comfortPriority: 'none',
    luxuryPriority: 'none',
    familyRequirements: 'none',
    childFriendlyRequired: 'none',
    accessibilityNeeds: 'none',
    preferredFlightTime: 'none',
    preferredHotelArea: 'none',
    preferredLanguage: 'none',
    visaConcern: 'none',
    shoppingInterest: 'none',
    natureInterest: 'none',
    cultureInterest: 'none',
    entertainmentInterest: 'none',
    beachInterest: 'none',
    cityInterest: 'none',
    safetyPriority: 'none',
  }
}

export interface RequirementProfile {
  travelPurpose: TravelPurpose
  travelerType: TravelerType
  preferredClimate: PreferredClimate
  hotelCategory: HotelCategory
  activityStyle: ActivityStyle
  foodPreference: FoodPreference
  transportationPreference: TransportationPreference
  flexibilityScore: number         // 0-100
  budgetPriority: BudgetPriority
  comfortPriority: PriorityLevel
  luxuryPriority: PriorityLevel
  familyRequirements: string
  childFriendlyRequired: boolean
  accessibilityNeeds: string
  preferredFlightTime: FlightTimePreference
  preferredHotelArea: HotelAreaPreference
  preferredLanguage: PreferredLanguage
  visaConcern: VisaConcern
  shoppingInterest: PriorityLevel
  natureInterest: PriorityLevel
  cultureInterest: PriorityLevel
  entertainmentInterest: PriorityLevel
  beachInterest: PriorityLevel
  cityInterest: PriorityLevel
  safetyPriority: PriorityLevel
  confidence: FieldConfidence
}

export function createEmptyProfile(): RequirementProfile {
  return {
    travelPurpose: '',
    travelerType: '',
    preferredClimate: '',
    hotelCategory: '',
    activityStyle: '',
    foodPreference: '',
    transportationPreference: '',
    flexibilityScore: 0,
    budgetPriority: '',
    comfortPriority: 0,
    luxuryPriority: 0,
    familyRequirements: '',
    childFriendlyRequired: false,
    accessibilityNeeds: '',
    preferredFlightTime: '',
    preferredHotelArea: '',
    preferredLanguage: '',
    visaConcern: '',
    shoppingInterest: 0,
    natureInterest: 0,
    cultureInterest: 0,
    entertainmentInterest: 0,
    beachInterest: 0,
    cityInterest: 0,
    safetyPriority: 0,
    confidence: createEmptyConfidence(),
  }
}

// ── Text normalization ──────────────────────────────────────────────────────

const normalizeAr = (s: string): string =>
  s
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()

// ── Contextual purpose inference ────────────────────────────────────────────
//
// Instead of matching single keywords, we score each candidate purpose using
// multiple contextual signals from the full conversation + session state:
//   1. Explicit purpose keywords (high weight)
//   2. Traveler composition signals (adults/children/infants)
//   3. Relational cues ("زوجتي", "وحدي", "العائله")
//   4. Destination-based signals (Mecca/Medina → religious, Maldives → leisure)
//   5. Budget/comfort signals (very high budget → luxury tilt)
// Each signal adds points to one or more purposes. The purpose with the
// highest score wins, and confidence is derived from the score margin.

interface PurposeScore {
  purpose: TravelPurpose
  score: number
  signals: string[]
}

const RELIGIOUS_DESTINATIONS = new Set(['Mecca', 'Medina', 'Makkah', 'Madinah', 'مكة', 'المدينه'])

// Explicit keywords — high weight (40 points each)
const PURPOSE_EXPLICIT_KEYWORDS: { kw: string; purpose: TravelPurpose }[] = [
  { kw: 'شهر العسل', purpose: 'honeymoon' },
  { kw: 'شهر عسل', purpose: 'honeymoon' },
  { kw: 'honeymoon', purpose: 'honeymoon' },
  { kw: 'مؤتمر', purpose: 'business' },
  { kw: 'اجتماع', purpose: 'business' },
  { kw: 'عمل', purpose: 'business' },
  { kw: 'business', purpose: 'business' },
  { kw: 'عمرة', purpose: 'religious' },
  { kw: 'عمره', purpose: 'religious' },
  { kw: 'حج', purpose: 'religious' },
  { kw: 'religious', purpose: 'religious' },
  { kw: 'مستشفى', purpose: 'medical' },
  { kw: 'مستشفى', purpose: 'medical' },
  { kw: 'علاج', purpose: 'medical' },
  { kw: 'medical', purpose: 'medical' },
  { kw: 'مغامرات', purpose: 'adventure' },
  { kw: 'مغامره', purpose: 'adventure' },
  { kw: 'تخييم', purpose: 'adventure' },
  { kw: 'غوص', purpose: 'adventure' },
  { kw: 'تسلق', purpose: 'adventure' },
  { kw: 'adventure', purpose: 'adventure' },
  { kw: 'تسوق', purpose: 'shopping' },
  { kw: 'shopping', purpose: 'shopping' },
  { kw: 'استجمام', purpose: 'vacation' },
  { kw: 'عطله', purpose: 'vacation' },
  { kw: 'اجازه', purpose: 'vacation' },
  { kw: 'vacation', purpose: 'vacation' },
  { kw: 'شاطئ', purpose: 'vacation' },
  { kw: 'beach', purpose: 'vacation' },
  { kw: 'اكتشاف', purpose: 'discovery' },
  { kw: 'discovery', purpose: 'discovery' },
  { kw: 'فاخر', purpose: 'luxury' },
  { kw: 'رفاهيه', purpose: 'luxury' },
  { kw: 'luxury', purpose: 'luxury' },
  { kw: 'زياره', purpose: 'visiting' },
]

// Relational cues — medium-high weight (25 points)
const RELATIONAL_CUES: { kw: string; purpose: TravelPurpose }[] = [
  { kw: 'زوجتي', purpose: 'family' },      // "my wife" → family (unless honeymoon keyword)
  { kw: 'زوجي', purpose: 'family' },
  { kw: 'العائله', purpose: 'family' },
  { kw: 'عائلي', purpose: 'family' },
  { kw: 'family', purpose: 'family' },
  { kw: 'وحدي', purpose: 'discovery' },     // "alone" → solo discovery
  { kw: 'لوحدي', purpose: 'discovery' },
]

const CLIMATE_BY_DESTINATION: Record<string, PreferredClimate> = {
  'Japan': 'mild',
  'South Korea': 'mild',
  'Thailand': 'tropical',
  'Indonesia': 'tropical',
  'Malaysia': 'tropical',
  'Maldives': 'tropical',
  'Turkey': 'mild',
  'Dubai': 'desert',
  'UAE': 'desert',
  'Qatar': 'desert',
  'Egypt': 'hot',
  'France': 'mild',
  'Paris': 'mild',
  'Italy': 'mild',
  'Rome': 'warm',
  'Spain': 'warm',
  'Germany': 'cool',
  'UK': 'cool',
  'London': 'cool',
  'USA': 'mild',
}

const DESTINATION_INTERESTS: Record<string, { culture?: PriorityLevel; nature?: PriorityLevel; beach?: PriorityLevel; city?: PriorityLevel; shopping?: PriorityLevel; entertainment?: PriorityLevel }> = {
  'Japan': { culture: 3, nature: 2, city: 3, shopping: 2, entertainment: 2 },
  'South Korea': { culture: 2, city: 3, shopping: 3, entertainment: 2 },
  'Thailand': { beach: 3, nature: 2, city: 2, shopping: 2, entertainment: 2 },
  'Indonesia': { beach: 3, nature: 3, culture: 2 },
  'Malaysia': { city: 2, beach: 2, shopping: 3, nature: 2 },
  'Maldives': { beach: 3, nature: 2, entertainment: 1 },
  'Turkey': { culture: 3, city: 2, shopping: 3, nature: 2 },
  'Dubai': { shopping: 3, city: 3, entertainment: 2 },
  'UAE': { shopping: 3, city: 3, entertainment: 2 },
  'Qatar': { culture: 2, city: 3, shopping: 3 },
  'Egypt': { culture: 3, nature: 2, beach: 2 },
  'France': { culture: 3, city: 3, shopping: 3, nature: 1 },
  'Paris': { culture: 3, city: 3, shopping: 3 },
  'Italy': { culture: 3, city: 3, beach: 2, nature: 1 },
  'Rome': { culture: 3, city: 3 },
  'Spain': { culture: 2, beach: 3, city: 2, entertainment: 2 },
  'Germany': { culture: 2, city: 3, nature: 2 },
  'UK': { culture: 3, city: 3, shopping: 2 },
  'London': { culture: 3, city: 3, shopping: 3 },
  'USA': { city: 3, shopping: 3, entertainment: 3, nature: 2 },
}

const INTEREST_KEYWORDS: { kw: string; field: keyof Pick<RequirementProfile, 'shoppingInterest' | 'natureInterest' | 'cultureInterest' | 'entertainmentInterest' | 'beachInterest' | 'cityInterest'> ; level: PriorityLevel }[] = [
  { kw: 'تسوق', field: 'shoppingInterest', level: 3 },
  { kw: 'shopping', field: 'shoppingInterest', level: 3 },
  { kw: 'مولات', field: 'shoppingInterest', level: 3 },
  { kw: 'طبيعه', field: 'natureInterest', level: 3 },
  { kw: 'nature', field: 'natureInterest', level: 3 },
  { kw: 'جبال', field: 'natureInterest', level: 3 },
  { kw: 'غابات', field: 'natureInterest', level: 3 },
  { kw: 'ثقافه', field: 'cultureInterest', level: 3 },
  { kw: 'culture', field: 'cultureInterest', level: 3 },
  { kw: 'متاحف', field: 'cultureInterest', level: 3 },
  { kw: 'معالم', field: 'cultureInterest', level: 3 },
  { kw: 'ترفيه', field: 'entertainmentInterest', level: 3 },
  { kw: 'entertainment', field: 'entertainmentInterest', level: 3 },
  { kw: 'ملاهي', field: 'entertainmentInterest', level: 3 },
  { kw: 'شواطئ', field: 'beachInterest', level: 3 },
  { kw: 'بحر', field: 'beachInterest', level: 3 },
  { kw: 'beach', field: 'beachInterest', level: 3 },
  { kw: 'مدينه', field: 'cityInterest', level: 3 },
  { kw: 'city', field: 'cityInterest', level: 3 },
  { kw: 'اسواق', field: 'cityInterest', level: 2 },
]

const FOOD_KEYWORDS: { kw: string; pref: FoodPreference }[] = [
  { kw: 'حلال', pref: 'halal' },
  { kw: 'halal', pref: 'halal' },
  { kw: 'نباتي تماما', pref: 'vegan' },
  { kw: 'vegan', pref: 'vegan' },
  { kw: 'نباتي', pref: 'vegetarian' },
  { kw: 'vegetarian', pref: 'vegetarian' },
  { kw: 'اكل محلي', pref: 'local-cuisine' },
  { kw: 'local cuisine', pref: 'local-cuisine' },
  { kw: 'local food', pref: 'local-cuisine' },
  { kw: 'اكل دولي', pref: 'international' },
  { kw: 'international', pref: 'international' },
]

const FLIGHT_TIME_KEYWORDS: { kw: string; time: FlightTimePreference }[] = [
  { kw: 'صباح', time: 'morning' },
  { kw: 'morning', time: 'morning' },
  { kw: 'ظهر', time: 'afternoon' },
  { kw: 'afternoon', time: 'afternoon' },
  { kw: 'مساء', time: 'evening' },
  { kw: 'evening', time: 'evening' },
  { kw: 'ليل', time: 'night' },
  { kw: 'night', time: 'night' },
  { kw: 'red eye', time: 'night' },
]

const HOTEL_AREA_KEYWORDS: { kw: string; area: HotelAreaPreference }[] = [
  { kw: 'وسط المدينه', area: 'city-center' },
  { kw: 'city center', area: 'city-center' },
  { kw: 'downtown', area: 'city-center' },
  { kw: 'شاطئ', area: 'beachfront' },
  { kw: 'beachfront', area: 'beachfront' },
  { kw: 'beach', area: 'beachfront' },
  { kw: 'قرب المطار', area: 'airport' },
  { kw: 'near airport', area: 'airport' },
  { kw: 'هادئ', area: 'quiet' },
  { kw: 'quiet', area: 'quiet' },
  { kw: 'منطقه تسوق', area: 'shopping-district' },
  { kw: 'shopping district', area: 'shopping-district' },
]

const ACCESSIBILITY_KEYWORDS: { kw: string; need: string }[] = [
  { kw: 'كرسي متحرك', need: 'wheelchair-access' },
  { kw: 'wheelchair', need: 'wheelchair-access' },
  { kw: 'مقعد متحرك', need: 'wheelchair-access' },
  { kw: 'اعاقه حركيه', need: 'wheelchair-access' },
  { kw: 'كبار سن', need: 'senior-assistance' },
  { kw: 'elderly', need: 'senior-assistance' },
  { kw: 'مسن', need: 'senior-assistance' },
  { kw: 'حامل', need: 'pregnancy-support' },
  { kw: 'pregnant', need: 'pregnancy-support' },
]

const VISA_REQUIRED_FOR_SAUDI: Record<string, boolean> = {
  'Japan': true,
  'South Korea': true,
  'Thailand': false,
  'Indonesia': false,
  'Malaysia': false,
  'Turkey': false,
  'Dubai': false,
  'UAE': false,
  'Qatar': false,
  'Egypt': false,
  'France': true,
  'Paris': true,
  'Italy': true,
  'Rome': true,
  'Spain': true,
  'Germany': true,
  'UK': true,
  'London': true,
  'USA': true,
  'Maldives': false,
}

const LUXURY_DESTINATIONS = new Set(['Maldives', 'Dubai', 'UAE', 'Paris', 'France', 'London', 'UK'])

// ── Inference helpers ────────────────────────────────────────────────────────

function perPersonBudget(session: TravelSession): number {
  const total = session.budgetAmount ?? 0
  const people = (session.adults ?? 0) + (session.children ?? 0)
  if (people === 0 || total === 0) return 0
  return total / people
}

function inferTravelerType(session: TravelSession): { value: TravelerType; confidence: ConfidenceLevel } {
  const adults = session.adults ?? 0
  const children = session.children ?? 0
  const infants = session.infants ?? 0
  if (infants > 0) return { value: 'family-with-infants', confidence: 'high' }
  if (children > 0) return { value: 'family-with-kids', confidence: 'high' }
  if (adults === 1) return { value: 'solo', confidence: 'high' }
  if (adults === 2 && children === 0) return { value: 'couple', confidence: 'medium' }
  if (adults >= 3) return { value: 'group', confidence: 'high' }
  return { value: '', confidence: 'none' }
}

// ── Contextual travel-purpose inference ─────────────────────────────────────

function inferTravelPurposeContextual(
  session: TravelSession,
  textNorm: string,
): { value: TravelPurpose; confidence: ConfidenceLevel } {
  const scores: Record<string, PurposeScore> = {}
  const ensure = (p: TravelPurpose): PurposeScore => {
    if (!scores[p]) scores[p] = { purpose: p, score: 0, signals: [] }
    return scores[p]
  }

  // 1. Explicit keywords (40 pts each)
  for (const { kw, purpose } of PURPOSE_EXPLICIT_KEYWORDS) {
    if (textNorm.includes(normalizeAr(kw))) {
      const s = ensure(purpose)
      s.score += 40
      s.signals.push(`keyword:"${kw}"`)
    }
  }

  // 2. Relational cues (25 pts each)
  for (const { kw, purpose } of RELATIONAL_CUES) {
    if (textNorm.includes(normalizeAr(kw))) {
      const s = ensure(purpose)
      s.score += 25
      s.signals.push(`relational:"${kw}"`)
    }
  }

  // 3. Traveler-composition signals
  const adults = session.adults ?? 0
  const children = session.children ?? 0
  const infants = session.infants ?? 0

  if (children > 0 || infants > 0) {
    const s = ensure('family')
    s.score += 35
    s.signals.push(`children=${children},infants=${infants}`)
  }

  if (adults === 2 && children === 0 && infants === 0) {
    // Couple — only add to family if "زوجتي" or "زوجي" was mentioned (already added 25 above)
    // Don't add extra points here; the relational cue handles it.
    // Without a relational cue, 2 adults alone shouldn't strongly imply family.
  }

  if (adults === 1) {
    const s = ensure('discovery')
    s.score += 10
    s.signals.push('solo-traveler')
  }

  // 4. Destination-based signals
  const dest = session.destination
  if (dest && RELIGIOUS_DESTINATIONS.has(dest)) {
    const s = ensure('religious')
    s.score += 45
    s.signals.push(`destination:${dest}`)
  }
  if (dest === 'Maldives') {
    const s = ensure('vacation')
    s.score += 30
    s.signals.push('destination:Maldives→leisure')
  }

  // 5. Budget signals (very high per-person → luxury tilt, low)
  const pp = perPersonBudget(session)
  if (pp >= 15000) {
    const s = ensure('luxury')
    s.score += 10
    s.signals.push(`high-budget:${pp}/person`)
  }

  // 6. session.tripPurpose (if already set from previous conversation turns)
  if (session.tripPurpose) {
    const purposeMap: Record<string, TravelPurpose> = {
      'vacation': 'vacation', 'leisure': 'vacation',
      'honeymoon': 'honeymoon',
      'business': 'business',
      'family': 'family',
      'adventure': 'adventure',
      'religious': 'religious',
      'shopping': 'shopping', 'medical': 'medical',
      'visiting': 'visiting', 'discovery': 'discovery', 'luxury': 'luxury',
    }
    const mapped = purposeMap[session.tripPurpose]
    if (mapped) {
      const s = ensure(mapped)
      s.score += 50
      s.signals.push('session.tripPurpose')
    }
  }

  // Pick the highest-scoring purpose
  const ranked = Object.values(scores).sort((a, b) => b.score - a.score)
  if (ranked.length === 0 || ranked[0].score === 0) {
    return { value: '', confidence: 'none' }
  }

  const top = ranked[0]
  const second = ranked[1]

  // Confidence determination:
  // - High: score >= 40 AND (no runner-up OR runner-up score is less than half)
  // - Medium: score >= 25, or score >= 40 but runner-up is close
  // - Low: score < 25, or very close runner-up
  if (top.score >= 40 && (!second || second.score < top.score * 0.5)) {
    return { value: top.purpose, confidence: 'high' }
  }
  if (top.score >= 25 && (!second || second.score < top.score * 0.7)) {
    return { value: top.purpose, confidence: 'medium' }
  }
  if (top.score >= 10) {
    return { value: top.purpose, confidence: 'low' }
  }
  return { value: top.purpose, confidence: 'low' }
}

function inferHotelCategory(session: TravelSession): { value: HotelCategory; confidence: ConfidenceLevel } {
  const hotel = session.preferredHotelCategory
  if (hotel === '5-star') return { value: 'ultra-luxury', confidence: 'high' }
  if (hotel === '4-star') return { value: 'luxury', confidence: 'high' }
  if (hotel === '3-star') return { value: 'comfort', confidence: 'high' }
  if (hotel === 'hotel') return { value: 'mid-range', confidence: 'medium' }
  if (hotel === 'apartment' || hotel === 'hostel') return { value: 'budget', confidence: 'high' }
  const perPerson = perPersonBudget(session)
  if (perPerson > 0) {
    if (perPerson >= 10000) return { value: 'luxury', confidence: 'medium' }
    if (perPerson >= 5000) return { value: 'comfort', confidence: 'medium' }
    if (perPerson >= 2000) return { value: 'mid-range', confidence: 'medium' }
    return { value: 'budget', confidence: 'medium' }
  }
  return { value: '', confidence: 'none' }
}

function inferBudgetPriority(session: TravelSession): { value: BudgetPriority; confidence: ConfidenceLevel } {
  const perPerson = perPersonBudget(session)
  if (perPerson > 0) {
    if (perPerson < 2000) return { value: 'lowest-price', confidence: 'high' }
    if (perPerson < 7000) return { value: 'balanced', confidence: 'high' }
    return { value: 'premium', confidence: 'high' }
  }
  if (session.cabinClass === 'first') return { value: 'premium', confidence: 'high' }
  if (session.cabinClass === 'business') return { value: 'premium', confidence: 'high' }
  if (session.cabinClass === 'economy') return { value: 'balanced', confidence: 'medium' }
  return { value: '', confidence: 'none' }
}

function inferComfortPriority(session: TravelSession): { value: PriorityLevel; confidence: ConfidenceLevel } {
  if (session.cabinClass === 'first') return { value: 3, confidence: 'high' }
  if (session.cabinClass === 'business') return { value: 3, confidence: 'high' }
  if (session.cabinClass === 'premium-economy') return { value: 2, confidence: 'high' }
  if (session.cabinClass === 'economy') return { value: 1, confidence: 'high' }
  const perPerson = perPersonBudget(session)
  if (perPerson >= 10000) return { value: 3, confidence: 'medium' }
  if (perPerson >= 5000) return { value: 2, confidence: 'medium' }
  if (perPerson > 0) return { value: 1, confidence: 'medium' }
  return { value: 0, confidence: 'none' }
}

function inferLuxuryPriority(session: TravelSession): { value: PriorityLevel; confidence: ConfidenceLevel } {
  if (session.cabinClass === 'first') return { value: 3, confidence: 'high' }
  if (session.cabinClass === 'business') return { value: 2, confidence: 'high' }
  if (LUXURY_DESTINATIONS.has(session.destination)) return { value: 2, confidence: 'medium' }
  const perPerson = perPersonBudget(session)
  if (perPerson >= 12000) return { value: 3, confidence: 'medium' }
  if (perPerson >= 8000) return { value: 2, confidence: 'medium' }
  if (perPerson >= 4000) return { value: 1, confidence: 'medium' }
  return { value: 0, confidence: 'none' }
}

function inferFlexibilityScore(session: TravelSession): { value: number; confidence: ConfidenceLevel } {
  let score = 50
  if (session.flexibleDates === 'flexible') score += 30
  if (session.flexibleDates === 'fixed') score -= 30
  if (!session.departureDate) score += 10
  if (session.returnDate) score -= 10
  const clamped = Math.max(0, Math.min(100, score))
  const hasSignals = session.flexibleDates !== '' || session.departureDate !== ''
  return { value: clamped, confidence: hasSignals ? 'medium' : 'low' }
}

function inferActivityStyle(
  session: TravelSession,
  profile: Pick<RequirementProfile, 'travelPurpose'>,
): { value: ActivityStyle; confidence: ConfidenceLevel } {
  const interests = normalizeAr(session.interests)
  const purpose = profile.travelPurpose
  if (purpose === 'adventure') return { value: 'adventurous', confidence: 'high' }
  if (purpose === 'religious' || purpose === 'visiting') return { value: 'cultural', confidence: 'high' }
  if (purpose === 'vacation') return { value: 'relaxed', confidence: 'medium' }
  if (purpose === 'honeymoon') return { value: 'relaxed', confidence: 'medium' }
  if (interests.includes('مغامره') || interests.includes('adventure')) return { value: 'adventurous', confidence: 'high' }
  if (interests.includes('ثقافه') || interests.includes('culture')) return { value: 'cultural', confidence: 'high' }
  if (interests.includes('ترفيه') || interests.includes('entertainment')) return { value: 'packed', confidence: 'medium' }
  if (interests.includes('استجمام')) return { value: 'relaxed', confidence: 'high' }
  if (interests) return { value: 'balanced', confidence: 'medium' }
  return { value: '', confidence: 'none' }
}

function inferChildFriendlyRequired(session: TravelSession): { value: boolean; confidence: ConfidenceLevel } {
  if ((session.children ?? 0) > 0 || (session.infants ?? 0) > 0) {
    return { value: true, confidence: 'high' }
  }
  if ((session.adults ?? 0) > 0) {
    return { value: false, confidence: 'high' }
  }
  return { value: false, confidence: 'none' }
}

function inferFamilyRequirements(session: TravelSession): { value: string; confidence: ConfidenceLevel } {
  const parts: string[] = []
  if ((session.children ?? 0) > 0) parts.push(`أطفال: ${session.children}`)
  if ((session.infants ?? 0) > 0) parts.push(`رضع: ${session.infants}`)
  if (parts.length > 0) return { value: parts.join('، '), confidence: 'high' }
  if ((session.adults ?? 0) > 0) return { value: '', confidence: 'high' }
  return { value: '', confidence: 'none' }
}

function inferVisaConcern(session: TravelSession): { value: VisaConcern; confidence: ConfidenceLevel } {
  if (session.visaStatus === 'has-visa') return { value: 'none', confidence: 'high' }
  if (session.visaStatus === 'visa-free') return { value: 'none', confidence: 'high' }
  if (session.visaStatus === 'visa-on-arrival') return { value: 'low', confidence: 'high' }
  if (session.visaStatus === 'visa-required') return { value: 'high', confidence: 'high' }
  const dest = session.destination
  if (dest && VISA_REQUIRED_FOR_SAUDI[dest] === true) return { value: 'high', confidence: 'medium' }
  if (dest && VISA_REQUIRED_FOR_SAUDI[dest] === false) return { value: 'low', confidence: 'medium' }
  return { value: '', confidence: 'none' }
}

function inferSafetyPriority(session: TravelSession): { value: PriorityLevel; confidence: ConfidenceLevel } {
  if ((session.children ?? 0) > 0 || (session.infants ?? 0) > 0) return { value: 3, confidence: 'high' }
  if ((session.adults ?? 0) >= 1 && (session.adults ?? 0) <= 2) return { value: 2, confidence: 'high' }
  if ((session.adults ?? 0) >= 3) return { value: 1, confidence: 'medium' }
  return { value: 0, confidence: 'none' }
}

function inferPreferredLanguage(): { value: PreferredLanguage; confidence: ConfidenceLevel } {
  return { value: 'ar', confidence: 'high' }
}

function inferTransportationPreference(session: TravelSession): { value: TransportationPreference; confidence: ConfidenceLevel } {
  if (session.transportPreference) {
    return { value: session.transportPreference, confidence: 'high' }
  }
  return { value: '', confidence: 'none' }
}

// ── Main analyzer ────────────────────────────────────────────────────────────

export function analyzeRequirements(
  session: TravelSession,
  conversationText: string,
): RequirementProfile {
  const profile = createEmptyProfile()
  const textNorm = normalizeAr(conversationText)

  // Travel purpose — contextual inference from full conversation
  const purposeResult = inferTravelPurposeContextual(session, textNorm)
  profile.travelPurpose = purposeResult.value
  profile.confidence.travelPurpose = purposeResult.confidence

  // Traveler type
  const travelerResult = inferTravelerType(session)
  profile.travelerType = travelerResult.value
  profile.confidence.travelerType = travelerResult.confidence

  // Climate — destination-based
  if (session.destination && CLIMATE_BY_DESTINATION[session.destination]) {
    profile.preferredClimate = CLIMATE_BY_DESTINATION[session.destination]
    profile.confidence.preferredClimate = 'high'
  }

  // Hotel category
  const hotelResult = inferHotelCategory(session)
  profile.hotelCategory = hotelResult.value
  profile.confidence.hotelCategory = hotelResult.confidence

  // Activity style (depends on travelPurpose)
  const activityResult = inferActivityStyle(session, profile)
  profile.activityStyle = activityResult.value
  profile.confidence.activityStyle = activityResult.confidence

  // Food preference — from text keywords
  for (const { kw, pref } of FOOD_KEYWORDS) {
    if (textNorm.includes(normalizeAr(kw))) {
      profile.foodPreference = pref
      profile.confidence.foodPreference = 'high'
      break
    }
  }

  // Transportation
  const transportResult = inferTransportationPreference(session)
  profile.transportationPreference = transportResult.value
  profile.confidence.transportationPreference = transportResult.confidence

  // Flexibility
  const flexResult = inferFlexibilityScore(session)
  profile.flexibilityScore = flexResult.value
  profile.confidence.flexibilityScore = flexResult.confidence

  // Priorities
  const budgetResult = inferBudgetPriority(session)
  profile.budgetPriority = budgetResult.value
  profile.confidence.budgetPriority = budgetResult.confidence

  const comfortResult = inferComfortPriority(session)
  profile.comfortPriority = comfortResult.value
  profile.confidence.comfortPriority = comfortResult.confidence

  const luxuryResult = inferLuxuryPriority(session)
  profile.luxuryPriority = luxuryResult.value
  profile.confidence.luxuryPriority = luxuryResult.confidence

  // Family
  const childResult = inferChildFriendlyRequired(session)
  profile.childFriendlyRequired = childResult.value
  profile.confidence.childFriendlyRequired = childResult.confidence

  const familyResult = inferFamilyRequirements(session)
  profile.familyRequirements = familyResult.value
  profile.confidence.familyRequirements = familyResult.confidence

  // Accessibility — from text keywords
  for (const { kw, need } of ACCESSIBILITY_KEYWORDS) {
    if (textNorm.includes(normalizeAr(kw))) {
      profile.accessibilityNeeds = need
      profile.confidence.accessibilityNeeds = 'high'
      break
    }
  }

  // Flight time — from text keywords
  for (const { kw, time } of FLIGHT_TIME_KEYWORDS) {
    if (textNorm.includes(normalizeAr(kw))) {
      profile.preferredFlightTime = time
      profile.confidence.preferredFlightTime = 'high'
      break
    }
  }

  // Hotel area — from text keywords
  for (const { kw, area } of HOTEL_AREA_KEYWORDS) {
    if (textNorm.includes(normalizeAr(kw))) {
      profile.preferredHotelArea = area
      profile.confidence.preferredHotelArea = 'high'
      break
    }
  }

  // Language
  const langResult = inferPreferredLanguage()
  profile.preferredLanguage = langResult.value
  profile.confidence.preferredLanguage = langResult.confidence

  // Visa concern
  const visaResult = inferVisaConcern(session)
  profile.visaConcern = visaResult.value
  profile.confidence.visaConcern = visaResult.confidence

  // Interest levels — from destination defaults
  const destInterests = DESTINATION_INTERESTS[session.destination]
  if (destInterests) {
    if (destInterests.culture) { profile.cultureInterest = destInterests.culture; profile.confidence.cultureInterest = 'medium' }
    if (destInterests.nature) { profile.natureInterest = destInterests.nature; profile.confidence.natureInterest = 'medium' }
    if (destInterests.beach) { profile.beachInterest = destInterests.beach; profile.confidence.beachInterest = 'medium' }
    if (destInterests.city) { profile.cityInterest = destInterests.city; profile.confidence.cityInterest = 'medium' }
    if (destInterests.shopping) { profile.shoppingInterest = destInterests.shopping; profile.confidence.shoppingInterest = 'medium' }
    if (destInterests.entertainment) { profile.entertainmentInterest = destInterests.entertainment; profile.confidence.entertainmentInterest = 'medium' }
  }

  // Interest levels — from explicit keywords in text (override destination defaults)
  for (const { kw, field, level } of INTEREST_KEYWORDS) {
    if (textNorm.includes(normalizeAr(kw))) {
      ;(profile[field] as PriorityLevel) = level
      ;(profile.confidence[field as keyof FieldConfidence] as ConfidenceLevel) = 'high'
    }
  }

  // Safety
  const safetyResult = inferSafetyPriority(session)
  profile.safetyPriority = safetyResult.value
  profile.confidence.safetyPriority = safetyResult.confidence

  return profile
}

// ── Confidence / follow-up question logic ───────────────────────────────────

export interface AnalysisGap {
  field: keyof RequirementProfile
  question: string
  confidence: ConfidenceLevel
}

export function getAnalysisGaps(profile: RequirementProfile): AnalysisGap[] {
  const gaps: AnalysisGap[] = []

  // Only ask about travel purpose if confidence is low or none
  if (profile.confidence.travelPurpose === 'low' || profile.confidence.travelPurpose === 'none') {
    gaps.push({
      field: 'travelPurpose',
      question: 'ما الغرض الرئيسي من رحلتك؟ عطلة، عمل، عائلة، شهر عسل؟',
      confidence: profile.confidence.travelPurpose || 'low',
    })
  }

  if (profile.confidence.travelerType === 'none') {
    gaps.push({
      field: 'travelerType',
      question: 'هل تسافر وحدك، مع عائلتك، أم مع مجموعة؟',
      confidence: 'low',
    })
  }

  // Don't ask about hotel category if budget already gives us a signal
  if (profile.confidence.hotelCategory === 'none' && profile.confidence.budgetPriority === 'none') {
    gaps.push({
      field: 'hotelCategory',
      question: 'ما مستوى الإقامة المفضل لديك؟ اقتصادي، متوسط، فاخر؟',
      confidence: 'medium',
    })
  }

  // Don't ask about visa if we already have destination-based inference
  if (profile.confidence.visaConcern === 'none' && profile.travelPurpose !== '') {
    gaps.push({
      field: 'visaConcern',
      question: 'هل لديك تأشيرة للوجهة، أم تفضل وجهة بدون تأشيرة؟',
      confidence: 'medium',
    })
  }

  return gaps
}

export function hasLowConfidenceGaps(profile: RequirementProfile): boolean {
  return getAnalysisGaps(profile).some(g => g.confidence === 'low' || g.confidence === 'none')
}

export function getNextAnalysisQuestion(profile: RequirementProfile): AnalysisGap | null {
  const gaps = getAnalysisGaps(profile)
  // Prioritize low-confidence gaps first
  const lowGap = gaps.find(g => g.confidence === 'low' || g.confidence === 'none')
  if (lowGap) return lowGap
  return gaps[0] ?? null
}
