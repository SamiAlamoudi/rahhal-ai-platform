import type { TravelSession } from './travelSession'
import type {
  TravelPurpose,
  ActivityStyle,
  BudgetPriority,
  FlightTimePreference,
  HotelAreaPreference,
  PriorityLevel,
} from './requirementAnalyzer'

// ── Traveler composition ───────────────────────────────────────────────────

export interface TravelerGroup {
  adults: number
  children: number
  infants: number
  total: number
  type: string
}

// ── Budget block ───────────────────────────────────────────────────────────

export interface BudgetBlock {
  amount: number
  currency: string
  priority: BudgetPriority
  perPerson: number
}

// ── Flight preferences ─────────────────────────────────────────────────────

export type CabinPreference = '' | 'economy' | 'premium-economy' | 'business' | 'first'

export interface FlightPreferences {
  preferredCabin: CabinPreference
  directFlightPreferred: DirectFlightMode
  preferredDepartureTime: FlightTimePreference
  preferredArrivalTime: FlightTimePreference
  preferredAirlines: string[]
  avoidAirlines: string[]
}

export type DirectFlightMode = '' | 'direct-only' | 'direct-preferred' | 'any'

// ── Hotel preferences ──────────────────────────────────────────────────────

export type HotelStars = 0 | 1 | 2 | 3 | 4 | 5

export type HotelAmenity =
  | 'wifi' | 'pool' | 'gym' | 'spa' | 'parking'
  | 'restaurant' | 'bar' | 'family-rooms' | 'crib' | 'kids-club'

export interface HotelPreferences {
  hotelStars: HotelStars
  hotelBudget: number
  preferredArea: HotelAreaPreference
  familyFriendly: boolean
  breakfastRequired: boolean
  freeCancellation: boolean
  hotelAmenities: HotelAmenity[]
}

// ── Activities ─────────────────────────────────────────────────────────────

export interface ActivityInterests {
  activityStyle: ActivityStyle
  shoppingInterest: PriorityLevel
  natureInterest: PriorityLevel
  cultureInterest: PriorityLevel
  beachInterest: PriorityLevel
  adventureInterest: PriorityLevel
  entertainmentInterest: PriorityLevel
}

// ── Decision priorities ────────────────────────────────────────────────────

export interface DecisionWeights {
  lowestPriceWeight: PriorityLevel
  comfortWeight: PriorityLevel
  timeWeight: PriorityLevel
  luxuryWeight: PriorityLevel
  familyWeight: PriorityLevel
}

// ── Inference summary ──────────────────────────────────────────────────────

export interface InferenceSummary {
  highConfidence: string[]
  mediumConfidence: string[]
  lowConfidence: string[]
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface ValidationBlock {
  readyForSearch: boolean
  completionPercentage: number
}

// ── Trip summary ───────────────────────────────────────────────────────────

export interface TripSummary {
  destination: string
  departureCity: string
  departureDate: string
  returnDate: string
  durationDays: number
  travelPurpose: TravelPurpose
  travelers: TravelerGroup
}

// ── TravelSearchRequest (the single source of truth) ───────────────────────

export interface TravelSearchRequest {
  // Trip summary
  destination: string
  departureCity: string
  departureDate: string
  returnDate: string
  durationDays: number
  travelPurpose: TravelPurpose
  travelers: TravelerGroup

  // Budget
  budgetAmount: number
  budgetCurrency: string
  budgetPriority: BudgetPriority

  // Flight preferences
  preferredCabin: CabinPreference
  directFlightPreferred: DirectFlightMode
  preferredDepartureTime: FlightTimePreference
  preferredArrivalTime: FlightTimePreference
  preferredAirlines: string[]
  avoidAirlines: string[]

  // Hotel preferences
  hotelStars: HotelStars
  hotelBudget: number
  preferredArea: HotelAreaPreference
  familyFriendly: boolean
  breakfastRequired: boolean
  freeCancellation: boolean
  hotelAmenities: HotelAmenity[]

  // Activities
  activityStyle: ActivityStyle
  shoppingInterest: PriorityLevel
  natureInterest: PriorityLevel
  cultureInterest: PriorityLevel
  beachInterest: PriorityLevel
  adventureInterest: PriorityLevel
  entertainmentInterest: PriorityLevel

  // Decision priorities
  lowestPriceWeight: PriorityLevel
  comfortWeight: PriorityLevel
  timeWeight: PriorityLevel
  luxuryWeight: PriorityLevel
  familyWeight: PriorityLevel

  // Missing information
  missingFields: string[]

  // Inference summary
  highConfidence: string[]
  mediumConfidence: string[]
  lowConfidence: string[]

