/**
 * Soft travel-style / food / activity signals from free text + requirements.
 */

const STYLE_HINTS: Array<{ match: RegExp; style: string }> = [
  { match: /بحر|شاطئ|beach|relax|استرخاء|هدوء|quiet/i, style: 'Beach' },
  { match: /ثقاف|culture|souk|سوق|أسواق|heritage|متحف|museum|walking/i, style: 'Culture' },
  { match: /مغامر|adventure|hiking|trek|طبيعة|nature/i, style: 'Adventure' },
  { match: /عائلت|family|أطفال|kids/i, style: 'Family' },
  { match: /فاخر|luxury|honeymoon|شهر\s*عسل|romantic|رومانسي/i, style: 'Luxury' },
  { match: /طعام|food|culinary|gourmet/i, style: 'Food' },
]

const FOOD_HINTS = /طعام|food|مطعم|restaurant|culinary|gourmet|أكل|سوق|souk/i
const ACTIVITY_HINTS: Array<{ match: RegExp; label: string }> = [
  { match: /شاطئ|beach|سباح/i, label: 'beach' },
  { match: /ثقاف|culture|souk|سوق|أسواق/i, label: 'culture' },
  { match: /مشي|walking/i, label: 'walking_tours' },
  { match: /مغامر|adventure|hiking/i, label: 'adventure' },
  { match: /تسوق|shopping/i, label: 'shopping' },
  { match: /ليل|nightlife/i, label: 'nightlife' },
  { match: /شهر\s*عسل|honeymoon|romantic/i, label: 'special_experiences' },
]

export function inferTravelStyle(
  userText: string,
  interests: string[],
  weatherPreference: string | null,
  budgetStyle: string | null,
): string | null {
  const blob = `${userText} ${interests.join(' ')} ${weatherPreference ?? ''} ${budgetStyle ?? ''}`
  for (const hint of STYLE_HINTS) {
    if (hint.match.test(blob)) return hint.style
  }
  if (interests.length > 0) return interests[0]!
  return null
}

export function inferFoodPreferences(userText: string, interests: string[]): string[] {
  const found: string[] = []
  if (FOOD_HINTS.test(userText) || interests.some((i) => FOOD_HINTS.test(i))) {
    found.push('local_cuisine')
  }
  return found
}

export function inferActivities(userText: string, interests: string[]): string[] {
  const found: string[] = []
  const blob = `${userText} ${interests.join(' ')}`
  for (const hint of ACTIVITY_HINTS) {
    if (hint.match.test(blob) && !found.includes(hint.label)) found.push(hint.label)
  }
  for (const interest of interests) {
    const key = interest.trim().toLowerCase()
    if (key && !found.includes(key)) found.push(key)
  }
  return found
}
