/**
 * Sprint 12 — Passenger Management types (provider-agnostic).
 */

export type PassengerType = 'adult' | 'child' | 'infant'

export type PassengerTitle = 'mr' | 'mrs' | 'ms' | 'miss' | 'mstr' | 'dr'

export type PassengerGender = 'male' | 'female' | 'unspecified'

export interface TravellerCounts {
  adults: number
  children: number
  infants: number
  total: number
}

export interface Passenger {
  id: string
  type: PassengerType
  title: PassengerTitle | ''
  firstName: string
  lastName: string
  gender: PassengerGender | ''
  dateOfBirth: string
  nationality: string
  passportNumber: string
  passportExpiry: string
  passportIssuingCountry: string
  email: string
  mobileNumber: string
  emergencyContact: string
  specialAssistance: string
  mealPreference: string
  frequentFlyerNumber: string
}

export type PassengerField = keyof Passenger

export interface PassengerFieldError {
  field: PassengerField | 'type' | 'counts'
  message: string
}

export interface PassengerValidationResult {
  valid: boolean
  errors: PassengerFieldError[]
  /** Friendly messages keyed by field for form UI. */
  fieldMessages: Partial<Record<PassengerField | 'type' | 'counts', string>>
}

export interface PassengerFormState {
  passengers: Passenger[]
  counts: TravellerCounts
}

export interface FareBreakdown {
  fare: number
  taxes: number
  fees: number
  grandTotal: number
  currency: string
  taxRate: number
}

export interface SelectedFlightSummary {
  title: string
  airline: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  cabin: string
  stops: number | null
  price: number
  currency: string
}

export const PASSENGER_TITLES: readonly PassengerTitle[] = [
  'mr',
  'mrs',
  'ms',
  'miss',
  'mstr',
  'dr',
] as const

export const PASSENGER_GENDERS: readonly PassengerGender[] = [
  'male',
  'female',
  'unspecified',
] as const

export function emptyPassenger(type: PassengerType, id?: string): Passenger {
  return {
    id: id ?? `pax_${type}_${Math.random().toString(36).slice(2, 10)}`,
    type,
    title: '',
    firstName: '',
    lastName: '',
    gender: '',
    dateOfBirth: '',
    nationality: '',
    passportNumber: '',
    passportExpiry: '',
    passportIssuingCountry: '',
    email: '',
    mobileNumber: '',
    emergencyContact: '',
    specialAssistance: '',
    mealPreference: '',
    frequentFlyerNumber: '',
  }
}
