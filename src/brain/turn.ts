/**
 * Rich turn processing for Brain ⇄ UI — still mock-only, no providers.
 */

import type { ExtractedEntities } from './entities/types'
import type { DetectedIntent } from './intent/intents'
import type { ResolvedReference } from './context/ContextEngine'
import type { BrainDecision } from './decision/DecisionEngine'
import type { ReasonerReport } from './reasoner/TravelReasoner'
import type { SafetyVerdict } from './safety/SafetyLayer'
import type { UserPreferenceProfile } from './preferences/types'
import type { ShortTermMemory, TravelSession } from './memory/types'
import type { TravelDraft } from './travel/types'
import type { Scored } from './types'
import type { MockFlightOption, MockHotelOption, MockPackageOption } from './travel/types'
import type { TripPlanSkeleton } from './planner/TripPlanner'
import type { TimelineItem } from './timeline/TimelineBuilder'
import type { PriceBand } from './pricing/PricingEstimator'
import type { LocaleCode } from './types'
import type { TravelBrain } from './TravelBrain'

export type BrainRecommendationsBundle = {
  flights: Scored<MockFlightOption>[]
  hotels: Scored<MockHotelOption>[]
  packages: Scored<MockPackageOption>[]
  activities: Array<{ id: string; title: string; body: string }>
  restaurants: Array<{ id: string; title: string; body: string }>
}

export type BrainTurnTrace = {
  userText: string
  intent: DetectedIntent
  entities: ExtractedEntities
  references: ResolvedReference[]
  draft: TravelDraft
  safety: SafetyVerdict
  reasoner: ReasonerReport
  decision: BrainDecision
  preferences: UserPreferenceProfile
  recommendations: BrainRecommendationsBundle
  plan: TripPlanSkeleton
  timeline: TimelineItem[]
  pricing: PriceBand
  reply: string
  travelSession: TravelSession
  shortTerm: ShortTermMemory
}

function mockActivities(destination?: string) {
  const city = destination ?? 'your city'
  return [
    {
      id: 'act-1',
      title: `Soft morning in ${city}`,
      body: 'A calm walk and landmark introduction — never rushed.',
    },
    {
      id: 'act-2',
      title: 'Quiet cultural hour',
      body: 'Museum or gallery with soft pacing for your party.',
    },
  ]
}

function mockRestaurants(destination?: string) {
  const city = destination ?? 'town'
  return [
    {
      id: 'rst-1',
      title: `Harbor table · ${city}`,
      body: 'Refined local kitchen, early seating available.',
    },
    {
      id: 'rst-2',
      title: 'Courtyard supper',
      body: 'Intimate room, excellent for conversation.',
    },
  ]
}

export function processBrainTurn(
  brain: TravelBrain,
  text: string,
  locale?: LocaleCode,
): BrainTurnTrace {
  const snap = brain.conversation.ingestTurn({ text, locale })
  const entities = brain.conversation.entities.extract(text)
  const intent = brain.conversation.intents.recognize(text)
  const references = brain.context.resolve(text, snap.shortTerm, snap.draft)
  const draft = brain.context.applyResolutions(
    { ...snap.draft, ...mergeEntities(snap.draft, entities) },
    references,
  )

  const safety = brain.safety.assess({
    text,
    intentId: intent.id,
    intentConfidence: intent.confidence,
    draft,
  })
  const reasoner = brain.reasoner.reason(draft)
  const decision = brain.decision.decide({
    intentId: intent.id,
    intentConfidence: intent.confidence,
    safety,
    reasoner,
  })

  const preferences = brain.conversation.preferences.getProfile()
  const goals = preferences.travelStyle !== 'unknown' ? [preferences.travelStyle] : []
  const flights = brain.recommendations.rankFlights(draft, preferences, goals)
  const hotels = brain.recommendations.rankHotels(draft, preferences)
  const packages = brain.recommendations.rankPackages(draft, preferences)
  const recommendations: BrainRecommendationsBundle = {
    flights,
    hotels,
    packages,
    activities: mockActivities(draft.destination),
    restaurants: mockRestaurants(draft.destination),
  }

  const optionIds = [
    ...flights.slice(0, 2).map((f) => f.item.id),
    ...hotels.slice(0, 1).map((h) => h.item.id),
  ]
  const shortTerm = brain.context.rememberOptions(
    { ...snap.shortTerm, activeDraft: draft },
    optionIds,
  )
  brain.conversation.memory.updateShortTerm(snap.travelSession.id, shortTerm)
  brain.conversation.sessions.updateTravelSession(snap.travelSession.id, {
    draft,
    shortTerm,
  })

  const plan = brain.planner.plan(draft)
  const timeline = brain.timeline.build(plan, draft.departureDate?.startsWith('20')
    ? draft.departureDate
    : undefined)
  const pricing = brain.pricing.estimate(draft)

  const body =
    decision.action === 'route_tool'
      ? buildRecommendBody(recommendations, intent.locale)
      : safety.message

  const reply = brain.personality.shape({
    locale: locale ?? intent.locale,
    intentLabel: brain.personality.intentLabel(intent.id, locale ?? intent.locale),
    body,
    safetyMessage: decision.action === 'route_tool' ? undefined : safety.message,
  }).text

  const travelSession = brain.conversation.getTravelSession() ?? snap.travelSession

  return {
    userText: text,
    intent,
    entities,
    references,
    draft,
    safety,
    reasoner,
    decision,
    preferences,
    recommendations,
    plan,
    timeline,
    pricing,
    reply,
    travelSession,
    shortTerm,
  }
}

function mergeEntities(draft: TravelDraft, entities: ExtractedEntities): TravelDraft {
  return {
    ...draft,
    origin: entities.origin ?? draft.origin,
    destination: entities.destination ?? draft.destination,
    departureDate: entities.dates?.departure ?? draft.departureDate,
    returnDate: entities.dates?.return ?? draft.returnDate,
    durationNights: entities.duration ?? draft.durationNights,
    budgetAmount: entities.budget ?? draft.budgetAmount,
    currency: entities.currency ?? draft.currency,
    travellers: entities.travellers ?? draft.travellers,
    hotelClass: entities.hotelClass ?? draft.hotelClass,
    airline: entities.airline ?? draft.airline,
    visaCountry: entities.visaCountry ?? draft.visaCountry,
    transportType: entities.transportType ?? draft.transportType,
    language: entities.language ?? draft.language,
    specialNeeds: entities.specialNeeds ?? draft.specialNeeds,
  }
}

function buildRecommendBody(bundle: BrainRecommendationsBundle, locale: LocaleCode): string {
  const top = bundle.flights[0] ?? bundle.packages[0]
  if (!top) {
    return locale === 'ar'
      ? 'جهّزت اقتراحات أولية بهدوء — يمكننا ضبطها معاً.'
      : 'I prepared calm starter options — we can refine together.'
  }
  const score = top.score.toFixed(2)
  return locale === 'ar'
    ? `أفضل خيار حالياً بدرجة ${score}. راجع البطاقات بالأسفل.`
    : `Top match scores ${score}. Review the cards below.`
}
