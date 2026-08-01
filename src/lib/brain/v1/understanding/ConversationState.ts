/**
 * Sprint 89 Phase 1 — ConversationState continuity helpers.
 * Maps Brain cognitive states ↔ PreviewConversationStage ↔ CM lifecycle.
 * Tracks known slots and removes superseded values on correction.
 * Internal only — never expose state names to travelers.
 */

import type { ConversationLifecycleState, ConversationSession } from '../conversation/types'
import type { PreviewConversationStage } from '../contracts/previewContracts'
import type { BrainV1Entities } from '../types'
import type {
  BrainCognitiveState,
  ConsultantIntent,
  ConversationKnownSlots,
  ConversationStateSnapshot,
} from './types'
import { UNDERSTANDING_CONTRACT_VERSION } from './types'

export function emptyKnownSlots(): ConversationKnownSlots {
  return {
    destination: null,
    origin: null,
    startDate: null,
    endDate: null,
    adults: null,
    children: null,
    travelerCount: null,
    budget: null,
  }
}

export function knownSlotsFromEntities(
  entities: Partial<BrainV1Entities> | null | undefined,
): ConversationKnownSlots {
  return {
    destination: entities?.destination ?? null,
    origin: entities?.origin ?? null,
    startDate: entities?.travelDates?.start ?? null,
    endDate: entities?.travelDates?.end ?? null,
    adults: entities?.adults ?? null,
    children: entities?.children ?? null,
    travelerCount: entities?.travelerCount ?? null,
    budget: entities?.budget ?? null,
  }
}

/**
 * Merge prior known slots with new entity values.
 * Corrections replace fields; superseded prior values are listed (not retained).
 */
export function mergeKnownSlots(
  prior: ConversationKnownSlots | null | undefined,
  nextEntities: Partial<BrainV1Entities>,
  options?: { isCorrection?: boolean; revisedFields?: string[] },
): { knownSlots: ConversationKnownSlots; supersededFields: string[] } {
  const base = prior ? { ...prior } : emptyKnownSlots()
  const next = knownSlotsFromEntities(nextEntities)
  const supersededFields: string[] = []
  const revised = new Set(options?.revisedFields ?? [])

  const assign = <K extends keyof ConversationKnownSlots>(
    key: K,
    value: ConversationKnownSlots[K],
    entityFieldAliases: string[],
  ) => {
    if (value == null) return
    const changed = base[key] != null && base[key] !== value
    const touched =
      options?.isCorrection
      || entityFieldAliases.some((f) => revised.has(f))
      || base[key] == null
    if (!touched && base[key] != null) return
    if (changed) supersededFields.push(String(key))
    base[key] = value
  }

  assign('destination', next.destination, ['destination'])
  assign('origin', next.origin, ['origin'])
  assign('startDate', next.startDate, ['travelDates.start'])
  assign('endDate', next.endDate, ['travelDates.end'])
  assign('adults', next.adults, ['adults'])
  assign('children', next.children, ['children'])
  assign('travelerCount', next.travelerCount, ['travelerCount', 'adults'])
  assign('budget', next.budget, ['budget'])

  // Date correction cleared end (null fact or start-only replace): drop superseded end.
  if (
    base.endDate != null
    && next.endDate == null
    && (revised.has('travelDates.end')
      || ((options?.isCorrection || revised.has('travelDates.start'))
        && revised.has('travelDates.start')))
  ) {
    if (!supersededFields.includes('endDate')) supersededFields.push('endDate')
    base.endDate = null
  }

  return { knownSlots: base, supersededFields }
}

export function mapLifecycleToBrainState(
  lifecycle: ConversationLifecycleState | null | undefined,
): BrainCognitiveState {
  switch (lifecycle) {
    case 'idle':
      return 'Idle'
    case 'greeting':
      return 'Listening'
    case 'collecting':
      return 'Clarifying'
    case 'waiting_user':
      return 'Waiting'
    case 'revising':
      return 'Understanding'
    case 'paused':
      return 'Waiting'
    case 'resumed':
      return 'Understanding'
    case 'topic_switch':
      return 'Understanding'
    case 'summarizing':
      return 'Advising'
    case 'ready':
      return 'Advising'
    case 'completed':
      return 'Finished'
    case 'restarted':
      return 'Listening'
    case 'value_first':
      return 'Advising'
    default:
      return 'Idle'
  }
}

export function mapBrainStateToPreviewStage(
  brainState: BrainCognitiveState,
): PreviewConversationStage {
  switch (brainState) {
    case 'Idle':
      return 'idle'
    case 'Listening':
      return 'greeting'
    case 'Understanding':
    case 'Reasoning':
      return 'exploring'
    case 'Clarifying':
    case 'Waiting':
      return 'refining'
    case 'Searching':
      return 'searching'
    case 'Comparing':
      return 'comparing'
    case 'Planning':
    case 'Advising':
      return 'exploring'
    case 'Finished':
      return 'paused'
    case 'Recovery':
      return 'recovered'
    default:
      return 'fallback'
  }
}

