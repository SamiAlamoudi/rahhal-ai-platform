/**
 * Phase 7 Stage 1 — Traveler Profile Foundation contracts.
 * Architecture / interfaces / types / blueprints only.
 * No database, auth, storage, OCR, LLM, Runtime, HTTP, or APIs.
 */

export type ProfileLocale = 'ar' | 'en'

export type ProfileStatusId =
  | 'draft'
  | 'incomplete'
  | 'active'
  | 'suspended'
  | 'archived'
  | 'closed'

export type ProfileTimelineEventKind =
  | 'profile_created'
  | 'identity_updated'
  | 'preferences_updated'
  | 'document_registered'
  | 'consent_recorded'
  | 'version_bumped'
  | 'validation_ran'
  | 'status_changed'
  | 'audit_appended'

export type ProfilePreferenceDomain =
  | 'travel_style'
  | 'travel_interests'
  | 'budget'
  | 'accommodation'
  | 'transportation'
  | 'food'
  | 'accessibility'
  | 'language'
  | 'favorites'
  | 'notifications'
  | 'privacy'

export type ProfileDocumentKind =
  | 'passport_metadata'
  | 'visa_metadata'
  | 'other_travel_document'

export interface TravelerProfileContract {
  kind: 'traveler_profile'
  version: '7.1.0-traveler-profile'
  execution: 'none'
}

export interface TravelerIdentityContract {
  kind: 'traveler_identity'
  identityId: string
  displayNameHint: string
  locale: ProfileLocale
  execution: 'none'
}

export interface TravelerPreferencesContract {
  kind: 'traveler_preferences'
  domains: readonly ProfilePreferenceDomain[]
  execution: 'none'
}

export interface TravelStyleContract {
  kind: 'travel_style'
  styleHints: readonly string[]
  execution: 'none'
}

export interface TravelInterestsContract {
  kind: 'travel_interests'
  interestHints: readonly string[]
  execution: 'none'
}

export interface BudgetPreferencesContract {
  kind: 'budget_preferences'
  currencyHint: string
  bandHint: string
  execution: 'none'
}

export interface AccommodationPreferencesContract {
  kind: 'accommodation_preferences'
  lodgingHints: readonly string[]
  execution: 'none'
}

export interface TransportationPreferencesContract {
  kind: 'transportation_preferences'
  modeHints: readonly string[]
  execution: 'none'
}

export interface FoodPreferencesContract {
  kind: 'food_preferences'
  cuisineHints: readonly string[]
  dietaryHints: readonly string[]
  execution: 'none'
}

export interface AccessibilityPreferencesContract {
  kind: 'accessibility_preferences'
  needHints: readonly string[]
  execution: 'none'
}

export interface LanguagePreferencesContract {
  kind: 'language_preferences'
  primary: ProfileLocale
  secondary: readonly ProfileLocale[]
  execution: 'none'
}

export interface FavoriteDestinationsContract {
  kind: 'favorite_destinations'
  destinationHints: readonly string[]
  execution: 'none'
}

export interface FavoriteAirlinesContract {
  kind: 'favorite_airlines'
  airlineHints: readonly string[]
  execution: 'none'
}

export interface FavoriteHotelsContract {
  kind: 'favorite_hotels'
  hotelHints: readonly string[]
  execution: 'none'
}

export interface FavoriteActivitiesContract {
  kind: 'favorite_activities'
  activityHints: readonly string[]
  execution: 'none'
}

export interface FamilyProfileContract {
  kind: 'family_profile'
  memberCountHint: number
  execution: 'none'
}

export interface CompanionProfileContract {
  kind: 'companion_profile'
  companionId: string
  relationHint: string
  execution: 'none'
}

export interface PassportMetadataContract {
  kind: 'passport_metadata'
  metadataKeys: readonly string[]
  ocr: false
  stored: false
  execution: 'none'
}

export interface VisaMetadataContract {
  kind: 'visa_metadata'
  metadataKeys: readonly string[]
  stored: false
  execution: 'none'
}

export interface TravelDocumentsRegistryEntry {
  id: string
  documentKind: ProfileDocumentKind
  label: string
  registered: false
}

export interface TravelDocumentsRegistryContract {
  kind: 'travel_documents_registry'
  entries: readonly TravelDocumentsRegistryEntry[]
  execution: 'none'
}

export interface EmergencyContactsContract {
  kind: 'emergency_contacts'
  contactHints: readonly string[]
  execution: 'none'
}

export interface NotificationPreferencesContract {
  kind: 'notification_preferences'
  channelHints: readonly string[]
  execution: 'none'
}

export interface PrivacySettingsContract {
  kind: 'privacy_settings'
  visibilityHint: string
  shareHints: readonly string[]
  execution: 'none'
}

export interface ConsentRegistryEntry {
  id: string
  consentKey: string
  grantedHint: false
}

export interface ConsentRegistryContract {
  kind: 'consent_registry'
  entries: readonly ConsentRegistryEntry[]
  execution: 'none'
}

export interface ProfileTimelineEvent {
  eventId: string
  eventKind: ProfileTimelineEventKind
  atIso: string
  summary: string
}

export interface ProfileTimelineContract {
  kind: 'profile_timeline'
  events: readonly ProfileTimelineEvent[]
  execution: 'none'
}

