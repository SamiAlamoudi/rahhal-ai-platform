/**
 * Step 7 — Response Composer.
 * Structures consultant replies: reasoning, recommendation, tradeoffs, warnings, next step.
 */

import { formatReasoningReply } from '../../agent/reasoning/formatReasoningReply'
import type { AgentMemory, TripRequirements } from '../../agent/types'
import type { TravelReasoningResult } from '../../agent/reasoning/types'
import type {
  BrainIntentResult,
  ComposedResponse,
  ConversationUnderstanding,
} from './types'

export function composeBrainResponse(input: {
  locale: AgentMemory['locale']
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  memory: AgentMemory
  reasoningResult: TravelReasoningResult | null
  missingFields: Array<keyof TripRequirements>
}): ComposedResponse | null {
  const { reasoningResult, memory } = input

  if (
    reasoningResult
    && memory.requirements.destinationFlexible
    && !memory.requirements.destination
    && reasoningResult.primary
  ) {
    const body = formatReasoningReply({
      result: reasoningResult,
      requirements: memory.requirements,
    })
    const warnings = collectWarnings(reasoningResult, input.locale)
    const tradeoffs = collectTradeoffs(reasoningResult, input.locale)
    return {
      reasoning: reasoningResult.rationale.slice(0, 4),
      recommendation: reasoningResult.primary.name,
      tradeoffs,
      warnings,
      nextStep: input.locale === 'ar'
        ? 'أي وجهة نثبّتها؟ قل الاسم أو «الأولى» — وأبني لك خطة كاملة.'
        : 'Which destination should we lock? Say the name or “the first one” — I will build a full plan.',
      body,
    }
  }

  return null
}

export function composeClarificationQuestion(input: {
  locale: AgentMemory['locale']
  memory: AgentMemory
  missingFields: Array<keyof TripRequirements>
  understanding: ConversationUnderstanding
}): string | null {
  if (input.understanding.travelContext.discoveryMode) {
    return null
  }

  const hard = input.missingFields.filter((field): field is keyof TripRequirements =>
    field === 'destination'
    || field === 'durationDays'
    || field === 'budgetAmount'
    || field === 'travelers',
  )
  if (hard.length === 0) return null

  const field = hard[0]
  if (input.locale === 'ar') {
    if (field === 'destination') {
      return 'وين تحب تسافر؟ لو مو متأكد، قل «مكان بارد» أو «عطلة نهاية الأسبوع» وأنا أقترح.'
    }
    if (field === 'durationDays') {
      return 'كم يوم تقريباً للرحلة؟'
    }
    if (field === 'budgetAmount') {
      return 'وش الميزانية التقريبية (مثلاً 8000 ريال للشخص)؟'
    }
    if (field === 'travelers') {
      return 'كم مسافر معك؟'
    }
  }

  if (field === 'destination') {
    return 'Where would you like to go? If you are unsure, say “somewhere cold” or “weekend escape” and I will suggest options.'
  }
  if (field === 'durationDays') {
    return 'Roughly how many days for the trip?'
  }
  if (field === 'budgetAmount') {
    return 'What is your approximate budget (e.g. 8000 SAR total)?'
  }
  if (field === 'travelers') {
    return 'How many travelers?'
  }

  return null
}

function collectWarnings(
  result: TravelReasoningResult,
  locale: AgentMemory['locale'],
): string[] {
  const warnings: string[] = []
  const rows = [result.primary, ...result.alternatives].filter(Boolean)
  for (const row of rows) {
    if (!row) continue
    for (const note of row.advisoryNotes ?? []) {
      if (!warnings.includes(note)) warnings.push(note)
    }
    const visa = row.visaGuidance?.summary
    if (visa && row.visaGuidance?.ease === 'embassy' && !warnings.includes(visa)) {
      warnings.push(visa)
    }
  }
  if (warnings.length === 0 && locale === 'ar') {
    return []
  }
  return warnings.slice(0, 3)
}

function collectTradeoffs(
  result: TravelReasoningResult,
  locale: AgentMemory['locale'],
): string[] {
  const tradeoffs: string[] = []
  const alt = result.alternatives[0]
  if (alt) {
    tradeoffs.push(
      locale === 'ar'
        ? `بديل قوي: ${alt.name} — ${alt.whySelected[0] ?? alt.name}`
        : `Strong alternative: ${alt.name} — ${alt.whySelected[0] ?? alt.name}`,
    )
  }
  return tradeoffs
}