export function mapPreviewStageToBrainState(
  stage: PreviewConversationStage,
): BrainCognitiveState {
  switch (stage) {
    case 'idle':
      return 'Idle'
    case 'greeting':
      return 'Listening'
    case 'exploring':
      return 'Understanding'
    case 'refining':
      return 'Clarifying'
    case 'searching':
      return 'Searching'
    case 'comparing':
      return 'Comparing'
    case 'ready_for_booking':
      return 'Finished'
    case 'paused':
      return 'Finished'
    case 'recovered':
      return 'Recovery'
    case 'fallback':
      return 'Recovery'
    default:
      return 'Idle'
  }
}

export function createConversationStateSnapshot(input: {
  conversationId: string
  locale: 'ar' | 'en'
  brainState?: BrainCognitiveState
  previewStage?: PreviewConversationStage
  turnIndex?: number
  pendingClarification?: boolean
  activeTripId?: string | null
  lastConsultantIntent?: ConsultantIntent | null
  session?: ConversationSession | null
  knownSlots?: ConversationKnownSlots
  supersededFields?: string[]
}): ConversationStateSnapshot {
  const fromSession = input.session
    ? mapLifecycleToBrainState(input.session.state)
    : null
  const brainState = input.brainState ?? fromSession ?? 'Idle'
  const previewStage = input.previewStage ?? mapBrainStateToPreviewStage(brainState)
  return {
    contractVersion: UNDERSTANDING_CONTRACT_VERSION,
    brainState,
    previewStage,
    conversationId: input.conversationId,
    turnIndex: input.turnIndex ?? (input.session?.turns.length ?? 0),
    pendingClarification: input.pendingClarification ?? Boolean(input.session?.pendingSlots.length),
    activeTripId: input.activeTripId ?? input.session?.plan?.planId ?? null,
    locale: input.locale,
    lastConsultantIntent: input.lastConsultantIntent ?? null,
    knownSlots: input.knownSlots ?? emptyKnownSlots(),
    supersededFields: input.supersededFields ?? [],
  }
}

/**
 * Advance cognitive state after an understanding turn (Phase 1 only).
 * Abort preserves knownSlots from prior. Corrections merge and drop superseded values.
 * Does not enter Searching — Search Handoff / tools are out of Phase 1.
 */
export function advanceUnderstandingState(
  prior: ConversationStateSnapshot | null | undefined,
  input: {
    conversationId: string
    locale: 'ar' | 'en'
    consultantIntent: ConsultantIntent
    hasAmbiguousReferences: boolean
    hasEntityRevisions: boolean
    session?: ConversationSession | null
    entities?: Partial<BrainV1Entities> | null
    revisedFields?: string[]
  },
): ConversationStateSnapshot {
  let brainState: BrainCognitiveState = 'Understanding'
  if (input.consultantIntent === 'abort') brainState = 'Finished'
  else if (input.consultantIntent === 'small_talk') brainState = 'Listening'
  else if (input.hasAmbiguousReferences) brainState = 'Clarifying'
  else if (input.consultantIntent === 'correct' || input.hasEntityRevisions) {
    brainState = 'Understanding'
  } else if (
    input.consultantIntent === 'advise'
    || input.consultantIntent === 'explore_destination'
    || input.consultantIntent === 'plan_trip'
  ) {
    brainState = 'Understanding'
  }

  // Abort / cancel: keep confirmed known slots — never wipe on cancel intent.
  if (input.consultantIntent === 'abort') {
    return createConversationStateSnapshot({
      conversationId: input.conversationId,
      locale: input.locale,
      brainState,
      turnIndex: (prior?.turnIndex ?? 0) + 1,
      pendingClarification: false,
      activeTripId: prior?.activeTripId ?? input.session?.plan?.planId ?? null,
      lastConsultantIntent: input.consultantIntent,
      session: input.session,
      knownSlots: prior?.knownSlots ? { ...prior.knownSlots } : emptyKnownSlots(),
      supersededFields: [],
    })
  }

  const merged = mergeKnownSlots(
    prior?.knownSlots,
    input.entities ?? {},
    {
      isCorrection: input.consultantIntent === 'correct',
      revisedFields: input.revisedFields,
    },
  )

  return createConversationStateSnapshot({
    conversationId: input.conversationId,
    locale: input.locale,
    brainState,
    turnIndex: (prior?.turnIndex ?? 0) + 1,
    pendingClarification: input.hasAmbiguousReferences || (prior?.pendingClarification ?? false),
    activeTripId: prior?.activeTripId ?? input.session?.plan?.planId ?? null,
    lastConsultantIntent: input.consultantIntent,
    session: input.session,
    knownSlots: merged.knownSlots,
    supersededFields: merged.supersededFields,
  })
}
