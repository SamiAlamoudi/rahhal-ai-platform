/**
 * Conversation Brain validation contracts — pure builders.
 * No runtime validation execution.
 */

import type {
  ConversationBrainValidationContract,
  ConversationBrainRevisionContract,
  ConversationBrainSnapshotContract,
} from './types'
import {
  buildConversationBrainSnapshotSample,
  buildConversationBrainValidationSample,
} from './schema'

export function buildConversationBrainValidationContract(): ConversationBrainValidationContract {
  return {
    kind: 'phase7_conversation_brain_validation_contract',
    validation: buildConversationBrainValidationSample(),
    execution: 'none',
  }
}

export function buildConversationBrainSnapshotContract(): ConversationBrainSnapshotContract {
  return {
    kind: 'phase7_conversation_brain_snapshot_contract',
    snapshot: buildConversationBrainSnapshotSample(),
    execution: 'none',
  }
}

export function buildConversationBrainRevisionContract(): ConversationBrainRevisionContract {
  return {
    kind: 'phase7_conversation_brain_revision_contract',
    revisions: [],
    persisted: false,
    execution: 'none',
  }
}
