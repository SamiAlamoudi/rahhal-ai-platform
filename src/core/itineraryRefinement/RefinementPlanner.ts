/**
 * Sprint 84 — detect conversation changes → impacted package components.
 */

import type { PackageComponentKind } from '../packageBuilder/PackageCandidate'

export type RefinementChangeKind =
  | 'budget_change'
  | 'extra_day'
  | 'extra_traveler'
  | 'child_traveler'
  | 'luxury_upgrade'
  | 'economy_downgrade'
  | 'activity_add'
  | 'activity_remove'
  | 'weather_change'
  | 'flight_change'
  | 'hotel_replacement'
  | 'meeting_insertion'
  | 'late_arrival'
  | 'early_departure'
  | 'restaurant_replacement'
  | 'accessibility'
  | 'no_early_flights'
  | 'halal_food'
  | 'transfer_optimization'
  | 'generic'

export interface RefinementPlan {
  changes: RefinementChangeKind[]
  impactedKinds: PackageComponentKind[]
  hardHints: string[]
  softHints: string[]
  reuseEverythingElse: boolean
}

const KIND_IMPACT: Record<RefinementChangeKind, PackageComponentKind[]> = {
  budget_change: ['flight', 'hotel', 'activity', 'transfer'],
  extra_day: ['hotel', 'activity'],
  extra_traveler: ['flight', 'hotel'],
  child_traveler: ['hotel', 'activity', 'flight'],
  luxury_upgrade: ['hotel', 'flight'],
  economy_downgrade: ['flight', 'hotel'],
  activity_add: ['activity'],
  activity_remove: ['activity'],
  weather_change: ['activity'],
  flight_change: ['flight', 'transfer'],
  hotel_replacement: ['hotel', 'transfer'],
  meeting_insertion: ['activity', 'transfer'],
  late_arrival: ['flight', 'transfer', 'hotel', 'activity'],
  early_departure: ['flight', 'activity', 'transfer'],
  restaurant_replacement: ['activity'],
  accessibility: ['hotel', 'transfer', 'flight'],
  no_early_flights: ['flight'],
  halal_food: ['activity'],
  transfer_optimization: ['transfer'],
  generic: ['flight', 'hotel'],
}

export function detectRefinementChanges(userText: string | null | undefined): RefinementChangeKind[] {
  if (!userText?.trim()) return []
  const t = userText.toLowerCase()
  const changes: RefinementChangeKind[] = []

  if (/\bbudget\b|\bincreased?\s+budget\b|\bcan\s+spend\b|ميزانية/.test(t)) {
    changes.push('budget_change')
  }
  if (/\bone\s+more\s+day\b|\bextra\s+day\b|\bextend\b|\banother\s+night\b|يوم\s*إضافي/.test(t)) {
    changes.push('extra_day')
  }
  if (/\bextra\s+traveler\b|\banother\s+(?:person|adult|guest)\b|\bone\s+more\s+(?:person|adult)\b/.test(t)) {
    changes.push('extra_traveler')
  }
  if (/\bchild(?:ren)?\b|\bkids?\b|\bfamily\b|أطفال|عائلة/.test(t)) {
    changes.push('child_traveler')
  }
  if (/\bluxury\b|\bwife\s+prefers\s+luxury\b|\bupgrade\b|فاخر/.test(t)) {
    changes.push('luxury_upgrade')
  }
  if (/\beconomy\b|\bcheaper\b|\bdowngrade\b|\bsave\s+money\b|أرخص/.test(t)) {
    changes.push('economy_downgrade')
  }
  if (/\bremove\s+(?:the\s+)?activity\b|\bcancel\s+(?:the\s+)?tour\b|\bdon'?t\s+want\s+.*(?:museum|beach|tour)/.test(t)) {
    changes.push('activity_remove')
  }
  if (/\badd\s+(?:an?\s+)?activity\b|\binclude\s+(?:a\s+)?(?:museum|beach|tour)\b|\bwant\s+to\s+visit\b/.test(t)) {
    changes.push('activity_add')
  }
  if (/\bweather\b|\brain\b|\bhot\b|\bcold\b|طقس/.test(t)) {
    changes.push('weather_change')
  }
  if (/\bchange\s+(?:the\s+)?flight\b|\bdifferent\s+flight\b|\bearlier\s+flight\b|\blater\s+flight\b/.test(t)) {
    changes.push('flight_change')
  }
  if (/\bdon'?t\s+want\s+early\s+flights?\b|\bno\s+early\s+flights?\b|\bnot\s+early\b/.test(t)) {
    changes.push('no_early_flights')
  }
  if (/\bchange\s+(?:the\s+)?hotel\b|\banother\s+hotel\b|\breplace\s+(?:the\s+)?hotel\b/.test(t)) {
    changes.push('hotel_replacement')
  }
  if (/\bmeeting\b|\bconference\b|\bbusiness\s+call\b/.test(t)) {
    changes.push('meeting_insertion')
  }
  if (/\blate\s+arrival\b|\barrive\s+late\b|\bland\s+late\b/.test(t)) {
    changes.push('late_arrival')
  }
  if (/\bearly\s+departure\b|\bleave\s+early\b|\bdepart\s+early\b/.test(t)) {
    changes.push('early_departure')
  }
  if (/\brestaurant\b|\bhalal\b|حلال|طعام/.test(t)) {
    if (/\bhalal\b|حلال/.test(t)) changes.push('halal_food')
    else changes.push('restaurant_replacement')
  }
  if (/\bwheelchair\b|\baccessibility\b|\baccessible\b|كرسي\s*متحرك/.test(t)) {
    changes.push('accessibility')
  }
  if (/\btransfer\b|\bairport\s+pickup\b|\bshuttle\b/.test(t)) {
    changes.push('transfer_optimization')
  }

  if (changes.length === 0 && t.length > 8) changes.push('generic')
  return [...new Set(changes)]
}

export function planRefinement(input: {
  userText?: string | null
  changes?: RefinementChangeKind[]
}): RefinementPlan {
  const changes = input.changes?.length
    ? [...new Set(input.changes)]
    : detectRefinementChanges(input.userText)

  const impacted = new Set<PackageComponentKind>()
  for (const change of changes) {
    for (const kind of KIND_IMPACT[change] ?? []) impacted.add(kind)
  }

  const hardHints: string[] = []
  const softHints: string[] = []
  if (changes.includes('budget_change')) hardHints.push('budget')
  if (changes.includes('child_traveler')) hardHints.push('children')
  if (changes.includes('accessibility')) hardHints.push('accessibility', 'wheelchair')
  if (changes.includes('meeting_insertion')) hardHints.push('meeting_schedule')
  if (changes.includes('luxury_upgrade')) softHints.push('luxury')
  if (changes.includes('halal_food')) softHints.push('food')
  if (changes.includes('no_early_flights')) softHints.push('seat_preference')

  return {
    changes,
    impactedKinds: [...impacted],
    hardHints,
    softHints,
    reuseEverythingElse: true,
  }
}
