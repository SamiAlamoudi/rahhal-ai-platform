/**
 * Phase 5 — ConversationPlanner
 * Plans the reasoning pipeline stages before reply.
 */

import type { ReasoningStageTrace } from './types'

export function planConversationStages(): ReasoningStageTrace[] {
  return [
    { id: 'memory', label: 'Conversation Memory', detail: 'pending', confidence: 'medium', source: 'llm' },
    { id: 'context', label: 'Context Builder', detail: 'pending', confidence: 'medium', source: 'llm' },
    { id: 'intent', label: 'Intent', detail: 'pending', confidence: 'medium', source: 'llm' },
    { id: 'entities', label: 'Entities', detail: 'pending', confidence: 'medium', source: 'llm' },
    { id: 'travel_reasoning', label: 'Travel Reasoning', detail: 'pending', confidence: 'medium', source: 'llm' },
    { id: 'tool_decision', label: 'Tool Decision', detail: 'pending', confidence: 'medium', source: 'llm' },
    { id: 'compose', label: 'Compose Answer', detail: 'pending', confidence: 'medium', source: 'llm' },
    { id: 'confidence', label: 'Confidence', detail: 'pending', confidence: 'medium', source: 'llm' },
  ]
}

export function updateStage(
  stages: ReasoningStageTrace[],
  id: ReasoningStageTrace['id'],
  patch: Partial<ReasoningStageTrace>,
): ReasoningStageTrace[] {
  return stages.map((s) => (s.id === id ? { ...s, ...patch } : s))
}

export const ConversationPlanner = {
  plan: planConversationStages,
  updateStage,
}
