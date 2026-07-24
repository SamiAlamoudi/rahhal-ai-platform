/**
 * Phase 3 Stage 1 — Conversational reply generation.
 * Template composition from consultant response + confidence rules.
 * No LLM. Never invents facts.
 */

import {
  confidenceBand,
  type ConfidenceBand,
  type ConversationLocale,
  type ConversationReplyFormat,
  type ConversationState,
} from './types'
import { wasQuestionAsked } from './conversationMemory'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

export interface ConversationReplyBuildInput {
  locale: ConversationLocale
  format: ConversationReplyFormat
  confidence: number
  consultantResponse: unknown | null
  state: ConversationState
  userText: string
}

export interface ConversationReplyBuildResult {
  reply: string
  spokenText: string
  clarificationQuestion: string | null
  confidenceBand: ConfidenceBand
}

export function buildConversationReply(
  input: ConversationReplyBuildInput,
): ConversationReplyBuildResult {
  const locale = input.locale === 'en' ? 'en' : 'ar'
  const band = confidenceBand(input.confidence)
  const body = asRecord(asRecord(input.consultantResponse)?.body)
  const formats = asRecord(asRecord(input.consultantResponse)?.formats)

  const executiveSummary = strList(body?.executiveSummary)
  const traveler = strList(body?.travelerUnderstanding)
  const destination = strList(body?.destinationUnderstanding)
  const strategy = strList(body?.recommendedStrategy)
  const primary = strList(body?.primaryRecommendation)
  const alternative = strList(body?.alternativeRecommendation)
  const tradeoffs = strList(body?.tradeoffs)
  const risks = strList(body?.risks)
  const missing = strList(body?.missingInformation)
  const questions = strList(body?.clarificationQuestions)

  const answerCore = pickAnswer(input.format, {
    locale,
    formats,
    executiveSummary,
    traveler,
    destination,
    strategy,
    primary,
    alternative,
    tradeoffs,
    risks,
  })

  const clarificationQuestion = pickClarificationQuestion({
    locale,
    band,
    questions,
    missing,
    state: input.state,
  })

  let reply = answerCore
  if (band === 'low') {
    // Exactly one clarification — do not invent an answer as fact.
    reply = clarificationQuestion
      ?? (locale === 'ar'
        ? 'أحتاج معلومة واحدة واضحة قبل أن أقدّم توصية موثوقة.'
        : 'I need one clear detail before I can give a reliable recommendation.')
  } else if (band === 'medium' && clarificationQuestion) {
    reply = `${answerCore}\n\n${
      locale === 'ar' ? 'سؤال اختياري سريع:' : 'One optional follow-up:'
    } ${clarificationQuestion}`
  }
  // high → answer immediately, no question

  const spokenText = reply.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0] ?? reply
  return {
    reply: reply.trim(),
    spokenText: spokenText.slice(0, 360),
    clarificationQuestion: band === 'high' ? null : clarificationQuestion,
    confidenceBand: band,
  }
}