export interface ProfileAuditEntry {
  id: string
  atIso: string
  action: string
  detail: string
}

export interface ProfileAuditTrailContract {
  kind: 'profile_audit_trail'
  entries: readonly ProfileAuditEntry[]
  persisted: false
}

export interface ProfileVersioningContract {
  kind: 'profile_versioning'
  version: number
  previousVersion: number | null
  execution: 'none'
}

export interface ProfileStatusContract {
  kind: 'profile_status'
  status: ProfileStatusId
  execution: 'none'
}

export interface ProfileValidationContract {
  kind: 'profile_validation'
  valid: boolean
  issues: readonly string[]
  execution: 'none'
}

/** AI profile capability contracts — blueprints only. */
export interface ProfileEvidenceBuilderContract {
  kind: 'profile_evidence_builder'
  evidenceKeys: readonly string[]
  execution: 'none'
}

export interface TravelerMemoryContract {
  kind: 'traveler_memory_contract'
  memoryKeys: readonly string[]
  execution: 'none'
}

export interface ContextEnrichmentContract {
  kind: 'context_enrichment_contract'
  enrichmentKeys: readonly string[]
  execution: 'none'
}

export interface PreferenceLearningContract {
  kind: 'preference_learning_contract'
  learningDomains: readonly ProfilePreferenceDomain[]
  execution: 'none'
}

export interface TravelTasteAnalyzerContract {
  kind: 'travel_taste_analyzer_contract'
  tasteDimensions: readonly string[]
  execution: 'none'
}

export interface ProfileRegistryEntry {
  id: string
  sectionId: string
  label: string
  enabledHint: false
}

export interface TravelerProfileBlueprint {
  version: '7.1.0-traveler-profile'
  featureId: 'brain.traveler_profile'
  architectureOnly: true
  profile: TravelerProfileContract
  identity: TravelerIdentityContract
  preferences: TravelerPreferencesContract
  travelStyle: TravelStyleContract
  travelInterests: TravelInterestsContract
  budgetPreferences: BudgetPreferencesContract
  accommodationPreferences: AccommodationPreferencesContract
  transportationPreferences: TransportationPreferencesContract
  foodPreferences: FoodPreferencesContract
  accessibilityPreferences: AccessibilityPreferencesContract
  languagePreferences: LanguagePreferencesContract
  favoriteDestinations: FavoriteDestinationsContract
  favoriteAirlines: FavoriteAirlinesContract
  favoriteHotels: FavoriteHotelsContract
  favoriteActivities: FavoriteActivitiesContract
  familyProfile: FamilyProfileContract
  companionProfiles: readonly CompanionProfileContract[]
  passportMetadata: PassportMetadataContract
  visaMetadata: VisaMetadataContract
  documentsRegistry: TravelDocumentsRegistryContract
  emergencyContacts: EmergencyContactsContract
  notificationPreferences: NotificationPreferencesContract
  privacySettings: PrivacySettingsContract
  consentRegistry: ConsentRegistryContract
  timeline: ProfileTimelineContract
  auditTrail: ProfileAuditTrailContract
  versioning: ProfileVersioningContract
  status: ProfileStatusContract
  validation: ProfileValidationContract
  evidenceBuilder: ProfileEvidenceBuilderContract
  travelerMemory: TravelerMemoryContract
  contextEnrichment: ContextEnrichmentContract
  preferenceLearning: PreferenceLearningContract
  travelTasteAnalyzer: TravelTasteAnalyzerContract
  registry: readonly ProfileRegistryEntry[]
}

export const TRAVELER_PROFILE_ISOLATION = {
  wiredIntoProductionRoutes: false,
  wiredIntoDatabase: false,
  wiredIntoAuthentication: false,
  wiredIntoStorage: false,
  passportOcr: false,
  wiredIntoLlms: false,
  wiredIntoRuntime: false,
  httpRequests: false,
  streamingImplemented: false,
  wiredIntoApis: false,
  businessLogic: false,
  distinctFromUiTravelerProfile: true,
} as const

export const PROFILE_PREFERENCE_DOMAINS: readonly ProfilePreferenceDomain[] = [
  'travel_style',
  'travel_interests',
  'budget',
  'accommodation',
  'transportation',
  'food',
  'accessibility',
  'language',
  'favorites',
  'notifications',
  'privacy',
] as const

export const PROFILE_STATUS_IDS: readonly ProfileStatusId[] = [
  'draft',
  'incomplete',
  'active',
  'suspended',
  'archived',
  'closed',
] as const

export const PROFILE_SECTION_IDS = [
  'identity',
  'preferences',
  'travel_style',
  'travel_interests',
  'budget',
  'accommodation',
  'transportation',
  'food',
  'accessibility',
  'language',
  'favorite_destinations',
  'favorite_airlines',
  'favorite_hotels',
  'favorite_activities',
  'family',
  'companions',
  'passport_metadata',
  'visa_metadata',
  'documents',
  'emergency_contacts',
  'notifications',
  'privacy',
  'consent',
  'timeline',
  'audit',
  'versioning',
  'status',
  'validation',
  'ai_evidence',
  'ai_memory',
  'ai_context_enrichment',
  'ai_preference_learning',
  'ai_taste_analyzer',
] as const

export type ProfileSectionId = (typeof PROFILE_SECTION_IDS)[number]
