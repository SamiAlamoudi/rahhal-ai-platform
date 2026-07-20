/**
 * Step 5 — Reflection Engine.
 * One internal pass to reduce unnecessary questions and sharpen the reply.
 */

import type { AgentMemory } from '../../agent/types'
import type { TravelReasoningResult } from '../../agent/reasoning/types'
import type {
  BrainIntentResult,
  ComposedResponse,
  ConversationUnderstanding,
} from './types'

export function reflectOnResponse(input: {
  draft: ComposedResponse
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  memory: AgentMemory
  reasoningResult: TravelReasoningResult | null
}): ComposedResponse {
  const next: ComposedResponse = {
    ...input.draft,
    reasoning: [...input.draft.reasoning],
    tradeoffs: [...input.draft.tradeoffs],
    warnings: [...input.draft.warnings],
    body: input.draft.body,
  }

  // Reduce robotic form-style questions when discovery already produced options.
  if (
    input.reasoningResult?.primary
    && input.memory.requirements.destinationFlexible
    && !input.memory.requirements.destination
  ) {
    const formAsk = /(?:destination|budget|travelers|dates)\?/i.test(next.body)
    if (formAsk) {
      next.body = next.body.replace(
        /(?:What is your (?:destination|budget)|كم عدد المسافرين)[^\n]*\n?/gi,
        '',
      ).trim()
    }
    if (!next.nextStep) {
      next.nextStep = input.memory.locale === 'ar'
        ? 'أي وجهة نثبّتها؟ قل الاسم أو «الأولى».'
        : 'Which destination should we lock? Say the name or “the first one”.'
    }
  }

  // Surface long-flight constraint as a tradeoff when ranking cold/long-haul options.
  if (input.understanding.constraints.includes('avoid_long_flights')) {
    const note = input.memory.locale === 'ar'
      ? 'أفضّل خيارات بمدة طيران أقصر بسبب تفضيلك.'
      : 'I am favoring shorter flight options based on your preference.'
    if (!next.tradeoffs.includes(note)) {
      next.tradeoffs.push(note)
    }
  }

  // Stressed / needs-break tone — warmer opener if missing empathy.
  if (input.understanding.emotionalContext.needsBreak) {
    const empathy = input.memory.locale === 'ar'
      ? 'أفهم أنك تحتاج استراحة — خلّني أختار لك وجهة مريحة.'
      : 'I hear you need a real break — I will short-list restorative options.'
    if (!next.reasoning.some((line) => line.includes(empathy.slice(0, 12)))) {
      next.reasoning.unshift(empathy)
    }
  }

  // Append tradeoffs and warnings to body once (consultant voice).
  const extras: string[] = []
  if (next.tradeoffs.length > 0) {
    const label = input.memory.locale === 'ar' ? 'بدائل وتنازلات:' : 'Tradeoffs:'
    extras.push('', label, ...next.tradeoffs.map((line) => `• ${line}`))
  }
  if (next.warnings.length > 0) {
    const label = input.memory.locale === 'ar' ? 'انتبه:' : 'Watch out:'
    extras.push('', label, ...next.warnings.map((line) => `• ${line}`))
  }
  if (next.nextStep) {
    const label = input.memory.locale === 'ar' ? 'الخطوة التالية:' : 'Next:'
    extras.push('', `${label} ${next.nextStep}`)
  }

  if (extras.length > 0) {
    next.body = `${next.body.trim()}\n${extras.join('\n')}`.trim()
  }

  return next
}
