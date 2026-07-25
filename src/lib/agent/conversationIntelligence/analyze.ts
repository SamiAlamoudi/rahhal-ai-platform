/**
 * Phase 4 — Streaming-ready conversation analysis pipeline.
 *
 * Stages (safe on partial transcripts while the user is still speaking):
 * 1. Intent detection
 * 2. Entity extraction
 * 3. Reference resolution
 * 4. Memory update
 * 5. Summary + question plan + consultant notes
 *
 * Pure / deterministic. No network.
 */

import {
  ConversationMemory,
  createEmptyLiveTravelMemory,
  updateLiveTravelMemory,
} from './conversationMemory'
import { extractEntities } from './entityExtractor'
import { detectConversationIntent } from './intentDetector'
import { resolveReferences } from './referenceResolver'
import { summarizeConversation } from './conversationSummarizer'
import { planIntelligentQuestions } from './questionPlanner'
import { buildConsultantNotes, buildProactiveInsights } from './travelConsultant'
import type {
  ConsultantLocale,
  ConversationIntelligenceAnalyzeInput,
  ConversationIntelligenceResult,
  ExtractedEntities,
  LiveTravelMemory,
  ResolvedReference,
} from './types'

export const PHASE4_CONVERSATION_INTELLIGENCE_VERSION =
  'phase4-conversation-intelligence-v1' as const

/** Fold resolved references into entity patches before memory merge. */
export function applyReferencesToEntities(
  entities: ExtractedEntities,
  references: ResolvedReference[],
  prior: LiveTravelMemory,
): ExtractedEntities {
  const next: ExtractedEntities = {
    ...entities,
    cities: [...entities.cities],
    hotelPreferences: [...entities.hotelPreferences],
    flightPreferences: [...entities.flightPreferences],
    airlines: [...entities.airlines],
    activities: [...entities.activities],
    specialRequests: [...entities.specialRequests],
    cues: [...entities.cues],
  }

  for (const ref of references) {
    if (ref.kind === 'destination' && !next.destination) {
      next.destination = prior.destination ?? ref.resolvesTo
      next.cues.push(`ref:destination:${next.destination}`)
    }
    if (ref.kind === 'budget' && next.budgetAmount == null && prior.budgetAmount != null) {
      next.budgetAmount = prior.budgetAmount
      next.currency = prior.currency
      next.cues.push('ref:same_budget')
    }
    if (ref.kind === 'date' && ref.resolvesTo === 'relative:next_week') {
      next.flexibleDates = next.flexibleDates ?? true
      next.cues.push('ref:next_week')
    }
    if (ref.kind === 'airline' && next.airlines.length === 0 && prior.airlines[0]) {
      next.airlines = [...prior.airlines]
      next.cues.push(`ref:airline:${prior.airlines[0]}`)
    }
    if (ref.kind === 'hotel' && next.hotelPreferences.length === 0 && prior.hotelPreferences.length) {
      next.hotelPreferences = [...prior.hotelPreferences]
      next.cues.push('ref:same_hotel')
    }
  }

  return next
}

/**
 * Full analysis pass — safe to call repeatedly as a transcript grows.
 */
export function analyzeConversation(
  input: ConversationIntelligenceAnalyzeInput,
): ConversationIntelligenceResult {
  const locale: ConsultantLocale = input.locale ?? 'ar'
  const prior = input.priorMemory ?? createEmptyLiveTravelMemory()
  const intentResult = detectConversationIntent(input.userText)
  const rawEntities = extractEntities(input.userText)
  const references = resolveReferences(input.userText, prior, input.recentTexts ?? [])
  const entities = applyReferencesToEntities(rawEntities, references, prior)
  let memory = updateLiveTravelMemory(prior, entities)
  if (locale) {
    memory = { ...memory, languagePreference: locale }
  }

  const summary = summarizeConversation(memory, locale)
  const questions = planIntelligentQuestions(memory, locale)
  const insights = buildProactiveInsights(memory, intentResult.intent)
  const consultantNotes = buildConsultantNotes(memory, intentResult.intent, insights)

  return {
    enabled: true,
    locale,
    intent: intentResult.intent,
    intentConfidence: intentResult.confidence,
    entities,
    memory,
    references,
    summary,
    questions,
    insights,
    consultantNotes,
    streaming: Boolean(input.streaming),
  }
}

/**
 * Session helper: analyze against a ConversationMemory store.
 */
export function analyzeWithMemoryStore(
  store: ConversationMemory,
  userText: string,
  opts?: {
    streaming?: boolean
    locale?: ConsultantLocale
    recentTexts?: string[]
  },
): ConversationIntelligenceResult {
  const analysis = analyzeConversation({
    userText,
    priorMemory: store.getSnapshot(),
    streaming: opts?.streaming,
    locale: opts?.locale,
    recentTexts: opts?.recentTexts,
  })
  store.applyEntities(analysis.entities)
  return analysis
}
