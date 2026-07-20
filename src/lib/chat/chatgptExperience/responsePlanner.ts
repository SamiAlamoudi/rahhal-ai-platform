/**
 * Sprint 44 — Response Planner + Tool Decision Engine.
 * Builds an internal plan; never exposes it to the user.
 * Decides whether existing tools are needed — does not implement travel logic.
 */

import type { ChatGptIntent, ResponsePlan, ToolDecision } from './types'
import { logExperience } from './experienceLogger'

export function decideTools(intent: ChatGptIntent): ToolDecision {
  const started = Date.now()
  let decision: ToolDecision

  switch (intent) {
    case 'small_talk':
    case 'general_chat':
    case 'unknown':
      decision = { useTools: false, toolIds: [], reason: 'Conversational turn — no tools' }
      break
    case 'follow_up':
      decision = {
        useTools: true,
        toolIds: ['conversation_memory', 'unified_travel_planner'],
        reason: 'Follow-up may need prior plan context',
      }
      break
    case 'book_flight':
      decision = {
        useTools: true,
        toolIds: ['unified_travel_planner', 'flight_search'],
        reason: 'Flight intent requires existing search/planner tools',
      }
      break
    case 'search_hotels':
      decision = {
        useTools: true,
        toolIds: ['unified_travel_planner', 'hotel_search'],
        reason: 'Hotel intent requires existing search/planner tools',
      }
      break
    case 'create_itinerary':
      decision = {
        useTools: true,
        toolIds: ['unified_travel_planner', 'conversation_ui'],
        reason: 'Itinerary intent uses existing conversation planner',
      }
      break
    case 'visa_question':
      decision = {
        useTools: true,
        toolIds: ['travel_documents'],
        reason: 'Visa intent uses existing documents platform when available',
      }
      break
    case 'weather':
      decision = {
        useTools: true,
        toolIds: ['weather'],
        reason: 'Weather intent routes to existing weather capability',
      }
      break
    case 'pricing':
      decision = {
        useTools: true,
        toolIds: ['unified_travel_planner', 'pricing'],
        reason: 'Pricing intent uses existing cost helpers',
      }
      break
    case 'travel_advice':
      decision = {
        useTools: false,
        toolIds: [],
        reason: 'Advice can be conversational; tools optional',
      }
      break
    case 'tool_result':
      decision = {
        useTools: false,
        toolIds: [],
        reason: 'Interpreting prior tool output',
      }
      break
    default:
      decision = { useTools: false, toolIds: [], reason: 'Default: no tools' }
  }

  logExperience({
    stage: 'tool_routing',
    event: 'decision',
    durationMs: Date.now() - started,
    meta: {
      useTools: decision.useTools,
      toolIds: decision.toolIds,
      reason: decision.reason,
    },
  })
  return decision
}

export function buildResponsePlan(input: {
  intent: ChatGptIntent
  toolDecision: ToolDecision
}): ResponsePlan {
  const started = Date.now()
  const steps = input.toolDecision.useTools
    ? ([
        'understand_request',
        'determine_tools',
        'gather_information',
        'combine_results',
        'generate_response',
      ] as const)
    : (['understand_request', 'generate_response'] as const)

  const plan: ResponsePlan = {
    intent: input.intent,
    steps: [...steps],
    toolsRequired: input.toolDecision.useTools,
    toolIds: [...input.toolDecision.toolIds],
    reason: input.toolDecision.reason,
  }

  logExperience({
    stage: 'planning',
    event: 'plan_built',
    durationMs: Date.now() - started,
    meta: {
      intent: plan.intent,
      steps: plan.steps,
      toolsRequired: plan.toolsRequired,
      // Internal only — never shown to users.
      internal: true,
    },
  })
  return plan
}
