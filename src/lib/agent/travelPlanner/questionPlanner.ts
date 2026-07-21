/**
 * Sprint 78 — ask only when required; combine missing items into one question.
 */

import type { AgentMemory } from '../types'
import type { DetectedConstraint } from './types'

const FIELD_PROMPTS: Record<string, { en: string; ar: string }> = {
  destination: {
    en: 'where you want to go',
    ar: 'إلى أين تريد السفر',
  },
  origin: {
    en: 'your departure city',
    ar: 'مدينة المغادرة',
  },
  dates: {
    en: 'what dates you will travel',
    ar: 'تواريخ السفر',
  },
  travelers: {
    en: 'how many people are joining you',
    ar: 'عدد المسافرين',
  },
  budget: {
    en: 'your approximate budget',
    ar: 'ميزانيتك التقريبية',
  },
  children: {
    en: 'ages of the children',
    ar: 'أعمار الأطفال',
  },
  meeting_time: {
    en: 'the latest arrival time you need',
    ar: 'أحدث وقت وصول تحتاجه',
  },
}

export function detectMissingInformation(input: {
  memory?: AgentMemory | null
  constraints: DetectedConstraint[]
  userText?: string | null
}): string[] {
  const missing: string[] = []
  const req = input.memory?.requirements
  const hasConstraint = (kind: DetectedConstraint['kind']) =>
    input.constraints.some((c) => c.kind === kind && c.value != null && c.value !== false)

  const hasDestination = Boolean(req?.destination || (req?.destinations?.length ?? 0) > 0)
    || hasConstraint('destination')
  const hasDates = Boolean(req?.startDate || req?.endDate || req?.durationDays)
    || hasConstraint('dates')
  const hasTravelers = req?.travelers != null || req?.travelerType != null
  const hasBudget = req?.budgetAmount != null || req?.budgetFlexible === true || hasConstraint('budget')

  if (!hasDestination) missing.push('destination')
  if (!hasDates) missing.push('dates')
  if (!hasTravelers) missing.push('travelers')
  // Budget is helpful but not always blocking — only mark missing when trip is otherwise ready
  if (!hasBudget && hasDestination && hasDates) missing.push('budget')

  // Origin is optional enrichment (not an intake blocker).
  const hasOrigin = Boolean(req?.origin) || hasConstraint('origin') || hasConstraint('airport')
  if (!hasOrigin && hasDestination && hasDates && hasTravelers && missing.length === 0) {
    // do not block — omit from missing unless we want soft question later
  }

  if (hasConstraint('children') && !/\bage|\byears?\s+old|عمر/.test((input.userText ?? '').toLowerCase())) {
    // ages optional enrichment — only if children mentioned without ages and other criticals filled
    if (missing.length === 0) missing.push('children')
  }

  return missing
}

export function planRequiredQuestions(input: {
  missingInformation: string[]
  locale?: 'ar' | 'en'
}): { requiredQuestions: string[]; combinedQuestion: string | null } {
  const locale = input.locale ?? 'en'
  const requiredQuestions = input.missingInformation.map((field) => {
    const prompt = FIELD_PROMPTS[field]
    if (!prompt) return locale === 'ar' ? `هل يمكنك توضيح ${field}؟` : `Could you clarify ${field}?`
    return locale === 'ar'
      ? `ما ${prompt.ar}؟`
      : `What is ${prompt.en}?`
  })

  if (requiredQuestions.length === 0) {
    return { requiredQuestions: [], combinedQuestion: null }
  }
  if (requiredQuestions.length === 1) {
    return { requiredQuestions, combinedQuestion: requiredQuestions[0]! }
  }

  const prompts = input.missingInformation
    .map((field) => FIELD_PROMPTS[field]?.[locale === 'ar' ? 'ar' : 'en'] ?? field)
  const combinedQuestion = locale === 'ar'
    ? `هل يمكنك توضيح ${prompts.join(' و')}؟`
    : `What ${joinNatural(prompts)}?`

  return { requiredQuestions, combinedQuestion }
}

function joinNatural(parts: string[]): string {
  if (parts.length === 1) return parts[0]!
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`
}
