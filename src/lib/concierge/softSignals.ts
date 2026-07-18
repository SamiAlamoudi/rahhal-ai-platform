/**
 * Extract soft conversational signals from free text.
 * Consultant memory only — never used for provider selection.
 */

import type { AgentLocale } from '../agent/types'
import { emptySoftSignals, type ConciergeSoftSignals } from './types'
import { mergeSoftSignals } from './dialogueState'

export function extractSoftSignals(
  text: string,
  locale: AgentLocale = 'en',
  previous: ConciergeSoftSignals = emptySoftSignals(),
): ConciergeSoftSignals {
  const normalized = text.trim()
  const lower = normalized.toLowerCase()
  const patch: Partial<ConciergeSoftSignals> = {
    mustHaves: [],
    dealBreakers: [],
    flexibleDimensions: [],
    tradeoffs: [],
    notes: [],
  }

  if (/(?:\brelaxed\b|\bslow\b|هادئ|مريح|على مهل)/i.test(lower) || /على\s*مهل/.test(normalized)) {
    patch.pace = 'relaxed'
  } else if (/(?:\bpacked\b|\bintense\b|\bjam[- ]?packed\b|مكثف|مشغول|حافل)/i.test(lower)) {
    patch.pace = 'packed'
  } else if (/(?:\bbalanced\b|\bmoderate\b|متوازن|معتدل الإيقاع)/i.test(lower)) {
    patch.pace = 'balanced'
  }

  if (/(?:\bmust\b|\bneed\b|\bessential\b|ضروري|لازم|مهم)/i.test(lower)) {
    for (const item of matchListedPreferences(lower, normalized, locale)) {
      patch.mustHaves!.push(item)
    }
  }

  // Common interest-as-must-have cues without explicit "must"
  for (const item of matchInterestCues(lower, normalized)) {
    if (!patch.mustHaves!.includes(item)) patch.mustHaves!.push(item)
  }

  if (/(?:\bavoid\b|\bno\b|\bdon't want\b|\bhate\b|تجنب|لا أريد|ما أبي|أكره)/i.test(lower)
    || /لا\s*أريد/.test(normalized)) {
    for (const item of matchAvoidCues(lower, normalized)) {
      patch.dealBreakers!.push(item)
    }
  }

  if (/(?:\bflexible\b|\bopen\b|\bsurprise\b|مرن|مفاجأة|فاجأني|مفتوح)/i.test(lower)) {
    if (/(?:\bdate|\bwhen|تاريخ|موعد)/i.test(lower)) patch.flexibleDimensions!.push('dates')
    if (/(?:\bhotel|\bstay|فندق|إقامة)/i.test(lower)) patch.flexibleDimensions!.push('hotel')
    if (/(?:\bbudget|ميزانية)/i.test(lower)) patch.flexibleDimensions!.push('budget')
    if (patch.flexibleDimensions!.length === 0) patch.flexibleDimensions!.push('general')
  }

  if (/(?:\brather\b|\binstead\b|\bprefer .+ over|أفضل .+ على|بدل)/i.test(lower)) {
    patch.tradeoffs!.push(locale === 'ar' ? 'مفاضلة مذكورة من المسافر' : 'traveler-stated tradeoff')
  }

  if (/(?:\bshorter stay\b|\bfewer days\b|أقصر|أيام أقل)/i.test(lower)) {
    patch.tradeoffs!.push(locale === 'ar' ? 'مدة أقصر مقابل راحة أعلى' : 'shorter stay vs more comfort')
  }
  if (/(?:\bnicer hotel\b|\bbetter hotel\b|فندق أفضل|أفخم)/i.test(lower)) {
    patch.tradeoffs!.push(locale === 'ar' ? 'فندق أفضل مقابل ميزانية أعلى' : 'nicer hotel vs higher budget')
  }

  return mergeSoftSignals(previous, patch)
}

function matchInterestCues(lower: string, normalized: string): string[] {
  const cues: Array<{ re: RegExp; value: string }> = [
    { re: /\bbeach\b|شاطئ|بحر/, value: 'beach' },
    { re: /\bfood\b|\bculinary\b|طعام|مأكولات|مطاعم/, value: 'food' },
    { re: /\bculture\b|\bmuseum\b|ثقافة|متاحف/, value: 'culture' },
    { re: /\bnature\b|\bhike\b|طبيعة|مشي/, value: 'nature' },
    { re: /\bshopping\b|تسوق/, value: 'shopping' },
    { re: /\badventure\b|مغامرة/, value: 'adventure' },
    { re: /\bnightlife\b|سهر|ليل/, value: 'nightlife' },
    { re: /\bfamily[- ]?friendly\b|عائلي/, value: 'family-friendly' },
  ]
  const out: string[] = []
  for (const cue of cues) {
    if (cue.re.test(lower) || cue.re.test(normalized)) out.push(cue.value)
  }
  return out
}

function matchAvoidCues(lower: string, _normalized: string): string[] {
  const out: string[] = []
  if (/\blayover|توقف|ترانزيت/.test(lower)) out.push('long layovers')
  if (/\bearly flight|رحلة مبكرة/.test(lower)) out.push('early flights')
  if (/\bcrowded|ازدحام|زحمة/.test(lower)) out.push('crowds')
  if (/\bhostel|نزل/.test(lower)) out.push('hostels')
  if (out.length === 0) out.push('stated avoidance')
  return out
}

function matchListedPreferences(
  lower: string,
  normalized: string,
  _locale: AgentLocale,
): string[] {
  // Lightweight capture after must/need — fall back to interest cues.
  const after = lower.split(/\bmust\b|\bneed\b|ضروري|لازم/)[1]
  if (!after) return matchInterestCues(lower, normalized)
  return matchInterestCues(after, after)
}
