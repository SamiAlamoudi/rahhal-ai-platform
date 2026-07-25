/**
 * Traveler Profile Foundation facade — builds architecture blueprints only.
 * Never persists, authenticates, OCRs, or calls LLMs.
 */

import { listProfileRegistry } from './registry'
import { isBrainTravelerProfileEnabled } from './registry'
import {
  buildAccessibilityPreferences,
  buildAccommodationPreferences,
  buildBudgetPreferences,
  buildCompanionProfiles,
  buildConsentRegistry,
  buildContextEnrichmentContract,
  buildEmergencyContacts,
  buildFamilyProfile,
  buildFavoriteActivities,
  buildFavoriteAirlines,
  buildFavoriteDestinations,
  buildFavoriteHotels,
  buildFoodPreferences,
  buildLanguagePreferences,
  buildNotificationPreferences,
  buildPassportMetadata,
  buildPreferenceLearningContract,
  buildPrivacySettings,
  buildProfileAuditTrail,
  buildProfileEvidenceBuilder,
  buildProfileStatus,
  buildProfileTimeline,
  buildProfileValidation,
  buildProfileVersioning,
  buildTransportationPreferences,
  buildTravelDocumentsRegistry,
  buildTravelInterests,
  buildTravelStyle,
  buildTravelTasteAnalyzerContract,
  buildTravelerIdentity,
  buildTravelerMemoryContract,
  buildTravelerPreferences,
  buildTravelerProfile,
  buildVisaMetadata,
} from './pipelines'
import type { ProfileLocale, TravelerProfileBlueprint } from './types'
import { TRAVELER_PROFILE_ISOLATION } from './types'

export interface BuildTravelerProfileBlueprintOptions {
  enabled?: boolean
  sessionId?: string
  locale?: ProfileLocale
}

export function buildTravelerProfileBlueprint(
  options: BuildTravelerProfileBlueprintOptions = {},
): TravelerProfileBlueprint {
  const locale = options.locale ?? 'ar'

  return {
    version: '7.1.0-traveler-profile',
    featureId: 'brain.traveler_profile',
    architectureOnly: true,
    profile: buildTravelerProfile(),
    identity: buildTravelerIdentity(locale),
    preferences: buildTravelerPreferences(),
    travelStyle: buildTravelStyle(),
    travelInterests: buildTravelInterests(),
    budgetPreferences: buildBudgetPreferences(),
    accommodationPreferences: buildAccommodationPreferences(),
    transportationPreferences: buildTransportationPreferences(),
    foodPreferences: buildFoodPreferences(),
    accessibilityPreferences: buildAccessibilityPreferences(),
    languagePreferences: buildLanguagePreferences(locale),
    favoriteDestinations: buildFavoriteDestinations(),
    favoriteAirlines: buildFavoriteAirlines(),
    favoriteHotels: buildFavoriteHotels(),
    favoriteActivities: buildFavoriteActivities(),
    familyProfile: buildFamilyProfile(),
    companionProfiles: buildCompanionProfiles(),
    passportMetadata: buildPassportMetadata(),
    visaMetadata: buildVisaMetadata(),
    documentsRegistry: buildTravelDocumentsRegistry(),
    emergencyContacts: buildEmergencyContacts(),
    notificationPreferences: buildNotificationPreferences(),
    privacySettings: buildPrivacySettings(),
    consentRegistry: buildConsentRegistry(),
    timeline: buildProfileTimeline(),
    auditTrail: buildProfileAuditTrail(),
    versioning: buildProfileVersioning(),
    status: buildProfileStatus(),
    validation: buildProfileValidation(),
    evidenceBuilder: buildProfileEvidenceBuilder(),
    travelerMemory: buildTravelerMemoryContract(),
    contextEnrichment: buildContextEnrichmentContract(),
    preferenceLearning: buildPreferenceLearningContract(),
    travelTasteAnalyzer: buildTravelTasteAnalyzerContract(),
    registry: listProfileRegistry(),
  }
}

export function tryBuildTravelerProfileBlueprint(
  options: BuildTravelerProfileBlueprintOptions = {},
): TravelerProfileBlueprint | null {
  if (!isBrainTravelerProfileEnabled({ enabled: options.enabled })) {
    return null
  }
  return buildTravelerProfileBlueprint(options)
}

export function assertTravelerProfileIsolation(): typeof TRAVELER_PROFILE_ISOLATION & {
  architectureOnly: boolean
  registrySize: number
} {
  return {
    ...TRAVELER_PROFILE_ISOLATION,
    architectureOnly: true,
    registrySize: listProfileRegistry().length,
  }
}

export const TravelerProfileFoundation = {
  buildBlueprint: buildTravelerProfileBlueprint,
  tryBuildBlueprint: tryBuildTravelerProfileBlueprint,
  assertIsolation: assertTravelerProfileIsolation,
}
