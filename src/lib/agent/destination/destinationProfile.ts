/**
 * Evolution Sprint 7 — DestinationProfile
 */

import { findDestinationKnowledge } from './destinationKnowledge'
import type { DestinationKnowledgeRecord, DestinationLocale, DestinationProfileView } from './destinationTypes'

export function toDestinationProfile(
  record: DestinationKnowledgeRecord,
  locale: DestinationLocale = 'en',
): DestinationProfileView {
  return {
    id: record.id,
    name: locale === 'ar' ? record.nameAr : record.nameEn,
    nameAr: record.nameAr,
    region: record.region,
    record,
  }
}

export function resolveDestinationProfile(
  query: string,
  locale: DestinationLocale = 'en',
): DestinationProfileView | null {
  const record = findDestinationKnowledge(query)
  if (!record) return null
  return toDestinationProfile(record, locale)
}

export const DestinationProfile = {
  fromRecord: toDestinationProfile,
  resolve: resolveDestinationProfile,
}
