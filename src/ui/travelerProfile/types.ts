/**
 * Phase 5 Stage 4 — Traveler Profile Center contracts.
 * Presentation only. No auth, backend, AI, booking, payments, or storage.
 */

export type TravelerProfileLocale = 'ar' | 'en'
export type TravelerProfileTheme = 'light' | 'dark'

export interface TravelerProfileField {
  id: string
  label: string
  value: string
}

export interface TravelerPreferenceChip {
  id: string
  label: string
  active: boolean
}

export interface TravelerDocumentCard {
  id: string
  title: string
  subtitle: string
  statusLabel: string
}

export interface TravelerPassportCard {
  id: string
  country: string
  numberMasked: string
  expiresLabel: string
}

export interface TravelerLoyaltyCard {
  id: string
  program: string
  tier: string
  pointsLabel: string
}

export interface TravelerContactCard {
  id: string
  name: string
  relation: string
  phoneMasked: string
}

export interface TravelerSavedTraveler {
  id: string
  name: string
  role: string
}

export interface TravelerSettingsItem {
  id: string
  label: string
  valueLabel: string
}

export interface TravelerCompletionStep {
  id: string
  label: string
  done: boolean
}

export interface TravelerProfileUiState {
  locale: TravelerProfileLocale
  theme: TravelerProfileTheme
  displayName: string
  headline: string
  overview: string
  personalInfo: TravelerProfileField[]
  travelPreferences: TravelerPreferenceChip[]
  languages: TravelerPreferenceChip[]
  currencies: TravelerPreferenceChip[]
  timeZone: string
  travelDocuments: TravelerDocumentCard[]
  passports: TravelerPassportCard[]
  visaPlaceholder: string
  boardingPassPlaceholder: string
  emergencyContacts: TravelerContactCard[]
  familyMembers: TravelerContactCard[]
  frequentFlyerPrograms: TravelerLoyaltyCard[]
  hotelLoyaltyPrograms: TravelerLoyaltyCard[]
  preferredAirlines: TravelerPreferenceChip[]
  preferredHotels: TravelerPreferenceChip[]
  preferredSeat: string
  mealPreferences: TravelerPreferenceChip[]
  paymentMethodsPlaceholder: string
  savedTravelers: TravelerSavedTraveler[]
  privacySettings: TravelerSettingsItem[]
  notificationSettings: TravelerSettingsItem[]
  securityStatus: string
  securityItems: TravelerSettingsItem[]
  profileCompletionPercent: number
  completionTimeline: TravelerCompletionStep[]
  featureEnabled: boolean
}

export const TRAVELER_PROFILE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoAi: false,
  wiredIntoRuntime: false,
  wiredIntoBooking: false,
  wiredIntoMaps: false,
  wiredIntoWeather: false,
  wiredIntoFirebase: false,
  wiredIntoNotifications: false,
  authentication: false,
  backend: false,
  realtime: false,
  payments: false,
  storage: false,
  bookingApis: false,
  mapsApis: false,
  weatherApis: false,
} as const
