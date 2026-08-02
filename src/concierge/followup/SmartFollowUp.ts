import type { TravelDraft } from '../../brain/travel/types'
import type { UserPreferenceProfile } from '../../brain/preferences/types'
import type { FollowUpQuestion } from '../types'

/**
 * Ask only useful, non-repetitive consultant questions — never form-like.
 */
export function buildSmartFollowUps(
  draft: TravelDraft,
  prefs: UserPreferenceProfile,
  askedKeys: Set<string>,
  locale: 'ar' | 'en' = 'en',
): FollowUpQuestion[] {
  const candidates: Array<FollowUpQuestion & { key: string }> = []
  const ar = locale === 'ar'

  if (!draft.destination && !askedKeys.has('destination')) {
    candidates.push({
      key: 'destination',
      id: 'fu-dest',
      text: ar
        ? 'أي مدينة تناديك أكثر الآن — هدوء أم إيقاع حي؟'
        : 'Which city is calling you — quiet courtyards or a living rhythm?',
      reason: 'destination_missing',
    })
  }
  if (draft.destination && !draft.origin && !askedKeys.has('origin')) {
    candidates.push({
      key: 'origin',
      id: 'fu-origin',
      text: ar ? 'من أي مدينة نبدأ الإقلاع؟' : 'Which city should we depart from?',
      reason: 'origin_missing',
    })
  }
  if (!draft.budgetAmount && prefs.budgetLevel === 'unknown' && !askedKeys.has('budget')) {
    candidates.push({
      key: 'budget',
      id: 'fu-budget',
      text: ar
        ? 'هل تفضّل أن نتحرك بمرونة أنيقة أم بإطار ميزانية واضح؟'
        : 'Shall we move with elegant flexibility, or a clear budget frame?',
      reason: 'budget_missing',
    })
  }
  if (!draft.durationNights && !askedKeys.has('duration')) {
    candidates.push({
      key: 'duration',
      id: 'fu-duration',
      text: ar ? 'كم ليلة تمنحك الإحساس بأن الرحلة اكتملت؟' : 'How many nights would feel complete?',
      reason: 'duration_missing',
    })
  }
  if (
    prefs.travelStyle === 'unknown' &&
    !askedKeys.has('style') &&
    Boolean(draft.destination)
  ) {
    candidates.push({
      key: 'style',
      id: 'fu-style',
      text: ar
        ? 'أقرب إلى الاسترخاء، أم الاكتشاف، أم لحظة عمل هادئة؟'
        : 'Closer to rest, discovery, or a quiet business cadence?',
      reason: 'style_unknown',
    })
  }

  // At most two natural follow-ups — never form-like lists
  return candidates.slice(0, 2)
}
