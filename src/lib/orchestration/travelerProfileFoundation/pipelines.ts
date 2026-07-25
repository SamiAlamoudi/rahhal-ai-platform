/**
 * Traveler profile foundation contracts — pure builders, no persistence.
 */

import type {
  AccessibilityPreferencesContract,
  AccommodationPreferencesContract,
  BudgetPreferencesContract,
  CompanionProfileContract,
  ConsentRegistryContract,
  ContextEnrichmentContract,
  EmergencyContactsContract,
  FamilyProfileContract,
  FavoriteActivitiesContract,
  FavoriteAirlinesContract,
  FavoriteDestinationsContract,
  FavoriteHotelsContract,
  FoodPreferencesContract,
  LanguagePreferencesContract,
  NotificationPreferencesContract,
  PassportMetadataContract,
  PreferenceLearningContract,
  PrivacySettingsContract,
  ProfileAuditTrailContract,
  ProfileEvidenceBuilderContract,
  ProfileLocale,
  ProfileStatusContract,
  ProfileTimelineContract,
  ProfileValidationContract,
  ProfileVersioningContract,
  TransportationPreferencesContract,
  TravelDocumentsRegistryContract,
  TravelInterestsContract,
  TravelStyleContract,
  TravelTasteAnalyzerContract,
  TravelerIdentityContract,
  TravelerMemoryContract,
  TravelerPreferencesContract,
  TravelerProfileContract,
  VisaMetadataContract,
} from './types'
import { PROFILE_PREFERENCE_DOMAINS } from './types'

const ISO = '2026-07-25T00:00:00.000Z'

export function buildTravelerProfile(): TravelerProfileContract {
  return {
    kind: 'traveler_profile',
    version: '7.1.0-traveler-profile',
    execution: 'none',
  }
}

export function buildTravelerIdentity(
  locale: ProfileLocale = 'ar',
): TravelerIdentityContract {
  return {
    kind: 'traveler_identity',
    identityId: 'identity-architecture',
    displayNameHint: 'traveler_placeholder',
    locale,
    execution: 'none',
  }
}

export function buildTravelerPreferences(): TravelerPreferencesContract {
  return {
    kind: 'traveler_preferences',
    domains: PROFILE_PREFERENCE_DOMAINS,
    execution: 'none',
  }
}

export function buildTravelStyle(): TravelStyleContract {
  return {
    kind: 'travel_style',
    styleHints: [],
    execution: 'none',
  }
}

export function buildTravelInterests(): TravelInterestsContract {
  return {
    kind: 'travel_interests',
    interestHints: [],
    execution: 'none',
  }
}

export function buildBudgetPreferences(): BudgetPreferencesContract {
  return {
    kind: 'budget_preferences',
    currencyHint: 'SAR',
    bandHint: 'unspecified',
    execution: 'none',
  }
}

export function buildAccommodationPreferences(): AccommodationPreferencesContract {
  return {
    kind: 'accommodation_preferences',
    lodgingHints: [],
    execution: 'none',
  }
}

export function buildTransportationPreferences(): TransportationPreferencesContract {
  return {
    kind: 'transportation_preferences',
    modeHints: [],
    execution: 'none',
  }
}

export function buildFoodPreferences(): FoodPreferencesContract {
  return {
    kind: 'food_preferences',
    cuisineHints: [],
    dietaryHints: [],
    execution: 'none',
  }
}

export function buildAccessibilityPreferences(): AccessibilityPreferencesContract {
  return {
    kind: 'accessibility_preferences',
    needHints: [],
    execution: 'none',
  }
}

export function buildLanguagePreferences(
  locale: ProfileLocale = 'ar',
): LanguagePreferencesContract {
  return {
    kind: 'language_preferences',
    primary: locale,
    secondary: [],
    execution: 'none',
  }
}

export function buildFavoriteDestinations(): FavoriteDestinationsContract {
  return {
    kind: 'favorite_destinations',
    destinationHints: [],
    execution: 'none',
  }
}

export function buildFavoriteAirlines(): FavoriteAirlinesContract {
  return {
    kind: 'favorite_airlines',
    airlineHints: [],
    execution: 'none',
  }
}

export function buildFavoriteHotels(): FavoriteHotelsContract {
  return {
    kind: 'favorite_hotels',
    hotelHints: [],
    execution: 'none',
  }
}

