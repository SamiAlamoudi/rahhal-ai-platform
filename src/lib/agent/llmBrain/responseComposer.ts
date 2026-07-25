/**
 * Phase 5 — ResponseComposer
 * Natural consultant replies. Dialect-aware. Never verbose / never invent bookings.
 */

import type { LiveTravelMemory } from '../conversationIntelligence'
import type {
  ArabicDialect,
  ComposedResponse,
  ConfidenceLevel,
  LlmBrainLocale,
  ToolDecision,
  TravelReasoningResult,
} from './types'

function joinUnique(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join('\n\n')
}

function greeting(dialect: ArabicDialect, locale: LlmBrainLocale): string {
  if (locale === 'en' && dialect === 'unknown') return 'Got it —'
  if (dialect === 'egyptian') return 'تمام —'
  if (dialect === 'levant') return 'حاضر —'
  if (dialect === 'moroccan') return 'واخا —'
  if (dialect === 'yemeni') return 'طيب —'
  if (dialect === 'gulf' || dialect === 'saudi' || dialect === 'mixed' || dialect === 'msa') {
    return 'تمام —'
  }
  return locale === 'ar' ? 'تمام —' : 'Got it —'
}

export function composeConsultantResponse(input: {
  userText: string
  memory: LiveTravelMemory
  reasoning: TravelReasoningResult
  tool: ToolDecision
  confidence: ConfidenceLevel
  dialect: ArabicDialect
  locale: LlmBrainLocale
  shouldClarify: boolean
}): ComposedResponse {
  const g = greeting(input.dialect, input.locale)
  const parts: string[] = []
  const ar = input.locale === 'ar' || input.dialect !== 'unknown'

  if (input.reasoning.destinationStrategy && !input.memory.destination) {
    parts.push(
      ar
        ? `${g} إذا تبي جو بارد، أرشّح نبدأ بـ جورجيا أو سويسرا أو هوكايدو — حسب الميزانية ومدة الرحلة.`
        : `${g} for somewhere cold, I’d start with Georgia, Switzerland, or Hokkaido — depending on budget and trip length.`,
    )
  } else if (input.memory.destination) {
    parts.push(
      ar
        ? `${g} أبني لك تصور واضح حول ${input.memory.destination} بدون لف ودوران.`
        : `${g} I’ll shape a clear plan around ${input.memory.destination}.`,
    )
  } else {
    parts.push(
      ar
        ? `${g} خلّنا نلتقط ملامح رحلتك بسرعة وأقترح بثقة.`
        : `${g} let’s capture the trip shape quickly and I’ll recommend with confidence.`,
    )
  }

  for (const note of input.reasoning.seasonNotes.slice(0, 2)) {
    parts.push(note)
  }
  for (const tip of input.reasoning.proactiveTips.slice(0, 2)) {
    parts.push(tip)
  }
  for (const risk of input.reasoning.riskNotes.slice(0, 1)) {
    parts.push(risk)
  }

  if (input.reasoning.flightStrategy) parts.push(input.reasoning.flightStrategy)
  if (input.reasoning.hotelStrategy) parts.push(input.reasoning.hotelStrategy)

  if (input.shouldClarify || input.confidence === 'low') {
    parts.push(
      ar
        ? 'عشان أدقّق التوصية: تفضّل مدينة حيوية ولا طبيعة أهدأ؟'
        : 'To sharpen the recommendation: lively city, or quieter nature?',
    )
  } else if (input.tool.tool === 'search_flights') {
    parts.push(
      ar
        ? 'الخطوة المنطقية الآن: مقارنة رحلات مناسبة لجدولك.'
        : 'Next logical step: compare flights that fit your window.',
    )
  } else if (input.tool.tool === 'search_hotels') {
    parts.push(
      ar
        ? 'أركز على فنادق تناسب أسلوبك وموقعك المفضّل.'
        : 'I’ll focus hotels that match your style and preferred area.',
    )
  } else if (input.tool.tool === 'need_visa') {
    parts.push(
      ar
        ? 'بالنسبة للتأشيرة: لا أعتمد تخميناً — نتحقق حسب جنسيتك والوجهة (حالة: غير مؤكد حتى المراجعة).'
        : 'On visas: I won’t invent approvals — we verify by nationality and destination (unknown until checked).',
    )
  }

  // Safety footer — never invent bookings/prices
  parts.push(
    ar
      ? 'ملاحظة: أي أسعار أو تأكيد حجز تُعرض فقط من نتائج أدوات البحث — لا اختلاق.'
      : 'Note: prices and bookings come only from search tools — never invented.',
  )

  const displayText = joinUnique(parts)
  const spokenText = displayText.split(/\n+/).map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' ').slice(0, 360)

  return {
    displayText,
    spokenText,
    style: 'consultant',
    dialectAware: input.dialect !== 'unknown',
  }
}

export const ResponseComposer = {
  compose: composeConsultantResponse,
}
