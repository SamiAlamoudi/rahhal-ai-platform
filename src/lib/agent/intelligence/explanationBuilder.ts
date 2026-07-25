/**
 * Phase 3 Stage 4 — Build justifications and overall explanation.
 * Consultative tone. Never invents prices, visas, or weather forecasts.
 */

import type {
  IntelligenceContext,
  KnowledgeReference,
  IntelligenceMemoryAppend,
  IntelligenceRankedRecommendation,
  TradeoffInsight,
  TravelAlternative,
  TravelVoiceSummary,
} from './types'

export function buildAlternativeJustifications(input: {
  alternatives: TravelAlternative[]
  rankedPreview: Array<{ alternativeId: string; decisionScore: number }>
  context: IntelligenceContext
  tradeoffs: TradeoffInsight[]
}): Array<{ alternativeId: string; justification: string }> {
  const locale = input.context.locale
  const scoreById = new Map(
    input.rankedPreview.map((r) => [r.alternativeId, r.decisionScore]),
  )

  return input.alternatives.map((alt) => {
    const score = scoreById.get(alt.id) ?? 0
    const related = input.tradeoffs
      .filter((t) => t.between.includes(alt.id))
      .slice(0, 2)
      .map((t) => t.summary)

    if (locale === 'ar') {
      const base = `${alt.destination}: درجة ملاءمة مقارنة ${(score * 100).toFixed(0)}٪ بناءً على الإشارات المتاحة فقط.`
      return {
        alternativeId: alt.id,
        justification: related.length ? `${base} ${related.join(' ')}` : base,
      }
    }

    const base = `${alt.destination}: comparative fit ${(score * 100).toFixed(0)}% from available cues only.`
    return {
      alternativeId: alt.id,
      justification: related.length ? `${base} ${related.join(' ')}` : base,
    }
  })
}

export function buildIntelligenceExplanation(input: {
  context: IntelligenceContext
  ranked: IntelligenceRankedRecommendation[]
  tradeoffs: TradeoffInsight[]
  overallConfidence: number
}): string {
  const locale = input.context.locale
  const primary = input.ranked[0]
  if (!primary) {
    return locale === 'ar'
      ? 'لا توجد بدائل كافية للمقارنة بعد — شارك وجهة أو تفضيلاً لأبدأ التقييم.'
      : 'Not enough alternatives to compare yet — share a destination or preference to begin evaluation.'
  }

  const tradeoffLine = input.tradeoffs[0]?.summary
  if (locale === 'ar') {
    return [
      `الخيار الأعلى مقارنةً: ${primary.destination}.`,
      primary.justification,
      tradeoffLine ? `مقايضة رئيسية: ${tradeoffLine}` : null,
      `ثقة التقييم الإجمالية: ${(input.overallConfidence * 100).toFixed(0)}٪ (بدون تغيير خطة الرحلة).`,
    ]
      .filter(Boolean)
      .join(' ')
  }

  return [
    `Top comparative option: ${primary.destination}.`,
    primary.justification,
    tradeoffLine ? `Key trade-off: ${tradeoffLine}` : null,
    `Overall evaluation confidence: ${(input.overallConfidence * 100).toFixed(0)}% (trip plan unchanged).`,
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildTravelVoiceSummary(input: {
  explanation: string
  locale: 'ar' | 'en'
}): TravelVoiceSummary {
  return {
    speakableSummary: input.explanation.split(/\n+/)[0]?.slice(0, 280) ?? input.explanation,
    locale: input.locale,
    tone: 'consultative',
  }
}

export function buildKnowledgeReferences(
  ranked: IntelligenceRankedRecommendation[],
): KnowledgeReference[] {
  return ranked.slice(0, 3).map((r) => ({
    entryId: `kc:destination:${r.destination.toLowerCase().replace(/\s+/g, '_')}`,
    topic: `destination_compare:${r.destination}`,
    optional: true as const,
  }))
}

export function buildIntelligenceMemoryAppend(input: {
  ranked: IntelligenceRankedRecommendation[]
  context: IntelligenceContext
}): IntelligenceMemoryAppend[] {
  const rows: IntelligenceMemoryAppend[] = [
    {
      key: 'intelligence:evaluated',
      value: 'true',
      mode: 'append',
    },
  ]
  if (input.ranked[0]) {
    rows.push({
      key: 'intelligence:top_destination',
      value: input.ranked[0].destination,
      mode: 'append',
    })
  }
  if (input.context.hasFamilySignal) {
    rows.push({
      key: 'preference:family_travel',
      value: 'noted',
      mode: 'append',
    })
  }
  return rows
}

export const ExplanationBuilder = {
  justifications: buildAlternativeJustifications,
  explanation: buildIntelligenceExplanation,
  voiceSummary: buildTravelVoiceSummary,
  knowledgeRefs: buildKnowledgeReferences,
  memoryAppend: buildIntelligenceMemoryAppend,
}