  // Validation
  readyForSearch: boolean
  completionPercentage: number
}

// ── Builder helpers ────────────────────────────────────────────────────────

function buildTravelers(session: TravelSession): TravelerGroup {
  const adults = session.adults ?? 0
  const children = session.children ?? 0
  const infants = session.infants ?? 0
  return {
    adults,
    children,
    infants,
    total: adults + children + infants,
    type: session.travelerType,
  }
}

function buildBudget(session: TravelSession): BudgetBlock {
  const amount = session.budgetAmount ?? 0
  const total = buildTravelers(session).total
  return {
    amount,
    currency: session.budgetCurrency || 'SAR',
    priority: (session.budgetPriority || '') as BudgetPriority,
    perPerson: total > 0 ? Math.round(amount / total) : 0,
  }
}

function buildFlightPreferences(session: TravelSession): FlightPreferences {
  return {
    preferredCabin: (session.cabinClass || '') as CabinPreference,
    directFlightPreferred: (session.directFlightPreference || '') as DirectFlightMode,
    preferredDepartureTime: (session.preferredFlightTime || '') as FlightTimePreference,
    preferredArrivalTime: '' as FlightTimePreference,
    preferredAirlines: session.preferredAirline ? [session.preferredAirline] : [],
    avoidAirlines: [],
  }
}

function parseHotelStars(session: TravelSession): HotelStars {
  const cat = session.preferredHotelCategory || session.hotelCategory || ''
  if (cat === '5-star' || cat === 'ultra-luxury') return 5
  if (cat === '4-star' || cat === 'luxury') return 4
  if (cat === '3-star' || cat === 'comfort') return 3
  if (cat === '2-star' || cat === 'mid-range') return 2
  if (cat === '1-star' || cat === 'budget') return 1
  return 0
}

function buildHotelPreferences(session: TravelSession): HotelPreferences {
  const budget = buildBudget(session)
  const total = buildTravelers(session).total
  // Allocate ~40% of budget to hotel (rough heuristic)
  const hotelBudget = total > 0 && budget.amount > 0
    ? Math.round((budget.amount * 0.4) / (session.durationDays ?? 1))
    : 0

  const amenities: HotelAmenity[] = []
  if (session.childFriendlyRequired) {
    amenities.push('family-rooms', 'crib')
  }
  if ((session.luxuryPriority ?? 0) >= 2) {
    amenities.push('pool', 'spa', 'gym')
  }

  return {
    hotelStars: parseHotelStars(session),
    hotelBudget,
    preferredArea: (session.preferredHotelArea || '') as HotelAreaPreference,
    familyFriendly: session.childFriendlyRequired,
    breakfastRequired: session.foodPreference === 'halal' || session.childFriendlyRequired,
    freeCancellation: session.flexibleDates === 'flexible',
    hotelAmenities: Array.from(new Set(amenities)),
  }
}

function buildActivityInterests(session: TravelSession): ActivityInterests {
  return {
    activityStyle: (session.activityStyle || '') as ActivityStyle,
    shoppingInterest: (session.shoppingInterest ?? 0) as PriorityLevel,
    natureInterest: (session.natureInterest ?? 0) as PriorityLevel,
    cultureInterest: (session.cultureInterest ?? 0) as PriorityLevel,
    beachInterest: (session.beachInterest ?? 0) as PriorityLevel,
    adventureInterest: session.travelPurpose === 'adventure' ? 3 as PriorityLevel : (0 as PriorityLevel),
    entertainmentInterest: (session.entertainmentInterest ?? 0) as PriorityLevel,
  }
}

function buildDecisionWeights(session: TravelSession): DecisionWeights {
  const budgetPriority = session.budgetPriority || ''
  const hasKids = session.childFriendlyRequired

  let lowestPriceWeight: PriorityLevel = 0
  if (budgetPriority === 'lowest-price') lowestPriceWeight = 3
  else if (budgetPriority === 'balanced') lowestPriceWeight = 2

  let comfortWeight: PriorityLevel = (session.comfortPriority ?? 0) as PriorityLevel
  let luxuryWeight: PriorityLevel = (session.luxuryPriority ?? 0) as PriorityLevel

  let timeWeight: PriorityLevel = 1
  if (session.directFlightPreference === 'direct-only') timeWeight = 3
  else if (session.directFlightPreference === 'direct-preferred') timeWeight = 2

  let familyWeight: PriorityLevel = 0
  if (hasKids) familyWeight = 3

  return { lowestPriceWeight, comfortWeight, timeWeight, luxuryWeight, familyWeight }
}

function buildInferenceSummary(session: TravelSession): InferenceSummary {
  const conf = session.inferenceConfidence ?? {}
  const high: string[] = []
  const medium: string[] = []
  const low: string[] = []
  for (const [field, level] of Object.entries(conf)) {
    if (level === 'high') high.push(field)
    else if (level === 'medium') medium.push(field)
    else if (level === 'low') low.push(field)
  }
  return { highConfidence: high, mediumConfidence: medium, lowConfidence: low }
}

// ── Search-readiness fields ────────────────────────────────────────────────

const SEARCH_REQUIRED_FIELDS: (keyof TravelSession)[] = [
  'destination',
  'departureCity',
  'departureDate',
  'durationDays',
  'adults',
  'budgetAmount',
  'budgetCurrency',
]

function computeMissingFields(session: TravelSession): string[] {
  const missing: string[] = []
  for (const field of SEARCH_REQUIRED_FIELDS) {
    const val = session[field]
    if (val === null || val === undefined || val === '' || (typeof val === 'number' && val <= 0)) {
      missing.push(field)
    }
  }
  if (!session.departureDate && session.flexibleDates === '') {
    if (!missing.includes('departureDate')) missing.push('departureDate')
  }
  return Array.from(new Set(missing))
}

function computeSearchCompletion(session: TravelSession): number {
  const allFields: (keyof TravelSession)[] = [
    'destination', 'departureCity', 'departureDate', 'durationDays',
    'adults', 'children', 'budgetAmount', 'budgetCurrency',
    'tripPurpose', 'visaStatus', 'cabinClass', 'preferredHotelCategory',
    'interests', 'directFlightPreference', 'flexibleDates',
  ]
  const filled = allFields.filter(f => {
    const val = session[f]
    return val !== null && val !== undefined && val !== '' && !(typeof val === 'number' && val <= 0)
  }).length
  return Math.round((filled / allFields.length) * 100)
}

// ── Main builder ───────────────────────────────────────────────────────────

export function buildTravelSearchRequest(session: TravelSession): TravelSearchRequest {
  const travelers = buildTravelers(session)
  const budget = buildBudget(session)
  const flight = buildFlightPreferences(session)
  const hotel = buildHotelPreferences(session)
  const activities = buildActivityInterests(session)
  const weights = buildDecisionWeights(session)
  const inference = buildInferenceSummary(session)
  const missingFields = computeMissingFields(session)
  const completionPercentage = computeSearchCompletion(session)
  const readyForSearch = missingFields.length === 0

  return {
    // Trip summary
    destination: session.destination || '',
    departureCity: session.departureCity || '',
    departureDate: session.departureDate || '',
    returnDate: session.returnDate || '',
    durationDays: session.durationDays ?? 0,
    travelPurpose: (session.travelPurpose || '') as TravelPurpose,
    travelers,

    // Budget
    budgetAmount: budget.amount,
    budgetCurrency: budget.currency,
    budgetPriority: budget.priority,

    // Flight preferences
    preferredCabin: flight.preferredCabin,
    directFlightPreferred: flight.directFlightPreferred,
    preferredDepartureTime: flight.preferredDepartureTime,
    preferredArrivalTime: flight.preferredArrivalTime,
    preferredAirlines: flight.preferredAirlines,
    avoidAirlines: flight.avoidAirlines,

    // Hotel preferences
    hotelStars: hotel.hotelStars,
    hotelBudget: hotel.hotelBudget,
    preferredArea: hotel.preferredArea,
    familyFriendly: hotel.familyFriendly,
    breakfastRequired: hotel.breakfastRequired,
    freeCancellation: hotel.freeCancellation,
    hotelAmenities: hotel.hotelAmenities,

    // Activities
    activityStyle: activities.activityStyle,
    shoppingInterest: activities.shoppingInterest,
    natureInterest: activities.natureInterest,
    cultureInterest: activities.cultureInterest,
    beachInterest: activities.beachInterest,
    adventureInterest: activities.adventureInterest,
    entertainmentInterest: activities.entertainmentInterest,

    // Decision priorities
    lowestPriceWeight: weights.lowestPriceWeight,
    comfortWeight: weights.comfortWeight,
    timeWeight: weights.timeWeight,
    luxuryWeight: weights.luxuryWeight,
    familyWeight: weights.familyWeight,

    // Missing information
    missingFields,

    // Inference summary
    highConfidence: inference.highConfidence,
    mediumConfidence: inference.mediumConfidence,
    lowConfidence: inference.lowConfidence,

    // Validation
    readyForSearch,
    completionPercentage,
  }
}
