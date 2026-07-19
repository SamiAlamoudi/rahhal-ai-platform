/**
 * Sprint 28 — ConversationSummarizer
 * Compress long chats into privacy-safe summaries while retaining key facts.
 */

import type { BrainLocale, ConversationHistory } from '../types'
import { resolvePolicy } from './expiration'
import { sanitizeMemoryForPublic } from './privacy'
import type {
  ConversationSummary,
  EnrichedConversationMemory,
  MemoryExpirationPolicy,
} from './types'

export type ConversationSummarizerOptions = {
  policy?: Partial<MemoryExpirationPolicy>
  locale?: BrainLocale
}

export type ConversationSummarizerHandle = {
  shouldSummarize: (turnCount: number, existing?: ConversationSummary | null) => boolean
  summarize: (input: {
    conversationId: string
    history: ConversationHistory
    memory: EnrichedConversationMemory
    locale?: BrainLocale
    previousSummary?: ConversationSummary | null
  }) => {
    summary: ConversationSummary
    recentHistory: ConversationHistory
  }
  policy: () => MemoryExpirationPolicy
}

/**
 * Rule-based summarizer — no LLM. Builds a compact digest from memory + recent turns.
 */
export function ConversationSummarizer(
  options: ConversationSummarizerOptions = {},
): ConversationSummarizerHandle {
  const policy = resolvePolicy(options.policy)
  const defaultLocale = options.locale ?? 'ar'

  return {
    policy: () => ({ ...policy }),

    shouldSummarize(turnCount, existing) {
      if (turnCount < policy.summarizeAfterTurns) return false
      const covered = existing?.turnCount ?? 0
      return turnCount - covered >= policy.summarizeAfterTurns / 2 || !existing
    },

    summarize(input) {
      const locale = input.locale ?? defaultLocale
      const turns = input.history.turns
      const window = Math.max(2, policy.recentTurnWindow)
      const recent = turns.slice(-window)
      const covered = turns.slice(0, Math.max(0, turns.length - window))

      const facts = buildKeyFacts(input.memory, locale)
      const priorFacts = input.previousSummary?.keyFacts ?? []
      const keyFacts = uniqueFacts([...priorFacts, ...facts])

      const text =
        locale === 'en'
          ? buildEnglishSummary(keyFacts, covered.length, input.previousSummary)
          : buildArabicSummary(keyFacts, covered.length, input.previousSummary)

      const summary: ConversationSummary = {
        conversationId: input.conversationId,
        locale,
        text,
        keyFacts,
        coveredTurnIds: covered.map((t) => t.id),
        turnCount: turns.length,
        createdAt: new Date().toISOString(),
      }

      return {
        summary,
        recentHistory: {
          conversationId: input.history.conversationId,
          turns: recent.map((t) => ({ ...t })),
        },
      }
    },
  }
}

function buildKeyFacts(
  memory: EnrichedConversationMemory,
  locale: BrainLocale,
): string[] {
  const publicMem = sanitizeMemoryForPublic(memory)
  const facts: string[] = []
  const dest = publicMem.destination as string | null
  const origin = publicMem.origin as string | null
  if (origin && dest) {
    facts.push(locale === 'en' ? `Route ${origin} → ${dest}` : `المسار ${origin} ← ${dest}`)
  } else if (dest) {
    facts.push(locale === 'en' ? `Destination ${dest}` : `الوجهة ${dest}`)
  }
  const travelers = publicMem.travelers as EnrichedConversationMemory['travelers']
  if (travelers?.count != null) {
    facts.push(
      locale === 'en'
        ? `${travelers.count} travelers`
        : `${travelers.count} مسافرين`,
    )
  }
  const budget = publicMem.budget as EnrichedConversationMemory['budget']
  if (budget?.amount != null) {
    facts.push(
      locale === 'en'
        ? `Budget ${budget.amount} ${budget.currency ?? ''}`.trim()
        : `ميزانية ${budget.amount} ${budget.currency ?? ''}`.trim(),
    )
  }
  if (memory.cabinClass) {
    facts.push(locale === 'en' ? `Cabin ${memory.cabinClass}` : `الدرجة ${memory.cabinClass}`)
  }
  if (memory.airlinePreferences.length) {
    facts.push(
      locale === 'en'
        ? `Airlines ${memory.airlinePreferences.join(', ')}`
        : `طيران ${memory.airlinePreferences.join('، ')}`,
    )
  }
  if (memory.hotelPreferences.length) {
    facts.push(
      locale === 'en'
        ? `Hotels ${memory.hotelPreferences.join(', ')}`
        : `فنادق ${memory.hotelPreferences.join('، ')}`,
    )
  }
  if (memory.seatPreferences.length) {
    facts.push(
      locale === 'en'
        ? `Seat ${memory.seatPreferences.join(', ')}`
        : `مقعد ${memory.seatPreferences.join('، ')}`,
    )
  }
  if (memory.mealPreferences.length) {
    facts.push(
      locale === 'en'
        ? `Meals ${memory.mealPreferences.join(', ')}`
        : `وجبات ${memory.mealPreferences.join('، ')}`,
    )
  }
  if (memory.accessibilityRequirements.length) {
    facts.push(
      locale === 'en'
        ? `Accessibility ${memory.accessibilityRequirements.join(', ')}`
        : `إمكانية وصول ${memory.accessibilityRequirements.join('، ')}`,
    )
  }
  if (memory.loyaltyPrograms.length) {
    facts.push(
      locale === 'en'
        ? `Loyalty ${memory.loyaltyPrograms.map((l) => l.program).join(', ')}`
        : `ولاء ${memory.loyaltyPrograms.map((l) => l.program).join('، ')}`,
    )
  }
  if (memory.familyMembers.length) {
    facts.push(
      locale === 'en'
        ? `Family ${memory.familyMembers.map((m) => m.label).join(', ')}`
        : `عائلة ${memory.familyMembers.map((m) => m.label).join('، ')}`,
    )
  }
  if (memory.visaStatus) {
    facts.push(locale === 'en' ? `Visa ${memory.visaStatus}` : `تأشيرة ${memory.visaStatus}`)
  }
  // Nationality only when explicitly provided — never invent.
  if (
    memory.passportNationality.explicitlyProvided &&
    memory.passportNationality.nationality
  ) {
    facts.push(
      locale === 'en'
        ? `Nationality ${memory.passportNationality.nationality}`
        : `الجنسية ${memory.passportNationality.nationality}`,
    )
  }
  return facts
}

function buildEnglishSummary(
  facts: string[],
  coveredCount: number,
  previous: ConversationSummary | null | undefined,
): string {
  const head = previous?.text ? `${previous.text} ` : ''
  const body =
    facts.length > 0
      ? `Known so far: ${facts.join('; ')}.`
      : 'Conversation in progress; collecting trip details.'
  return `${head}${body} (summarized ${coveredCount} earlier turns)`.trim()
}

function buildArabicSummary(
  facts: string[],
  coveredCount: number,
  previous: ConversationSummary | null | undefined,
): string {
  const head = previous?.text ? `${previous.text} ` : ''
  const body =
    facts.length > 0
      ? `المعروف حتى الآن: ${facts.join('؛ ')}.`
      : 'المحادثة جارية لجمع تفاصيل الرحلة.'
  return `${head}${body} (تم تلخيص ${coveredCount} رسالة سابقة)`.trim()
}

function uniqueFacts(facts: string[]): string[] {
  const out: string[] = []
  for (const f of facts) {
    const t = f.trim()
    if (!t) continue
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out.slice(0, 24)
}
