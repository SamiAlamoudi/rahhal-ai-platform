import type { UserPreferenceProfile } from '../../brain/preferences/types'
import type { TravelDraft } from '../../brain/travel/types'
import type { TravelDnaProfile, TravelDnaTrait } from '../types'
import { clamp01 } from '../../brain/types'

export function inferTravelDna(
  prefs: UserPreferenceProfile,
  draft: TravelDraft,
  textHints: string[],
  locale: 'ar' | 'en' = 'en',
): TravelDnaProfile {
  const scores: Record<TravelDnaTrait, number> = {
    explorer: 0.2,
    luxury: 0.15,
    family: 0.1,
    business: 0.1,
    adventure: 0.1,
    relaxation: 0.2,
    shopping: 0.05,
    culture: 0.15,
    food: 0.1,
  }

  const style = prefs.travelStyle
  if (style === 'luxury') scores.luxury += 0.45
  if (style === 'business') scores.business += 0.45
  if (style === 'family') scores.family += 0.45
  if (style === 'adventure') scores.adventure += 0.45
  if (style === 'leisure') scores.relaxation += 0.35
  if (style === 'budget') scores.explorer += 0.25

  if (prefs.luxuryLevel === 'premium' || prefs.luxuryLevel === 'ultra') scores.luxury += 0.25
  if ((draft.travellers?.children ?? 0) > 0) scores.family += 0.35
  if (draft.hotelClass && draft.hotelClass >= 5) scores.luxury += 0.2

  const blob = textHints.join(' ').toLowerCase()
  if (/museum|culture|ثقافة|متحف/.test(blob)) scores.culture += 0.3
  if (/food|restaurant|طعام|مطعم|حلال/.test(blob)) scores.food += 0.3
  if (/shop|تسوق|مول/.test(blob)) scores.shopping += 0.3
  if (/relax|هدوء|سبا|quiet/.test(blob)) scores.relaxation += 0.25
  if (/explore|اكتشف|adventure|مغامر/.test(blob)) scores.explorer += 0.25

  const traits = (Object.entries(scores) as Array<[TravelDnaTrait, number]>)
    .map(([trait, score]) => ({ trait, score: clamp01(score) }))
    .sort((a, b) => b.score - a.score)

  const primary = traits[0]?.trait ?? 'explorer'
  const summary =
    locale === 'ar'
      ? `شخصيتك السفرية تميل إلى ${primary} — بهدوء وثقة.`
      : `Your Travel DNA leans ${primary} — calm, confident, intentional.`

  return { primary, traits, summary }
}
