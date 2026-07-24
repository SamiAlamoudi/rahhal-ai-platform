/**
 * Experience Intelligence Layer — Phase 3 Stage 5.
 *
 * Converts existing AI outputs into UI-ready presentation models.
 * Never plans trips. Never fetches external APIs.
 * Metadata only (`meta.experience`). Not wired into planTurn.
 * Flag `ai.experience_layer` default OFF.
 */

import { buildDestinationHighlights } from './destinationHighlights'
import {
  EXPERIENCE_FUTURE_MODULES,
  EXPERIENCE_LAYER_FEATURE_ID,
  isExperienceLayerEnabled,
} from './experienceRegistry'
import {
  buildAlternativeCards,
  buildImportantAlertCards,
  buildPlaceholderCards,
  buildQuickFactCards,
  buildRecommendedActionCards,
} from './recommendationCards'
import { buildExperienceTimeline } from './timelineBuilder'
import { buildTripHighlights } from './tripHighlights'
import { buildExperienceSections } from './tripSections'
import {
  buildExecutiveSummaryCard,
  buildExperienceTripSummary,
  extractExperienceSourceFacts,
} from './tripSummary'
import type {
  ExperienceComposerInput,
  ExperienceComposerResult,
  ExperienceKnowledgeSurface,
  ExperienceMetaSnapshot,
  ExperienceModel,
  ExperienceVoiceContext,
  ExperienceVoiceSession,
} from './types'
import { isoNow } from './types'

export interface ExperienceTurnLike {
  reply: string
  memory: unknown
  tripPlan: unknown
  meta: Record<string, unknown> | object
  toolBatch?: unknown
}

export interface ExperienceTurnOptions {
  userText: string
  conversationId: string
  enabled?: boolean
  now?: Date
}

function emptyKnowledgeSurface(): ExperienceKnowledgeSurface {
  return {
    books: [],
    travelGuides: [],
    visaGuides: [],
    pdfLibrary: [],
    savedArticles: [],
    favorites: [],
  }
}

function buildVoicePrep(input: {
  conversationId: string
  userText: string
  locale: 'ar' | 'en'
  reply?: string
  activeGoal?: string | null
  now?: Date
}): {
  session: ExperienceVoiceSession
  context: ExperienceVoiceContext
} {
  return {
    session: {
      sessionId: `voice-exp-${input.conversationId}`,
      locale: input.locale,
      status: 'idle',
    },
    context: {
      conversationId: input.conversationId,
      lastUserText: input.userText || null,
      lastAssistantText: input.reply?.trim() || null,
      activeGoal: input.activeGoal ?? null,
    },
  }
}

/**
 * Compose a read-only experience model from prior-layer outputs.
 */
export function composeExperience(
  input: ExperienceComposerInput,
): ExperienceComposerResult {
  if (!isExperienceLayerEnabled({ enabled: input.enabled })) {
    throw new Error('experience_layer_disabled')
  }

  const started = Date.now()
  const facts = extractExperienceSourceFacts(input)
  const executiveSummary = buildExecutiveSummaryCard(facts)
  const tripHighlights = buildTripHighlights(facts)
  const destinationHighlights = buildDestinationHighlights(facts)
  const timeline = buildExperienceTimeline(facts)
  const recommendedActions = buildRecommendedActionCards(facts)
  const importantAlerts = buildImportantAlertCards(facts)
  const placeholders = buildPlaceholderCards(facts.locale)
  const recommendedAlternatives = buildAlternativeCards(facts)
  const quickFacts = buildQuickFactCards(facts)
  const summary = buildExperienceTripSummary(facts)
  const sections = buildExperienceSections({
    locale: facts.locale,
    executiveSummary,
    tripHighlights,
    destinationHighlights,
    recommendedActions,
    importantAlerts,
    recommendedAlternatives,
    quickFacts,
    placeholders: Object.values(placeholders),
  })

  const experience: ExperienceModel = {
    executiveSummary,
    tripHighlights,
    destinationHighlights,
    timeline,
    recommendedActions,
    importantAlerts,
    placeholders,
    recommendedAlternatives,
    quickFacts,
    sections,
    summary,
    confidence: facts.confidence,
    missingInformation: [...facts.missingInformation],
    nextQuestions: [...facts.nextQuestions],
  }

  const voice = buildVoicePrep({
    conversationId: input.conversationId,
    userText: input.userText,
    locale: facts.locale,
    activeGoal: facts.destination ? `trip:${facts.destination}` : null,
    now: input.now,
  })

  // Touch isoNow so Voice Transcript interface consumers have a clock helper nearby.
  void isoNow(input.now)

  return {
    enabled: true,
    conversationId: input.conversationId.trim() || 'conversation',
    experience,
    voice: {
      session: voice.session,
      context: voice.context,
      prepared: true,
    },
    knowledge: emptyKnowledgeSurface(),
    futureModules: EXPERIENCE_FUTURE_MODULES.map((m) => ({ ...m })),
    durationMs: Math.max(0, Date.now() - started),
  }
}

export function tryComposeExperience(
  input: ExperienceComposerInput,
): ExperienceComposerResult | null {
  if (!isExperienceLayerEnabled({ enabled: input.enabled })) return null
  try {
    return composeExperience({ ...input, enabled: true })
  } catch {
    return null
  }
}

function toMetaSnapshot(result: ExperienceComposerResult): ExperienceMetaSnapshot {
  return {
    enabled: true,
    conversationId: result.conversationId,
    experience: result.experience,
    voicePrepared: true,
    knowledgePrepared: true,
    futureModuleIds: result.futureModules.map((m) => m.moduleId),
    durationMs: result.durationMs,
  }
}

/**
 * Optional enrich helper: attaches meta.experience only.
 * Identity for reply / tripPlan / memory / other meta.
 * NOT called from planTurn in this stage.
 */
export function enrichTurnWithExperienceLayer<T extends ExperienceTurnLike>(
  turn: T,
  options: ExperienceTurnOptions,
): T {
  if (!isExperienceLayerEnabled({ enabled: options.enabled })) {
    return turn
  }

  try {
    const memory = turn.memory as { locale?: string; requirements?: unknown }
    const meta = turn.meta as Record<string, unknown>

    const result = composeExperience({
      locale: memory.locale === 'en' ? 'en' : 'ar',
      conversationId: options.conversationId,
      userText: options.userText,
      memoryContext: memory,
      tripPlan: turn.tripPlan,
      consultantResponse: meta.consultantResponse,
      proactiveAdvisor: meta.proactiveAdvisor,
      travelIntelligence: meta.travelIntelligence,
      multiTurnSnapshot: meta.multiTurnConversation,
      enabled: true,
      now: options.now,
    })

    // Attach prepared voice context last-assistant from production reply (read-only).
    result.voice.context.lastAssistantText = turn.reply?.trim() || null

    return {
      ...turn,
      reply: turn.reply,
      tripPlan: turn.tripPlan,
      memory: turn.memory,
      meta: {
        ...meta,
        experience: toMetaSnapshot(result),
      },
    }
  } catch {
    return turn
  }
}

export const ExperienceComposer = {
  featureId: EXPERIENCE_LAYER_FEATURE_ID,
  compose: composeExperience,
  tryCompose: tryComposeExperience,
  enrichTurn: enrichTurnWithExperienceLayer,
  isEnabled: isExperienceLayerEnabled,
}
