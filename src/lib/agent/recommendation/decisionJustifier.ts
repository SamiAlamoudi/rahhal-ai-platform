/**
 * Evolution Sprint 6 — DecisionJustifier + ConfidenceExplainer
 */

import { clamp01, type RecommendationAction, type RecommendationCandidate } from './recommendationTypes'

export function justifyDecision(options: {
  primary: RecommendationCandidate | null
  action: RecommendationAction
  why: string[]
  confidence: number
}): string[] {
  const lines: string[] = []
  if (options.action === 'collect_information') {
    lines.push('Justification: confidence is too low to lock a path — gather missing facts first.')
  } else if (options.action === 'compare') {
    lines.push('Justification: peer options are close — present a comparison rather than a forced pick.')
  } else if (options.action === 'challenge_assumption') {
    lines.push('Justification: stated assumptions conflict with constraints — challenge before committing.')
  } else if (options.action === 'defer') {
    lines.push('Justification: insufficient candidate substance to recommend.')
  } else if (options.primary) {
    lines.push(
      `Justification: "${options.primary.label}" is the highest-value known option under current evidence.`,
    )
  }
  lines.push(...options.why.slice(0, 3))
  lines.push(`Decision confidence ${(clamp01(options.confidence) * 100).toFixed(0)}%.`)
  return lines
}

export function explainConfidence(options: {
  confidence: number
  missing: string[]
  evidenceCount: number
  candidateCount: number
}): string[] {
  const lines: string[] = []
  const pct = (clamp01(options.confidence) * 100).toFixed(0)
  lines.push(`Overall recommendation confidence is ${pct}%.`)
  lines.push(`Evidence items considered: ${options.evidenceCount}.`)
  lines.push(`Candidates compared: ${options.candidateCount}.`)
  if (options.missing.length) {
    lines.push(`Confidence is limited by missing information: ${options.missing.slice(0, 4).join(', ')}.`)
  } else {
    lines.push('No critical missing fields recorded on the primary candidate.')
  }
  if (options.confidence < 0.45) {
    lines.push('Low confidence — prefer collecting information over firm commitment.')
  } else if (options.confidence < 0.7) {
    lines.push('Moderate confidence — recommendation is provisional and revisable.')
  } else {
    lines.push('High confidence relative to known evidence (still not a guarantee).')
  }
  return lines
}

export function challengeAssumptions(candidates: RecommendationCandidate[]): string[] {
  const challenged: string[] = []
  for (const c of candidates) {
    for (const a of c.assumptions ?? []) {
      if (/invent|unknown|implied|assumed/i.test(a)) {
        challenged.push(`Challenge on ${c.label}: ${a}`)
      }
    }
    const hardDest = (c.constraints?.hard ?? []).some((h) => h.startsWith('destination:'))
    if (hardDest && !(c.destinations?.length)) {
      challenged.push(
        `Challenge on ${c.label}: hard destination constraint present but destinations list empty.`,
      )
    }
    if ((c.budget?.stance === 'strict') && typeof c.budget.amount !== 'number') {
      challenged.push(
        `Challenge on ${c.label}: strict budget stance without a numeric amount.`,
      )
    }
  }
  return challenged.slice(0, 6)
}

export function questionsForMissing(missing: string[], locale: 'ar' | 'en'): string[] {
  const map: Record<string, { ar: string; en: string }> = {
    destination: {
      ar: 'ما الوجهة المفضلة، أو هل الوجهة مرنة؟',
      en: 'What destination do you prefer, or is destination flexible?',
    },
    budget_amount: {
      ar: 'ما ميزانية الرحلة التقريبية؟',
      en: 'What approximate trip budget should we plan around?',
    },
    duration: {
      ar: 'كم عدد أيام الرحلة؟',
      en: 'How many days should the trip last?',
    },
    trip_purpose: {
      ar: 'ما هدف الرحلة الأساسي؟',
      en: 'What is the main purpose of the trip?',
    },
    party_size: {
      ar: 'كم عدد المسافرين؟',
      en: 'How many travelers are going?',
    },
  }
  const out: string[] = []
  for (const m of missing) {
    const key = Object.keys(map).find((k) => m.includes(k))
    if (key) out.push(map[key]![locale])
    else {
      out.push(
        locale === 'ar'
          ? `هل يمكنك توضيح: ${m}؟`
          : `Can you clarify: ${m}?`,
      )
    }
  }
  if (!out.length && locale === 'en') {
    out.push('Any hard constraints we should treat as non-negotiable?')
  }
  if (!out.length && locale === 'ar') {
    out.push('هل هناك قيود لا يمكن التنازل عنها؟')
  }
  return [...new Set(out)].slice(0, 5)
}

export const DecisionJustifier = { justify: justifyDecision, challenge: challengeAssumptions }
export const ConfidenceExplainer = {
  explain: explainConfidence,
  questions: questionsForMissing,
}
