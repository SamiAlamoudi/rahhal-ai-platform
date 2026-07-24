/**
 * Phase 5 Stage 4 — Traveler Profile Center barrel.
 *
 * Isolated presentation package. Not wired into production main.tsx,
 * AI, Runtime, Booking, Maps, Weather, Firebase, Notifications, auth,
 * payments, or storage. Gated by `ui.traveler_profile` (default OFF).
 */

import { TRAVELER_PROFILE_ISOLATION as TP_ISOLATION } from './types'

export {
  TRAVELER_PROFILE_FEATURE_ID,
  isTravelerProfileEnabled,
  TravelerProfileRegistry,
} from './travelerProfileRegistry'

export type {
  TravelerProfileLocale,
  TravelerProfileTheme,
  TravelerProfileField,
  TravelerPreferenceChip,
  TravelerDocumentCard,
  TravelerPassportCard,
  TravelerLoyaltyCard,
  TravelerContactCard,
  TravelerSavedTraveler,
  TravelerSettingsItem,
  TravelerCompletionStep,
  TravelerProfileUiState,
} from './types'

export { TRAVELER_PROFILE_ISOLATION } from './types'

export {
  TRAVELER_PROFILE_TOKENS,
  travelerProfileTokenCssVariables,
} from './design/travelerProfileTokens'

export {
  createDemoTravelerProfileState,
  assertTravelerProfileIsolation,
} from './state/travelerProfileState'

export {
  TravelerProfileCenter,
  tryRenderTravelerProfileCenter,
} from './components/TravelerProfileCenter'
export type { TravelerProfileCenterProps } from './components/TravelerProfileCenter'
export { ProfileOverview } from './components/ProfileOverview'
export { PersonalInfoPanel } from './components/PersonalInfoPanel'
export { PreferencesPanel } from './components/PreferencesPanel'
export { DocumentsPanel } from './components/DocumentsPanel'
export { LoyaltyAndTravelers } from './components/LoyaltyAndTravelers'
export { SettingsAndSecurity } from './components/SettingsAndSecurity'

export const TRAVELER_PROFILE_ARCHITECTURE = {
  version: '5.4.0-traveler-profile',
  featureId: 'ui.traveler_profile' as const,
  presentationOnly: true,
  regions: [
    'overview',
    'personal_information',
    'travel_preferences',
    'languages',
    'currencies',
    'time_zone',
    'travel_documents',
    'multiple_passports',
    'visa_placeholder',
    'boarding_pass_placeholder',
    'emergency_contacts',
    'family_members',
    'frequent_flyer',
    'hotel_loyalty',
    'preferred_airlines',
    'preferred_hotels',
    'preferred_seat',
    'meal_preferences',
    'payment_methods_placeholder',
    'saved_travelers',
    'privacy_settings',
    'notification_settings',
    'security_center',
    'profile_completion',
  ] as const,
  ...TP_ISOLATION,
} as const
