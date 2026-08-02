import type { UserPreferenceProfile } from '../../brain/preferences/types'
import type { TravelDraft } from '../../brain/travel/types'
import type { ConciergeMemoryFact } from '../types'

export type ExtendedMemoryHints = {
  cabinClass?: string
  foodPreferences: string[]
  familyMembers: string[]
  previousTrips: string[]
  favoriteDestinations: string[]
}

const emptyHints = (): ExtendedMemoryHints => ({
  foodPreferences: [],
  familyMembers: [],
  previousTrips: [],
  favoriteDestinations: [],
})

/** Infer soft memory hints from free text (AR/EN) — no backend. */
export function inferMemoryHints(text: string, prior: ExtendedMemoryHints = emptyHints()): ExtendedMemoryHints {
  const next = {
    ...prior,
    foodPreferences: [...prior.foodPreferences],
    familyMembers: [...prior.familyMembers],
    previousTrips: [...prior.previousTrips],
    favoriteDestinations: [...prior.favoriteDestinations],
  }
  const lower = text.toLowerCase()

  if (/\bfirst class\b|درجة أولى|فيرست/.test(lower) || /درجة أولى/.test(text)) next.cabinClass = 'first'
  else if (/\bbusiness\b|رجال أعمال|بزنس/.test(lower) || /رجال أعمال/.test(text)) next.cabinClass = 'business'
  else if (/\beconomy\b|سياحية|اقتصادي/.test(lower)) next.cabinClass = 'economy'
  else if (/\bpremium economy\b/.test(lower)) next.cabinClass = 'premium_economy'

  if (/halal|حلال/.test(lower) || /حلال/.test(text)) pushUnique(next.foodPreferences, 'halal')
  if (/vegetarian|نباتي/.test(lower) || /نباتي/.test(text)) pushUnique(next.foodPreferences, 'vegetarian')
  if (/seafood|مأكولات بحرية/.test(lower) || /بحرية/.test(text)) pushUnique(next.foodPreferences, 'seafood')

  const family = text.match(/(?:with|مع)\s+(\d+)\s*(?:kids?|children|أطفال|طفل)/i)
  if (family?.[1]) pushUnique(next.familyMembers, `${family[1]} children`)
  if (/\bspouse\b|زوج|زوجة|عائل/.test(lower) || /زوج|عائلة/.test(text)) {
    pushUnique(next.familyMembers, 'partner / family')
  }

  if (/last year|العام الماضي|زيارتنا السابقة|previously visited/i.test(text)) {
    pushUnique(next.previousTrips, 'prior visit mentioned')
  }

  for (const city of ['Istanbul', 'Dubai', 'Cairo', 'London', 'Tokyo', 'Paris', 'إسطنبول', 'دبي', 'القاهرة', 'لندن']) {
    if (text.includes(city) || lower.includes(city.toLowerCase())) {
      const normalized =
        city === 'إسطنبول'
          ? 'Istanbul'
          : city === 'دبي'
            ? 'Dubai'
            : city === 'القاهرة'
              ? 'Cairo'
              : city === 'لندن'
                ? 'London'
                : city
      pushUnique(next.favoriteDestinations, normalized)
    }
  }

  return next
}

