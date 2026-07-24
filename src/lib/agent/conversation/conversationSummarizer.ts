/**
 * Phase 3 Stage 2 — Conversation summarizer.
 * Compresses older turns into structured memory summary (no LLM).
 */

import {
  isoNow,
  type MultiTurnConversationSession,
  type MultiTurnHistoryEntry,
} from './memoryTypes'
import type { ConversationLocale } from './types'

/** Summarize when history exceeds this many entries. */
export const SUMMARY_TURN_THRESHOLD = 10
/** Keep this many recent turns uncompressed in short-term memory. */
export const SHORT_TERM_KEEP = 6

export interface SummarizeResult {
  session: MultiTurnConversationSession
  summarized: boolean
  summary: string
}

export function shouldSummarizeConversation(
  session: MultiTurnConversationSession,
): boolean {
  return session.conversationHistory.length >= SUMMARY_TURN_THRESHOLD
}

export function summarizeConversation(
  session: MultiTurnConversationSession,
  now?: Date,
): SummarizeResult {
  if (!shouldSummarizeConversation(session)) {
    return {
      session,
      summarized: false,
      summary: session.conversationSummary,
    }
  }

  const locale = session.locale === 'en' ? 'en' : 'ar'
  const older = session.conversationHistory.slice(0, -SHORT_TERM_KEEP)
  const recent = session.conversationHistory.slice(-SHORT_TERM_KEEP)
  const structured = buildStructuredSummary(session, older, locale)
  const mergedSummary = mergeSummaries(session.conversationSummary, structured, locale)

  const next: MultiTurnConversationSession = {
    ...session,
    conversationSummary: mergedSummary,
    // Compress: drop older raw turns; keep recent + summary
    conversationHistory: recent,
    shortTerm: { recentTurns: recent.map((t) => ({ ...t })) },
    updatedAt: isoNow(now),
  }

  return {
    session: next,
    summarized: true,
    summary: mergedSummary,
  }
}

function buildStructuredSummary(
  session: MultiTurnConversationSession,
  older: MultiTurnHistoryEntry[],
  locale: ConversationLocale,
): string {
  const dest = session.destinationFacts.destination
  const budget = session.strategyFacts.budgetAmount
  const currency = session.strategyFacts.budgetCurrency ?? 'SAR'
  const days = session.strategyFacts.durationDays
  const adults = session.travelerFacts.adults
  const topic = session.conversationTopic
  const goal = session.activeGoal ?? session.tripGoal
  const corrections = session.userCorrections.length
  const topics = uniqueTopics(older)

  if (locale === 'ar') {
    return [
      'ملخص المحادثة:',
      dest ? `الوجهة: ${dest}` : null,
      budget != null ? `الميزانية: ${budget} ${currency}` : null,
      days != null ? `المدة: ${days} أيام` : null,
      adults != null ? `المسافرون: ${adults}` : null,
      topic ? `الموضوع: ${topic}` : null,
      goal ? `الهدف: ${goal}` : null,
      topics.length ? `مواضيع سابقة: ${topics.join('، ')}` : null,
      corrections > 0 ? `تصحيحات المستخدم: ${corrections}` : null,
      `أدوار مضغوطة: ${older.length}`,
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return [
    'Conversation summary:',
    dest ? `destination=${dest}` : null,
    budget != null ? `budget=${budget} ${currency}` : null,
    days != null ? `duration=${days}d` : null,
    adults != null ? `travelers=${adults}` : null,
    topic ? `topic=${topic}` : null,
    goal ? `goal=${goal}` : null,
    topics.length ? `priorTopics=${topics.join(',')}` : null,
    corrections > 0 ? `corrections=${corrections}` : null,
    `compressedTurns=${older.length}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

function mergeSummaries(
  previous: string,
  next: string,
  locale: ConversationLocale,
): string {
  if (!previous.trim()) return next
  if (!next.trim()) return previous
  if (previous.includes(next)) return previous
  const joiner = locale === 'ar' ? ' | ' : ' | '
  const merged = `${previous}${joiner}${next}`
  return merged.slice(0, 1200)
}

function uniqueTopics(turns: MultiTurnHistoryEntry[]): string[] {
  const out: string[] = []
  for (const t of turns) {
    if (t.topic && !out.includes(t.topic)) out.push(t.topic)
  }
  return out.slice(0, 8)
}

export const ConversationSummarizer = {
  shouldSummarize: shouldSummarizeConversation,
  summarize: summarizeConversation,
  threshold: SUMMARY_TURN_THRESHOLD,
  keepRecent: SHORT_TERM_KEEP,
}
