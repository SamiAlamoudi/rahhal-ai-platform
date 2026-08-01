/**
 * Sprint 89 Phase 1 — ConversationState continuity helpers.
 * Maps Brain cognitive states ↔ PreviewConversationStage ↔ CM lifecycle.
 * Internal only — never expose state names to travelers.
 */

import type { ConversationLifecycleState, ConversationSession } from '../conversation/types'
import type { PreviewConversationStage } from '../contracts/previewContracts'
import type {
  BrainCognitiveState,
  ConsultantIntent,
  ConversationStateSnapshot,
} from './types'
import { UNDERSTANDING_CONTRACT_VERSION } from './types'

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
  }
}

/**
 * Advance cognitive state after an understanding turn (Phase 1 only).
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

  return createConversationStateSnapshot({
    conversationId: input.conversationId,
    locale: input.locale,
    brainState,
    turnIndex: (prior?.turnIndex ?? 0) + 1,
    pendingClarification: input.hasAmbiguousReferences || (prior?.pendingClarification ?? false),
    activeTripId: prior?.activeTripId ?? input.session?.plan?.planId ?? null,
    lastConsultantIntent: input.consultantIntent,
    session: input.session,
  })
}