export function buildFavoriteActivities(): FavoriteActivitiesContract {
  return {
    kind: 'favorite_activities',
    activityHints: [],
    execution: 'none',
  }
}

export function buildFamilyProfile(): FamilyProfileContract {
  return {
    kind: 'family_profile',
    memberCountHint: 0,
    execution: 'none',
  }
}

export function buildCompanionProfiles(): CompanionProfileContract[] {
  return []
}

export function buildPassportMetadata(): PassportMetadataContract {
  return {
    kind: 'passport_metadata',
    metadataKeys: ['issuing_country_hint', 'expiry_hint'],
    ocr: false,
    stored: false,
    execution: 'none',
  }
}

export function buildVisaMetadata(): VisaMetadataContract {
  return {
    kind: 'visa_metadata',
    metadataKeys: ['destination_hint', 'status_hint'],
    stored: false,
    execution: 'none',
  }
}

export function buildTravelDocumentsRegistry(): TravelDocumentsRegistryContract {
  return {
    kind: 'travel_documents_registry',
    entries: [
      {
        id: 'tdoc-passport',
        documentKind: 'passport_metadata',
        label: 'passport_metadata',
        registered: false,
      },
      {
        id: 'tdoc-visa',
        documentKind: 'visa_metadata',
        label: 'visa_metadata',
        registered: false,
      },
    ],
    execution: 'none',
  }
}

export function buildEmergencyContacts(): EmergencyContactsContract {
  return {
    kind: 'emergency_contacts',
    contactHints: [],
    execution: 'none',
  }
}

export function buildNotificationPreferences(): NotificationPreferencesContract {
  return {
    kind: 'notification_preferences',
    channelHints: [],
    execution: 'none',
  }
}

export function buildPrivacySettings(): PrivacySettingsContract {
  return {
    kind: 'privacy_settings',
    visibilityHint: 'private',
    shareHints: [],
    execution: 'none',
  }
}

export function buildConsentRegistry(): ConsentRegistryContract {
  return {
    kind: 'consent_registry',
    entries: [
      {
        id: 'consent-personalization',
        consentKey: 'ai_personalization',
        grantedHint: false,
      },
      {
        id: 'consent-analytics',
        consentKey: 'profile_analytics',
        grantedHint: false,
      },
    ],
    execution: 'none',
  }
}

export function buildProfileTimeline(): ProfileTimelineContract {
  return {
    kind: 'profile_timeline',
    events: [
      {
        eventId: 'ptl-created',
        eventKind: 'profile_created',
        atIso: ISO,
        summary: 'architecture blueprint',
      },
    ],
    execution: 'none',
  }
}

export function buildProfileAuditTrail(): ProfileAuditTrailContract {
  return {
    kind: 'profile_audit_trail',
    entries: [
      {
        id: 'paudit-open',
        atIso: ISO,
        action: 'profile_created',
        detail: 'architecture blueprint',
      },
    ],
    persisted: false,
  }
}

export function buildProfileVersioning(): ProfileVersioningContract {
  return {
    kind: 'profile_versioning',
    version: 0,
    previousVersion: null,
    execution: 'none',
  }
}

export function buildProfileStatus(): ProfileStatusContract {
  return {
    kind: 'profile_status',
    status: 'draft',
    execution: 'none',
  }
}

export function buildProfileValidation(): ProfileValidationContract {
  return {
    kind: 'profile_validation',
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildProfileEvidenceBuilder(): ProfileEvidenceBuilderContract {
  return {
    kind: 'profile_evidence_builder',
    evidenceKeys: [],
    execution: 'none',
  }
}

export function buildTravelerMemoryContract(): TravelerMemoryContract {
  return {
    kind: 'traveler_memory_contract',
    memoryKeys: [],
    execution: 'none',
  }
}

export function buildContextEnrichmentContract(): ContextEnrichmentContract {
  return {
    kind: 'context_enrichment_contract',
    enrichmentKeys: [],
    execution: 'none',
  }
}

export function buildPreferenceLearningContract(): PreferenceLearningContract {
  return {
    kind: 'preference_learning_contract',
    learningDomains: PROFILE_PREFERENCE_DOMAINS,
    execution: 'none',
  }
}

export function buildTravelTasteAnalyzerContract(): TravelTasteAnalyzerContract {
  return {
    kind: 'travel_taste_analyzer_contract',
    tasteDimensions: ['pace', 'luxury', 'culture', 'adventure'],
    execution: 'none',
  }
}