export function buildMemoryFacts(
  prefs: UserPreferenceProfile,
  draft: TravelDraft,
  hints: ExtendedMemoryHints,
  locale: 'ar' | 'en' = 'en',
): ConciergeMemoryFact[] {
  const facts: ConciergeMemoryFact[] = []
  const ar = locale === 'ar'

  for (const airline of prefs.favoriteAirlines) {
    facts.push({
      id: `mem-airline-${airline}`,
      kind: 'airline',
      label: ar ? 'شركة مفضّلة' : 'Preferred airline',
      value: airline,
      naturalLine: ar
        ? `أتذكر تفضيلك لـ ${airline}.`
        : `I remember you prefer flying ${airline}.`,
    })
  }
  for (const hotel of prefs.favoriteHotels) {
    facts.push({
      id: `mem-hotel-${hotel}`,
      kind: 'hotel',
      label: ar ? 'فندق مفضّل' : 'Preferred hotel',
      value: hotel,
      naturalLine: ar
        ? `أسلوب إقامتك يشبه إقاماتك في ${hotel}.`
        : `Your stays often echo the calm of ${hotel}.`,
    })
  }
  if (hints.cabinClass) {
    facts.push({
      id: 'mem-cabin',
      kind: 'cabin',
      label: ar ? 'درجة السفر' : 'Cabin class',
      value: hints.cabinClass,
      naturalLine: ar
        ? `سأبحث ضمن درجة ${hints.cabinClass}.`
        : `I’ll keep ${hints.cabinClass} cabin in mind.`,
    })
  }
  if (prefs.travelStyle !== 'unknown') {
    facts.push({
      id: 'mem-style',
      kind: 'travel_style',
      label: ar ? 'أسلوب السفر' : 'Travel style',
      value: prefs.travelStyle,
      naturalLine: ar
        ? `أسلوبك يميل إلى ${prefs.travelStyle}.`
        : `Your travel style reads as ${prefs.travelStyle}.`,
    })
  }
  for (const food of hints.foodPreferences) {
    facts.push({
      id: `mem-food-${food}`,
      kind: 'food',
      label: ar ? 'تفضيل طعام' : 'Food preference',
      value: food,
      naturalLine: ar ? `سأراعي تفضيل ${food}.` : `I’ll honour your ${food} preference.`,
    })
  }
  if (draft.budgetAmount) {
    facts.push({
      id: 'mem-budget',
      kind: 'budget',
      label: ar ? 'الميزانية' : 'Budget',
      value: `${draft.budgetAmount} ${draft.currency ?? 'SAR'}`,
      naturalLine: ar
        ? `نتحرك ضمن ميزانية ${draft.budgetAmount} ${draft.currency ?? 'ر.س'}.`
        : `We’re planning within ${draft.budgetAmount} ${draft.currency ?? 'SAR'}.`,
    })
  } else if (prefs.budgetLevel !== 'unknown') {
    facts.push({
      id: 'mem-budget-level',
      kind: 'budget',
      label: ar ? 'مستوى الميزانية' : 'Budget level',
      value: prefs.budgetLevel,
      naturalLine: ar
        ? `مستوى ميزانيتك ${prefs.budgetLevel}.`
        : `Your budget level feels ${prefs.budgetLevel}.`,
    })
  }
  const destinations = [
    ...(draft.destination ? [draft.destination] : []),
    ...hints.favoriteDestinations,
  ]
  for (const dest of [...new Set(destinations)].slice(0, 4)) {
    facts.push({
      id: `mem-dest-${dest}`,
      kind: 'destination',
      label: ar ? 'وجهة مفضّلة' : 'Favorite destination',
      value: dest,
      naturalLine: ar ? `${dest} ضمن ذائقتك.` : `${dest} sits warmly in your taste.`,
    })
  }
  for (const member of hints.familyMembers) {
    facts.push({
      id: `mem-family-${member}`,
      kind: 'family',
      label: ar ? 'العائلة' : 'Family',
      value: member,
      naturalLine: ar
        ? `أخطّط مع مراعاة ${member}.`
        : `I’ll plan with ${member} in mind.`,
    })
  }
  for (const trip of hints.previousTrips) {
    facts.push({
      id: `mem-trip-${trip}`,
      kind: 'previous_trip',
      label: ar ? 'رحلة سابقة' : 'Previous trip',
      value: trip,
      naturalLine: ar
        ? 'سأبني على ما نجح في رحلاتك السابقة.'
        : 'I’ll build on what worked in your previous trips.',
    })
  }
  return facts
}

export function narrateMemory(facts: ConciergeMemoryFact[], locale: 'ar' | 'en'): string {
  if (facts.length === 0) {
    return locale === 'ar'
      ? 'أنا أتعلّم ذوقك بهدوء — أخبرني بما يهمك.'
      : 'I’m learning your taste quietly — tell me what matters.'
  }
  const lines = facts.slice(0, 3).map((f) => f.naturalLine)
  return lines.join(' ')
}

function pushUnique(list: string[], value: string) {
  if (!list.some((x) => x.toLowerCase() === value.toLowerCase())) list.push(value)
}
