/**
 * Sprint 80 — preference inference from conversation + structured cues.
 */

import type { LearningSource, PreferenceEntry, PreferenceKind, PreferencePolarity } from '../profile/TravelerProfile'

export interface InferredPreferenceSignal {
  kind: PreferenceKind
  value: string
  polarity: PreferencePolarity
  source: LearningSource
}

const AIRLINES = [
  'emirates', 'qatar airways', 'qatar', 'saudia', 'etihad', 'turkish', 'lufthansa',
]
const HOTELS = ['marriott', 'hilton', 'hyatt', 'ihg', 'four seasons', 'accor']

export function inferPreferencesFromText(text: string | null | undefined): InferredPreferenceSignal[] {
  if (!text?.trim()) return []
  const lower = text.toLowerCase()
  const signals: InferredPreferenceSignal[] = []
  const avoid = /\bavoid\b|\bdon'?t\s+like\b|\bnever\b|أتجنب|لا\s*أحب/.test(lower)
  const polarity: PreferencePolarity = avoid ? 'avoid' : 'prefer'
  const source: LearningSource = /\balways\b|\busually\b|\bprefer\b|دائم|عادة|أفضل/.test(lower)
    ? 'explicit'
    : 'implicit'

  for (const airline of AIRLINES) {
    if (lower.includes(airline)) {
      signals.push({
        kind: 'airline',
        value: airline === 'qatar' ? 'qatar airways' : airline,
        polarity: /\bdon'?t\s+care\s+about\s+airlines\b/.test(lower) ? 'neutral' : polarity,
        source,
      })
    }
  }
  for (const hotel of HOTELS) {
    if (lower.includes(hotel)) {
      signals.push({ kind: 'hotel_brand', value: hotel, polarity, source })
    }
  }
  if (/\baisle\s+seats?\b/.test(lower)) signals.push({ kind: 'seat', value: 'aisle', polarity: 'prefer', source })
  if (/\bwindow\s+seats?\b/.test(lower)) signals.push({ kind: 'seat', value: 'window', polarity: 'prefer', source })
  if (/\bbusiness\s+class\b/.test(lower)) signals.push({ kind: 'cabin', value: 'business', polarity: 'prefer', source })
  if (/\beconomy\b/.test(lower) && /\bonly\b|\bprefer\b/.test(lower)) {
    signals.push({ kind: 'cabin', value: 'economy', polarity: 'prefer', source })
  }
  if (/\bking\s+beds?\b/.test(lower)) signals.push({ kind: 'room_type', value: 'king', polarity: 'prefer', source })
  if (/\bdirect\s+flights?\b|\bnon[- ]?stop\b/.test(lower)) {
    signals.push({ kind: 'transfer_tolerance', value: 'direct', polarity: 'prefer', source })
  }
  if (/\bcity\s+center\b|\bwalk(?:ing)?\s+distance\b|\bminimum\s+walking\b/.test(lower)) {
    signals.push({ kind: 'walkability', value: 'high', polarity: 'prefer', source })
  }
  if (/\bluxury\b|فاخر/.test(lower)) {
    signals.push({ kind: 'luxury_vs_value', value: 'luxury', polarity: avoid ? 'avoid' : 'prefer', source })
    signals.push({ kind: 'hotel_budget_style', value: 'luxury', polarity: avoid ? 'avoid' : 'prefer', source })
  }
  if (/\bvalue\b|\bbudget\b|\bcheap\b|أرخص/.test(lower) && !/\bluxury\b/.test(lower)) {
    signals.push({ kind: 'luxury_vs_value', value: 'value', polarity: 'prefer', source })
    signals.push({ kind: 'hotel_budget_style', value: 'value', polarity: 'prefer', source })
  }
  if (/\bfamily\b|أطفال|عائلة/.test(lower)) {
    signals.push({ kind: 'family_pattern', value: 'family', polarity: 'prefer', source })
  }
  if (/\bsolo\b|وحدي/.test(lower)) {
    signals.push({ kind: 'solo_pattern', value: 'solo', polarity: 'prefer', source })
  }
  if (/\bhalal\b|حلال/.test(lower)) signals.push({ kind: 'food', value: 'halal', polarity: 'prefer', source })
  if (/\bmuseum\b|\bbeach\b|\bhiking\b|شاطئ|متحف/.test(lower)) {
    const activity = lower.includes('beach') || lower.includes('شاطئ')
      ? 'beach'
      : lower.includes('hiking')
        ? 'hiking'
        : 'museum'
    signals.push({ kind: 'activity', value: activity, polarity: 'prefer', source })
  }
  if (/\brelaxed\s+pace\b|\bslow\s+travel\b/.test(lower)) {
    signals.push({ kind: 'travel_pace', value: 'relaxed', polarity: 'prefer', source })
  }
  if (/\bfast\s+paced\b|\bpacked\s+itinerary\b/.test(lower)) {
    signals.push({ kind: 'travel_pace', value: 'packed', polarity: 'prefer', source })
  }

  const morning = /\bmorning\s+(?:flight|departure)\b|\bdepart\s+early\b/.test(lower)
  if (morning) signals.push({ kind: 'departure_time', value: 'morning', polarity: 'prefer', source })
  if (/\bevening\s+arrival\b|\barrive\s+evening\b/.test(lower)) {
    signals.push({ kind: 'arrival_time', value: 'evening', polarity: 'prefer', source })
  }

  // Deduplicate
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = `${s.kind}:${s.value}:${s.polarity}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function preferenceKey(entry: Pick<PreferenceEntry, 'kind' | 'value'>): string {
  return `${entry.kind}:${entry.value.toLowerCase()}`
}
