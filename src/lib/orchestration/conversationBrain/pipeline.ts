/**
 * Conversation Brain pipeline contracts — pure builders.
 * Declarative stage list only; no engine invocation.
 */

import type { ConversationBrainPipelineContract } from './types'
import { CONVERSATION_BRAIN_PIPELINE_STAGES } from './types'

export function buildConversationBrainPipeline(): ConversationBrainPipelineContract {
  return {
    kind: 'phase7_conversation_brain_pipeline',
    stages: CONVERSATION_BRAIN_PIPELINE_STAGES,
    execution: 'none',
  }
}
