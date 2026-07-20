/**
 * Sprint 43 — synthesize one coherent conversational response.
 * Does not expose internal engine / tool names. Emits Sprint 42 card-friendly meta.
 */

import type { ConversationStructuredResponse } from '../chat/conversationExperience/types'
import type { UnifiedTravelPlanResult } from '../brain/unifiedTravel/types'
import type {
  OrchestratorIntent,
  OrchestratorMemorySnapshot,
  RankedRecommendation,
  ToolExecutionResult,
} from './types'

export function buildOrchestratorResponse(input: {
  intent: OrchestratorIntent
  locale: 'ar' | 'en'
  userText: string
  memory: OrchestratorMemorySnapshot
  toolResults: ToolExecutionResult[]
  recommendations: RankedRecommendation[]
  planResult: UnifiedTravelPlanResult | null
  usedFallback: boolean
}): {
  text: string
  structured: ConversationStructuredResponse
  uiMeta: Record<string, unknown>
} {
  const locale = input.locale
  const sections = input.toolResults
    .filter((r) => r.ok && r.summary.trim())
    .map((r) => r.summary.trim())

  const top = input.recommendations.slice(0, 5)
  const intro = introForIntent(input.intent, locale, input.memory)
  const rankedBlock = formatRanked(top, locale)
  const memoryNote = memoryReuseNote(input.memory, locale)

  const text = [intro, memoryNote, ...sections.slice(0, 6), rankedBlock]
    .filter(Boolean)
    .join('\n\n')

  const flights = collectFlights(input.toolResults, top)
  const hotels = collectHotels(input.toolResults, top)

  const structured: ConversationStructuredResponse = {
    summary: text,
    flights,
    hotels,
    dailyItinerary: input.planResult?.topPlan?.itinerary?.map((d) => ({
      day: d.day,
      date: d.date,
      title: d.title,
      summary: d.summary,
      items: [...d.items],
    })) ?? [],
    estimatedTotalCost: input.planResult?.costSummary ?? estimateFromRecs(top),
    confidenceScore: confidenceFor(input),
    reasoning: top.flatMap((r) => r.reasons).slice(0, 8),
    suggestedFollowUpActions: suggestionsFor(input.intent, locale),
    plans: input.planResult?.plans ?? [],
    topPlanId: input.planResult?.topPlan?.id ?? null,
    followUps: input.planResult?.followUps ?? [],
    phase: 'presenting',
  }

  const uiMeta: Record<string, unknown> = {
    conversationUi: true,
    conversationExperience: true,
    aiOrchestrator: true,
    // Never expose internal tool ids in user-facing copy; keep ids only in observability logs.
    structured,
    cards: buildCards(top, input.toolResults),
    memory: {
      budget: input.memory.budget,
      travellers: input.memory.travellers,
      nationality: input.memory.nationality,
      preferredAirlines: input.memory.preferredAirlines,
      hotelPreferences: input.memory.hotelPreferences,
      seatPreferences: input.memory.seatPreferences,
      loyaltyMemberships: input.memory.loyaltyMemberships,
      destination: input.memory.destination,
    },
    fallback: input.usedFallback,
  }

  return { text, structured, uiMeta }
}

function introForIntent(
  intent: OrchestratorIntent,
  locale: 'ar' | 'en',
  memory: OrchestratorMemorySnapshot,
): string {
  const dest = memory.destination
  if (locale === 'ar') {
    switch (intent) {
      case 'destination_travel':
        return dest
          ? `إليك خطة متكاملة لسفرك إلى ${dest}.`
          : 'إليك خطة سفر متكاملة بناءً على طلبك.'
      case 'cheapest_option':
        return 'بحثت عن أفضل قيمة مع مراعاة المرونة والمكافآت.'
      case 'flight_cancelled':
        return 'دعنا نعيد ترتيب رحلتك بعد إلغاء الرحلة.'
      case 'lost_passport':
        return 'سأساعدك في خطوات جواز السفر والمستندات والتنبيهات العاجلة.'
      default:
        return 'إليك ملخصاً واضحاً لما وجدته.'
    }
  }
  switch (intent) {
    case 'destination_travel':
      return dest
        ? `Here is a complete plan for your trip to ${dest}.`
        : 'Here is a complete travel plan based on your request.'
    case 'cheapest_option':
      return 'I looked for the best value while weighing flexibility and rewards.'
    case 'flight_cancelled':
      return 'Let’s get your trip back on track after the flight cancellation.'
    case 'lost_passport':
      return 'I will walk you through passport replacement, visa impact, timeline, and alerts.'
    default:
      return 'Here is a clear summary of what I found.'
  }
}

