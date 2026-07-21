/**
 * Sprint 78 — constraint + preference detection from conversation and memory.
 */

import type { AgentMemory } from '../types'
import type { DetectedConstraint, PlannerPreference } from './types'

const HOTEL_BRANDS = [
  'marriott', 'hilton', 'hyatt', 'ihg', 'accor', 'radisson', 'four seasons',
]
const AIRLINES = [
  'qatar airways', 'qatar', 'emirates', 'saudia', 'etihad', 'turkish',
]

export function detectConstraints(
  userText: string | null | undefined,
  memory?: AgentMemory | null,
): { constraints: DetectedConstraint[]; preferences: PlannerPreference[]; riskFlags: string[] } {
  const text = userText ?? ''
  const lower = text.toLowerCase()
  const constraints: DetectedConstraint[] = []
  const preferences: PlannerPreference[] = []
  const riskFlags: string[] = []
  const req = memory?.requirements

  const push = (c: DetectedConstraint) => {
    if (!constraints.some((x) => x.kind === c.kind && String(x.value) === String(c.value))) {
      constraints.push(c)
    }
  }

  // Budget
  const budgetMatch = lower.match(/(?:budget|ميزانية).*?(?:sar|usd|\$|ريال)?\s*([\d,]+)/i)
    ?? lower.match(/(?:sar|usd|\$)\s*([\d,]+)/i)
  if (req?.budgetAmount != null) {
    push({
      kind: 'budget',
      value: req.budgetAmount,
      required: true,
      note: req.budgetCurrency ?? 'SAR',
    })
  } else if (budgetMatch) {
    push({
      kind: 'budget',
      value: Number(budgetMatch[1]!.replace(/,/g, '')),
      required: true,
      note: /usd|\$/.test(lower) ? 'USD' : 'SAR',
    })
  }

  // Visa
  if (/\balready\s+have\s+(?:a\s+)?visa\b|لدي\s*تأشيرة|عندي\s*فيزا/.test(lower)) {
    push({ kind: 'visa', value: 'already_have', required: false, note: 'traveler has visa' })
    riskFlags.push('visa_satisfied')
  } else if (/\bneed\s+(?:a\s+)?visa\b|\bno\s+visa\b|أحتاج\s*تأشيرة/.test(lower)) {
    push({ kind: 'visa', value: 'needed', required: true })
    riskFlags.push('visa_check_required')
  }

  // Dates / duration
  if (req?.startDate || req?.endDate || req?.durationDays) {
    push({
      kind: 'dates',
      value: req.startDate ?? req.durationDays ?? true,
      required: true,
      note: req.endDate ? `${req.startDate ?? '?'}→${req.endDate}` : undefined,
    })
  } else if (/\bnext\s+month\b|\bnext\s+week\b|\bin\s+\w+\b|الشهر\s*القادم|الأسبوع\s*القادم/.test(lower)) {
    push({ kind: 'dates', value: 'flexible_window', required: false, note: 'relative date cue' })
  }

  // Origin / destination / airport
  if (req?.origin) push({ kind: 'origin', value: req.origin, required: true })
  if (req?.destination || (req?.destinations?.length ?? 0) > 0) {
    push({
      kind: 'destination',
      value: req?.destination ?? req?.destinations?.[0] ?? null,
      required: true,
    })
  }
  const airport = lower.match(/(?:from|depart(?:ing)?\s+from|airport)\s+([a-z]{3,20})/)
  if (airport?.[1]) push({ kind: 'airport', value: airport[1], required: false })

  // Airline prefs
  for (const airline of AIRLINES) {
    if (lower.includes(airline)) {
      const avoid = /\bdon'?t\s+care\s+about\s+airlines\b|\bany\s+airline\b|لا\s*يهم\s*الخطوط/.test(lower)
      if (avoid) {
        preferences.push({ kind: 'airline', value: 'any', polarity: 'neutral' })
        break
      }
      const polarity = /\bavoid\b|\bnever\b|أتجنب/.test(lower) ? 'avoid' : 'prefer'
      preferences.push({ kind: 'airline', value: airline, polarity })
      push({ kind: 'airline', value: airline, required: false })
    }
  }
  if (/\bdon'?t\s+care\s+about\s+airlines\b|\bany\s+airline\b|لا\s*يهم(?:ني)?\s*(?:ال)?خطوط/.test(lower)) {
    preferences.push({ kind: 'airline', value: 'any', polarity: 'neutral' })
  }

  // Hotel brand
  for (const brand of HOTEL_BRANDS) {
    if (lower.includes(brand)) {
      preferences.push({ kind: 'hotel_brand', value: brand, polarity: 'prefer' })
      push({ kind: 'hotel_brand', value: brand, required: true, note: 'brand lock' })
    }
  }
  if (/\bonly\s+stay\s+at\b|\bonly\s+book\b/.test(lower) && preferences.some((p) => p.kind === 'hotel_brand')) {
    riskFlags.push('hotel_brand_locked')
  }

  // Children / family
  const kids = lower.match(/(\d+)\s*(?:children|kids|kids|أطفال)/)
    ?? (/\btwo\s+children\b|طفلين|طفلان/.test(lower) ? ['', '2'] : null)
  if (kids) {
    push({ kind: 'children', value: Number(kids[1]), required: true })
  } else if (/\bchildren\b|\bkids\b|أطفال/.test(lower)) {
    push({ kind: 'children', value: true, required: true })
  }

  // Senior / medical / accessibility
  if (/\bsenior\b|\belderly\b|كبار\s*السن/.test(lower)) {
    push({ kind: 'senior_travelers', value: true, required: true })
    riskFlags.push('senior_travel')
  }
  if (/\bmedical\b|\bwheelchair\b|\baccessibility\b|\baccessible\b|كرسي\s*متحرك|إعاقة|احتياجات\s*خاصة/.test(lower)) {
    if (/\bmedical\b|علاج/.test(lower)) push({ kind: 'medical_needs', value: true, required: true })
    if (/\bwheelchair\b|\baccessib|\bإعاقة|كرسي/.test(lower)) {
      push({ kind: 'accessibility', value: true, required: true })
      riskFlags.push('accessibility_required')
    }
  }

  // Direct / layover
  if (/\bdirect\s+flights?\b|\bnon[- ]?stop\b|رحلة\s*مباشرة|مباشر/.test(lower)) {
    push({ kind: 'direct_flight', value: true, required: true })
  }
  const layover = lower.match(/(?:max(?:imum)?|no\s+more\s+than)\s+(\d+)\s*(?:h(?:ours?)?|hours?)\s+layover/)
  if (layover) {
    push({ kind: 'layover_limit', value: Number(layover[1]), required: true })
  }

  // Meeting / check-in time
  const meeting = lower.match(/(?:arrive|arrival|be\s+there)\s+before\s+(\d{1,2})\s*(?:am|a\.m\.|:00)?/i)
    ?? lower.match(/before\s+(\d{1,2})\s*am/)
  if (meeting) {
    push({ kind: 'meeting_time', value: Number(meeting[1]), required: true, note: 'arrive before' })
    riskFlags.push('hard_arrival_deadline')
  }
  if (/\bearly\s+meeting\b|اجتماع\s*مبكر/.test(lower)) {
    push({ kind: 'meeting_time', value: 8, required: true, note: 'early meeting' })
    riskFlags.push('hard_arrival_deadline')
  }
  if (/\bcheck[- ]?in\b.*(\d{1,2})/.test(lower)) {
    const m = lower.match(/check[- ]?in(?:\s+at|\s+before)?\s+(\d{1,2})/)
    if (m) push({ kind: 'check_in_time', value: Number(m[1]), required: false })
  }

  // Weather
  if (/\bcold\b|\bwarm\b|\bsunny\b|\bsnow\b|برد|حار|مشمس/.test(lower) || req?.weatherPreference) {
    push({
      kind: 'weather',
      value: req?.weatherPreference ?? 'stated',
      required: false,
    })
  }

  return { constraints, preferences, riskFlags: [...new Set(riskFlags)] }
}
