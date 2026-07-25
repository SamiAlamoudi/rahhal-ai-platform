/**
 * Conversation Brain schema contracts — pure builders.
 * TypeScript interfaces only; no persistence.
 */

import type {
  ConversationBrainConfidence,
  ConversationBrainDecision,
  ConversationBrainRequest,
  ConversationBrainResult,
  ConversationBrainRevision,
  ConversationBrainSchemaContract,
  ConversationBrainSnapshot,
  ConversationBrainState,
  ConversationBrainStep,
  ConversationBrainValidation,
} from './types'
import { CONVERSATION_BRAIN_ENGINE_HINTS } from './types'

const ISO = '2026-07-25T00:00:00.000Z'
const REQUEST_ID = 'cbr-architecture'

export function buildConversationBrainSchema(): ConversationBrainSchemaContract {
  return {
    kind: 'phase7_conversation_brain_schema',
    outputKinds: [
      'phase7_conversation_brain_request',
      'phase7_conversation_brain_state',
      'phase7_conversation_brain_step',
      'phase7_conversation_brain_decision',
      'phase7_conversation_brain_result',
      'phase7_conversation_brain_confidence',
      'phase7_conversation_brain_validation',
      'phase7_conversation_brain_snapshot',
      'phase7_conversation_brain_revision',
    ],
    execution: 'none',
  }
}

export function buildConversationBrainRequestSample(): ConversationBrainRequest {
  return {
    kind: 'phase7_conversation_brain_request',
    requestId: REQUEST_ID,
    messageHint: 'user_message_placeholder',
    localeHint: 'ar',
    execution: 'none',
  }
}

export function buildConversationBrainStateSample(): ConversationBrainState {
  return {
    kind: 'phase7_conversation_brain_state',
    stateId: 'cbs-architecture',
    requestId: REQUEST_ID,
    currentStepHint: null,
    engineHints: CONVERSATION_BRAIN_ENGINE_HINTS,
    execution: 'none',
  }
}

export function buildConversationBrainStepSample(): ConversationBrainStep {
  return {
    kind: 'phase7_conversation_brain_step',
    stepId: 'cbstep-architecture',
    requestId: REQUEST_ID,
    engineHint: 'personalization_engine',
    statusHint: 'pending',
    execution: 'none',
  }
}

export function buildConversationBrainDecisionSample(): ConversationBrainDecision {
  return {
    kind: 'phase7_conversation_brain_decision',
    decisionId: 'cbdec-architecture',
    requestId: REQUEST_ID,
    decisionHint: 'architecture_placeholder',
    execution: 'none',
  }
}

export function buildConversationBrainResultSample(): ConversationBrainResult {
  return {
    kind: 'phase7_conversation_brain_result',
    resultId: 'cbres-architecture',
    requestId: REQUEST_ID,
    summaryHint: 'architecture_placeholder',
    architectureOnly: true,
    execution: 'none',
  }
}

export function buildConversationBrainConfidenceSample(): ConversationBrainConfidence {
  return {
    kind: 'phase7_conversation_brain_confidence',
    requestId: REQUEST_ID,
    scoreHint: 0,
    bandHint: 'medium',
    execution: 'none',
  }
}

export function buildConversationBrainValidationSample(): ConversationBrainValidation {
  return {
    kind: 'phase7_conversation_brain_validation',
    requestId: REQUEST_ID,
    valid: true,
    issues: [],
    execution: 'none',
  }
}

export function buildConversationBrainSnapshotSample(): ConversationBrainSnapshot {
  return {
    kind: 'phase7_conversation_brain_snapshot',
    snapshotId: 'cbsnap-architecture',
    atIso: ISO,
    requestId: REQUEST_ID,
    execution: 'none',
  }
}

export function buildConversationBrainRevisionSample(): ConversationBrainRevision {
  return {
    kind: 'phase7_conversation_brain_revision',
    revisionId: 'cbrev-architecture',
    requestId: REQUEST_ID,
    reasonHint: 'architecture_blueprint',
    execution: 'none',
  }
}
