/**
 * Step 8 — Brain pipeline module selection.
 */

import type { AgentMemory } from '../../agent/types'
import type { ExtractionResult } from '../../agent/extractRequirements'
import type {
  BrainModuleId,
  ConversationUnderstanding,
} from './types'

export function selectModulesToExecute(input: {
  understanding: ConversationUnderstanding
  memory: AgentMemory
  extracted: ExtractionResult
  reasoningEnabled: boolean
  clarificationEnabled: boolean
  preferenceMemoryEnabled: boolean
}): BrainModuleId[] {
  const modules: BrainModuleId[] = ['memory']

  if (input.preferenceMemoryEnabled) {
    modules.push('preferences')
  }

  if (input.clarificationEnabled) {
    modules.push('clarification')
  }

  const discovery = input.understanding.travelContext.discoveryMode
    || input.extracted.intent === 'discover'
    || input.memory.requirements.destinationFlexible === true

  if (input.reasoningEnabled && discovery && !input.memory.tripPlan) {
    modules.push('destination_discovery', 'climate', 'reasoning', 'visa', 'advisory', 'ranking', 'executive', 'budget')
  }

  if (input.memory.requirements.destination && !input.memory.tripPlan) {
    modules.push('planning')
  }

  return [...new Set(modules)]
}