function memoryReuseNote(memory: OrchestratorMemorySnapshot, locale: 'ar' | 'en'): string {
  const parts: string[] = []
  if (memory.budget.amount != null) {
    parts.push(
      locale === 'ar'
        ? `الميزانية المحفوظة: ${memory.budget.amount} ${memory.budget.currency ?? ''}`.trim()
        : `Remembered budget: ${memory.budget.amount} ${memory.budget.currency ?? ''}`.trim(),
    )
  }
  if (memory.travellers.adults != null) {
    parts.push(
      locale === 'ar'
        ? `المسافرون: ${memory.travellers.adults} بالغ`
        : `Travelers: ${memory.travellers.adults} adult(s)`,
    )
  }
  if (memory.nationality) {
    parts.push(
      locale === 'ar'
        ? `الجنسية: ${memory.nationality}`
        : `Nationality: ${memory.nationality}`,
    )
  }
  if (memory.preferredAirlines.length) {
    parts.push(
      locale === 'ar'
        ? `شركات مفضلة: ${memory.preferredAirlines.join(', ')}`
        : `Preferred airlines: ${memory.preferredAirlines.join(', ')}`,
    )
  }
  if (!parts.length) return ''
  return locale === 'ar'
    ? `استخدمت تفضيلاتك المحفوظة — ${parts.join(' · ')}.`
    : `I reused your saved preferences — ${parts.join(' · ')}.`
}

function formatRanked(recs: RankedRecommendation[], locale: 'ar' | 'en'): string {
  if (!recs.length) return ''
  const lines = recs.slice(0, 3).map((r, i) => {
    const price =
      r.price != null
        ? ` — ${r.price} ${r.currency ?? ''}`.trim()
        : ''
    return `${i + 1}. ${r.title}${price}`
  })
  return locale === 'ar'
    ? `أفضل التوصيات:\n${lines.join('\n')}`
    : `Top recommendations:\n${lines.join('\n')}`
}

function collectFlights(
  toolResults: ToolExecutionResult[],
  ranked: RankedRecommendation[],
): ConversationStructuredResponse['flights'] {
  const fromTools = toolResults.find((t) => t.tool === 'flights')?.data?.flights
  if (Array.isArray(fromTools)) {
    return fromTools.slice(0, 4).map((f: Record<string, unknown>, i: number) => ({
      id: String(f.id ?? `flight_${i}`),
      airline: String(f.airline ?? 'Airline'),
      from: String(f.from ?? ''),
      to: String(f.to ?? ''),
      cabin: String(f.cabin ?? 'economy'),
      price: Number(f.price ?? 0),
      currency: String(f.currency ?? 'SAR'),
      stops: Number(f.stops ?? 0),
    }))
  }
  return ranked
    .filter((r) => r.kind === 'flight')
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      airline: r.title.split(' ')[0] ?? 'Airline',
      from: String((r.payload as { from?: string } | undefined)?.from ?? ''),
      to: String((r.payload as { to?: string } | undefined)?.to ?? ''),
      cabin: 'economy',
      price: r.price ?? 0,
      currency: r.currency ?? 'SAR',
      stops: 0,
    }))
}

