/**
 * Evolution Sprint 5 — TravelerProfile
 * Soft conversational hints (not a CRM user profile).
 */

import { isoNow, uniqueStrings, type TravelerLocale, type TravelerProfileSnapshot } from './travelerTypes'

export function createEmptyProfile(locale: TravelerLocale, now?: Date): TravelerProfileSnapshot {
  return {
    locale,
    displayHints: [],
    purposeHints: [],
    partyHints: [],
    updatedAt: isoNow(now),
  }
}

export function updateProfileFromText(
  profile: TravelerProfileSnapshot,
  text: string,
  locale: TravelerLocale,
  now?: Date,
): TravelerProfileSnapshot {
  const purposeHints = [...profile.purposeHints]
  const partyHints = [...profile.partyHints]
  const displayHints = [...profile.displayHints]

  if (/honeymoon|شهر\s*عسل/i.test(text)) purposeHints.push('honeymoon')
  if (/family|عائلة|عائلية/i.test(text)) purposeHints.push('family')
  if (/business|عمل|مؤتمر/i.test(text)) purposeHints.push('business')
  if (/adventure|مغامرة/i.test(text)) purposeHints.push('adventure')
  if (/culture|ثقافة/i.test(text)) purposeHints.push('cultural')

  if (/couple|لشخصين|نحن اثنين/i.test(text)) partyHints.push('couple')
  if (/kids|أطفال|family|عائلة/i.test(text)) partyHints.push('family_party')
  if (/solo|وحدي|alone/i.test(text)) partyHints.push('solo')

  if (/luxury|فخم/i.test(text)) displayHints.push('luxury_lean')
  if (/relax|استجمام/i.test(text)) displayHints.push('recovery_lean')
  if (/food|مطعم|أكل/i.test(text)) displayHints.push('food_lean')

  return {
    locale,
    purposeHints: uniqueStrings(purposeHints).slice(-8),
    partyHints: uniqueStrings(partyHints).slice(-8),
    displayHints: uniqueStrings(displayHints).slice(-10),
    updatedAt: isoNow(now),
  }
}

export const TravelerProfile = {
  createEmpty: createEmptyProfile,
  updateFromText: updateProfileFromText,
}
