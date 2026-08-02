import type { BrainRecommendationsBundle, BrainTurnTrace } from '../brain'
import type { UserPreferenceProfile } from '../brain/preferences/types'
import { emptyPreferenceProfile } from '../brain/preferences/types'
import type { TravelDraft } from '../brain/travel/types'
import type { LocaleCode } from '../brain/types'
import { buildTravelDashboard } from './dashboard/TravelDashboard'
import { inferTravelDna } from './dna/TravelDnaInfer'
import { luxuryEmptyFor } from './empty/LuxuryEmptyStates'
import { buildSmartFollowUps } from './followup/SmartFollowUp'
import {
  buildMemoryFacts,
  inferMemoryHints,
  narrateMemory,
  type ExtendedMemoryHints,
} from './memory/ConversationMemoryUx'
import { buildExplainedRecommendations } from './recommendations/ExplainedRecommendations'
import { appendDecision } from './timeline/DecisionTimeline'
import { buildTripIntelligence } from './tripIntel/TripIntelligence'
import type { ConciergeBundle, DecisionTimelineEntry } from './types'

export type ConciergeBuildInput = {
  draft: TravelDraft
  preferences?: UserPreferenceProfile
  recommendations?: BrainRecommendationsBundle | null
  trace?: BrainTurnTrace | null
  recentTexts?: string[]
  locale?: LocaleCode
  memoryHints?: ExtendedMemoryHints
  decisionHistory?: DecisionTimelineEntry[]
  askedFollowUpKeys?: Set<string>
}

export function buildConciergeBundle(input: ConciergeBuildInput): ConciergeBundle {
  const locale = input.locale ?? 'en'
  const prefs = input.preferences ?? emptyPreferenceProfile()
  const draft = input.draft
  const texts = input.recentTexts ?? []
  let hints = input.memoryHints ?? inferMemoryHints('')
  for (const t of texts) hints = inferMemoryHints(t, hints)

  const memoryFacts = buildMemoryFacts(prefs, draft, hints, locale)
  const recs = input.recommendations ?? {
    flights: [],
    hotels: [],
    packages: [],
    activities: [],
    restaurants: [],
  }
  const explained = buildExplainedRecommendations(recs, prefs, draft, locale)
  let decisionTimeline = input.decisionHistory ?? []
  if (input.trace) {
    decisionTimeline = appendDecision(decisionTimeline, input.trace, locale)
  }

  return {
    memoryFacts,
    memoryNarration: narrateMemory(memoryFacts, locale),
    recommendations: explained,
    decisionTimeline,
    tripIntel: buildTripIntelligence(draft, locale),
    dashboard: buildTravelDashboard(draft, prefs, explained.length > 0, locale),
    followUps: buildSmartFollowUps(
      draft,
      prefs,
      input.askedFollowUpKeys ?? new Set(),
      locale,
    ),
    dna: inferTravelDna(prefs, draft, texts, locale),
    emptyInspiration: luxuryEmptyFor(
      explained.length ? 'recommendations' : 'chat',
      locale,
    ),
  }
}