function collectHotels(
  toolResults: ToolExecutionResult[],
  ranked: RankedRecommendation[],
): ConversationStructuredResponse['hotels'] {
  const fromTools = toolResults.find((t) => t.tool === 'hotels')?.data?.hotels
  if (Array.isArray(fromTools)) {
    return fromTools.slice(0, 4).map((h: Record<string, unknown>, i: number) => ({
      id: String(h.id ?? `hotel_${i}`),
      name: String(h.name ?? 'Hotel'),
      area: String(h.area ?? ''),
      stars: Number(h.stars ?? 3),
      nightly: Number(h.nightly ?? 0),
      currency: String(h.currency ?? 'SAR'),
    }))
  }
  return ranked
    .filter((r) => r.kind === 'hotel')
    .slice(0, 4)
    .map((r) => ({
      id: r.id,
      name: r.title,
      area: '',
      stars: 4,
      nightly: r.price ?? 0,
      currency: r.currency ?? 'SAR',
    }))
}

function buildCards(
  ranked: RankedRecommendation[],
  toolResults: ToolExecutionResult[],
): Array<Record<string, unknown>> {
  const cards: Array<Record<string, unknown>> = []
  for (const rec of ranked.slice(0, 6)) {
    cards.push({
      kind: rec.kind,
      id: rec.id,
      title: rec.title,
      price: rec.price,
      currency: rec.currency,
      reasons: rec.reasons,
    })
  }
  const visa = toolResults.find((t) => t.tool === 'visa')
  if (visa?.ok) {
    cards.push({ kind: 'visa', id: 'visa_card', title: 'Visa guidance', summary: visa.summary })
  }
  const insurance = toolResults.find((t) => t.tool === 'insurance')
  if (insurance?.ok) {
    cards.push({
      kind: 'insurance',
      id: 'insurance_card',
      title: 'Travel insurance',
      summary: insurance.summary,
    })
  }
  return cards
}

function estimateFromRecs(
  recs: RankedRecommendation[],
): ConversationStructuredResponse['estimatedTotalCost'] {
  const priced = recs.filter((r) => r.price != null)
  if (!priced.length) return null
  const total = Math.round(priced.reduce((sum, r) => sum + (r.price ?? 0), 0))
  return {
    currency: priced[0]?.currency ?? 'SAR',
    flights: 0,
    hotels: 0,
    activities: 0,
    transport: 0,
    taxesAndFees: 0,
    total,
    nights: 3,
    withinBudget: null,
    budgetAmount: null,
    remainingBudget: null,
  }
}

function confidenceFor(input: {
  toolResults: ToolExecutionResult[]
  recommendations: RankedRecommendation[]
  usedFallback: boolean
}): number {
  const ok = input.toolResults.filter((t) => t.ok).length
  const total = Math.max(1, input.toolResults.length)
  const base = ok / total
  const boost = input.recommendations.length ? 0.1 : 0
  const penalty = input.usedFallback ? 0.2 : 0
  return Math.max(0.2, Math.min(0.98, base + boost - penalty))
}

function suggestionsFor(
  intent: OrchestratorIntent,
  locale: 'ar' | 'en',
): ConversationStructuredResponse['suggestedFollowUpActions'] {
  if (locale === 'ar') {
    if (intent === 'flight_cancelled') {
      return [
        { id: 'show_alternatives', label: 'عرض البدائل', commandHint: 'show alternatives' },
        { id: 'refund', label: 'كم سأسترد؟', commandHint: 'if I cancel now' },
      ]
    }
    return [
      { id: 'make_cheaper', label: 'اجعلها أرخص', commandHint: 'make it cheaper' },
      { id: 'compare', label: 'قارن الخيارات', commandHint: 'compare options' },
    ]
  }
  if (intent === 'flight_cancelled') {
    return [
      { id: 'show_alternatives', label: 'Show alternatives', commandHint: 'show alternatives' },
      { id: 'refund', label: 'What refund do I get?', commandHint: 'if I cancel now' },
    ]
  }
  if (intent === 'lost_passport') {
    return [
      { id: 'docs', label: 'Document checklist', commandHint: 'what documents do I need' },
      { id: 'visa', label: 'Visa impact', commandHint: 'do I need a visa' },
    ]
  }
  return [
    { id: 'make_cheaper', label: 'Make it cheaper', commandHint: 'I need the cheapest option' },
    { id: 'compare', label: 'Compare options', commandHint: 'compare options' },
  ]
}