function pickAnswer(
  format: ConversationReplyFormat,
  parts: {
    locale: ConversationLocale
    formats: Record<string, unknown> | null
    executiveSummary: string[]
    traveler: string[]
    destination: string[]
    strategy: string[]
    primary: string[]
    alternative: string[]
    tradeoffs: string[]
    risks: string[]
  },
): string {
  const { locale } = parts
  const fmt = parts.formats

  if (format === 'executive') {
    const exec = asRecord(fmt?.executive)
    const line =
      (typeof exec?.oneLiner === 'string' && exec.oneLiner)
      || parts.executiveSummary[0]
      || parts.primary[0]
      || parts.strategy[0]
    return line
      || (locale === 'ar'
        ? 'إليك خلاصة سريعة من فهمنا الحالي للرحلة.'
        : 'Here is a quick take from what we understand so far.')
  }

  if (format === 'short') {
    const short = asRecord(fmt?.short)
    const title = typeof short?.title === 'string' ? short.title : parts.primary[0]
    const why = typeof short?.why === 'string' ? short.why : parts.strategy[0]
    return [title, why].filter(Boolean).join(' — ')
      || (locale === 'ar' ? 'ملخص قصير لخياراتك.' : 'A short summary of your options.')
  }

  if (format === 'detailed') {
    const sections = [
      parts.executiveSummary[0],
      parts.traveler[0] && (locale === 'ar' ? `فهم المسافر: ${parts.traveler[0]}` : `Traveler: ${parts.traveler[0]}`),
      parts.destination[0] && (locale === 'ar' ? `الوجهة: ${parts.destination[0]}` : `Destination: ${parts.destination[0]}`),
      parts.strategy[0] && (locale === 'ar' ? `الاستراتيجية: ${parts.strategy[0]}` : `Strategy: ${parts.strategy[0]}`),
      parts.primary[0] && (locale === 'ar' ? `التوصية: ${parts.primary[0]}` : `Recommendation: ${parts.primary[0]}`),
      parts.alternative[0] && (locale === 'ar' ? `بديل: ${parts.alternative[0]}` : `Alternative: ${parts.alternative[0]}`),
      parts.tradeoffs[0] && (locale === 'ar' ? `مقايضة: ${parts.tradeoffs[0]}` : `Trade-off: ${parts.tradeoffs[0]}`),
      parts.risks[0] && (locale === 'ar' ? `مخاطرة: ${parts.risks[0]}` : `Risk: ${parts.risks[0]}`),
    ].filter(Boolean) as string[]
    return sections.join('\n')
      || (locale === 'ar' ? 'تفاصيل الرحلة ما زالت تتشكل.' : 'Trip details are still taking shape.')
  }

  // consultant
  const consultant = asRecord(fmt?.consultant)
  const voice = strList(consultant?.voice)
  if (voice.length) return voice.slice(0, 3).join(' ')
  return [
    locale === 'ar'
      ? 'كمستشار سفر، أبني التوصية على ما شاركته فقط — دون افتراضات.'
      : 'As your travel consultant, I build guidance only from what you shared — no invented facts.',
    parts.primary[0] || parts.strategy[0] || parts.executiveSummary[0] || '',
  ].filter(Boolean).join(' ')
}

function pickClarificationQuestion(options: {
  locale: ConversationLocale
  band: ConfidenceBand
  questions: string[]
  missing: string[]
  state: ConversationState
}): string | null {
  if (options.band === 'high') return null

  const candidates = [
    ...options.questions,
    ...options.missing.map((m) => missingToQuestion(m, options.locale)),
  ].filter(Boolean)

  for (const q of candidates) {
    if (!wasQuestionAsked(options.state, q)) return q
  }

  // Fallback single question from known gaps — never invent destinations/prices.
  if (!options.state.knownFacts.destination && !options.state.currentTrip.destination) {
    const q =
      options.locale === 'ar'
        ? 'إلى أي وجهة تفكر بالسفر؟'
        : 'Which destination are you considering?'
    if (!wasQuestionAsked(options.state, q)) return q
  }
  if (options.state.knownFacts.budgetAmount == null && options.state.currentTrip.budgetAmount == null) {
    const q =
      options.locale === 'ar'
        ? 'ما الميزانية التقريبية للرحلة؟'
        : 'What is your approximate trip budget?'
    if (!wasQuestionAsked(options.state, q)) return q
  }
  if (options.state.knownFacts.durationDays == null && options.state.currentTrip.durationDays == null) {
    const q =
      options.locale === 'ar'
        ? 'كم يوماً تريد للرحلة؟'
        : 'How many days should the trip last?'
    if (!wasQuestionAsked(options.state, q)) return q
  }

  return null
}

function missingToQuestion(missing: string, locale: ConversationLocale): string {
  const m = missing.toLowerCase()
  if (m.includes('destination')) {
    return locale === 'ar' ? 'إلى أي وجهة تفكر بالسفر؟' : 'Which destination are you considering?'
  }
  if (m.includes('budget')) {
    return locale === 'ar' ? 'ما الميزانية التقريبية للرحلة؟' : 'What is your approximate trip budget?'
  }
  if (m.includes('duration') || m.includes('days')) {
    return locale === 'ar' ? 'كم يوماً تريد للرحلة؟' : 'How many days should the trip last?'
  }
  if (m.startsWith('clarify:')) return missing.slice('clarify:'.length).trim()
  return locale === 'ar' ? `هل يمكنك توضيح: ${missing}؟` : `Could you clarify: ${missing}?`
}

export const ConversationReply = {
  build: buildConversationReply,
}
