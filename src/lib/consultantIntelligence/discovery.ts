/**
 * Natural preference extraction — understand the traveler, not fill a form.
 */

import type { DiscoveryInference } from './types'

const STYLE_CUES: Array<{ match: RegExp; style: string; mustHave?: string; activities?: string[] }> = [
  {
    match: /بحر|شاطئ|beach|relax|استرخاء|هدوء|quiet/i,
    style: 'Beach',
    mustHave: 'beach',
    activities: ['beach'],
  },
  {
    match: /أسواق|اسواق|سوق|souk|bazaar|heritage|ثقاف|culture|متحف|museum|walking\s*tour/i,
    style: 'Culture',
    mustHave: 'culture',
    activities: ['culture', 'walking_tours'],
  },
  {
    match: /مغامر|adventure|hiking|trek|طبيعة|nature/i,
    style: 'Adventure',
    mustHave: 'adventure',
    activities: ['adventure'],
  },
  {
    match: /عائلت|family|أطفال|kids|طفل/i,
    style: 'Family',
    mustHave: 'family-friendly',
  },
  {
    match: /شهر\s*عسل|honeymoon|romantic|رومانسي/i,
    style: 'Luxury',
    mustHave: 'romantic',
    activities: ['special_experiences'],
  },
  {
    match: /فاخر|luxury|premium/i,
    style: 'Luxury',
    mustHave: 'luxury',
  },
  {
    match: /طعام|food|culinary|gourmet|أكل/i,
    style: 'Food',
    mustHave: 'food',
    activities: ['local_food'],
  },
]

const AVOID_CUES: Array<{ match: RegExp; dealBreakers: string[]; notes: string[] }> = [
  {
    match: /أكره\s*الزحام|ازدحام|زحمة|crowded|crowds|busy\s*cities|peak\s*season/i,
    dealBreakers: ['crowds', 'peak_season_crowds', 'noisy_hotels'],
    notes: ['prefer_quiet_hotels', 'avoid_peak_crowds'],
  },
  {
    match: /لا\s*أريد\s*حفل|no\s*nightlife|بدون\s*سهر/i,
    dealBreakers: ['nightlife'],
    notes: ['quiet_evenings'],
  },
]

const PURPOSE_CUES: Array<{ match: RegExp; purpose: string }> = [
  { match: /شهر\s*عسل|honeymoon/i, purpose: 'honeymoon' },
  { match: /عمل|business|مؤتمر/i, purpose: 'business' },
  { match: /عائلت|family/i, purpose: 'family' },
]

export function inferDiscoveryFromText(userText: string): DiscoveryInference {
  const out: DiscoveryInference = {
    mustHaves: [],
    dealBreakers: [],
    notes: [],
    travelStyle: null,
    tripPurpose: null,
    activities: [],
    foodPreferences: [],
  }

  for (const cue of STYLE_CUES) {
    if (!cue.match.test(userText)) continue
    if (!out.travelStyle) out.travelStyle = cue.style
    if (cue.mustHave && !out.mustHaves.includes(cue.mustHave)) out.mustHaves.push(cue.mustHave)
    for (const act of cue.activities ?? []) {
      if (!out.activities.includes(act)) out.activities.push(act)
    }
  }

  for (const cue of AVOID_CUES) {
    if (!cue.match.test(userText)) continue
    for (const row of cue.dealBreakers) {
      if (!out.dealBreakers.includes(row)) out.dealBreakers.push(row)
    }
    for (const note of cue.notes) {
      if (!out.notes.includes(note)) out.notes.push(note)
    }
  }

  for (const cue of PURPOSE_CUES) {
    if (cue.match.test(userText)) {
      out.tripPurpose = cue.purpose
      break
    }
  }

  if (/شهر\s*عسل|honeymoon/i.test(userText)) {
    for (const extra of ['privacy', 'luxury', 'special_experiences']) {
      if (!out.mustHaves.includes(extra)) out.mustHaves.push(extra)
    }
  }

  if (/أسواق|سوق|souk|طعام|food|local/i.test(userText)) {
    if (!out.foodPreferences.includes('local_cuisine')) out.foodPreferences.push('local_cuisine')
  }

  return out
}
