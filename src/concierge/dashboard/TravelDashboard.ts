import type { TravelDraft } from '../../brain/travel/types'
import type { UserPreferenceProfile } from '../../brain/preferences/types'
import type { LocaleCode } from '../../brain/types'
import { clamp01 } from '../../brain/types'
import type { TravelDashboardModel } from '../types'

export function buildTravelDashboard(
  draft: TravelDraft,
  prefs: UserPreferenceProfile,
  hasRecs: boolean,
  locale: LocaleCode = 'en',
): TravelDashboardModel {
  const flight = draft.origin && draft.destination ? 0.85 : draft.destination ? 0.45 : 0.15
  const hotel = draft.hotelClass || draft.destination ? 0.7 : 0.2
  const visa = draft.visaCountry ? 0.8 : draft.destination ? 0.4 : 0.1
  const weather = draft.destination ? 0.75 : 0.2
  const budget =
    draft.budgetAmount || prefs.budgetLevel !== 'unknown'
      ? draft.budgetAmount && draft.budgetAmount < 800
        ? 0.45
        : 0.82
      : 0.35
  const packing = hasRecs ? 0.55 : 0.2
  const preparation = clamp01((flight + hotel + visa + weather + budget + packing) / 6)
  const tripScore = Math.round(preparation * 100)

  return {
    tripScore,
    readiness: {
      preparation: Math.round(preparation * 100),
      budget: Math.round(budget * 100),
      packing: Math.round(packing * 100),
      flight: Math.round(flight * 100),
      hotel: Math.round(hotel * 100),
      visa: Math.round(visa * 100),
      weather: Math.round(weather * 100),
    },
    headline:
      locale === 'ar'
        ? tripScore >= 70
          ? 'رحلتك تتماسك بأناقة.'
          : 'لا تزال هناك لمسات هادئة قبل الاكتمال.'
        : tripScore >= 70
          ? 'Your trip is composing elegantly.'
          : 'A few calm touches remain before readiness.',
    locale,
  }
}
