/**
 * Phase 6 — ToolOrchestrator
 * Chooses tools dynamically from task + goal — never hardcoded interview scripts.
 */

import type { AgentToolId, MissionTask, ToolRouteDecision, TravelGoal } from './types'

const TASK_TOOL_MAP: Partial<Record<MissionTask['kind'], AgentToolId>> = {
  determine_season: 'weather',
  estimate_budget: 'currency',
  flight_strategy: 'flights',
  hotel_strategy: 'hotels',
  activities: 'activities',
  visa_check: 'visa',
  search: 'flights',
  compare: 'flights',
  build_itinerary: 'maps',
}

export function routeTool(input: {
  task: MissionTask | null
  goal: TravelGoal
  userText: string
}): ToolRouteDecision {
  const text = input.userText.toLowerCase()

  if (/emergency|طوارئ|lost passport|جواز/.test(text)) {
    return {
      tool: 'emergency',
      reason: 'Emergency cue in utterance',
      priority: 'urgent',
      fallbackTools: [],
    }
  }
  if (/visa|تأشير/.test(text)) {
    return {
      tool: 'visa',
      reason: 'Visa question',
      priority: 'high',
      fallbackTools: ['none'],
    }
  }
  if (/weather|طقس|typhoon/.test(text)) {
    return {
      tool: 'weather',
      reason: 'Weather question',
      priority: 'high',
      fallbackTools: [],
    }
  }
  if (/restaurant|مطعم|food/.test(text)) {
    return {
      tool: 'restaurants',
      reason: 'Dining intent',
      priority: 'normal',
      fallbackTools: ['activities'],
    }
  }
  if (/insurance|تأمين/.test(text)) {
    return {
      tool: 'insurance',
      reason: 'Insurance intent',
      priority: 'normal',
      fallbackTools: [],
    }
  }
  if (/transport|مترو|train|jr pass/.test(text)) {
    return {
      tool: 'transportation',
      reason: 'Local transport intent',
      priority: 'normal',
      fallbackTools: ['maps'],
    }
  }

  if (input.task) {
    const tool = input.task.tool !== 'none'
      ? input.task.tool
      : (TASK_TOOL_MAP[input.task.kind] ?? 'none')
    const fallback: AgentToolId[] =
      tool === 'flights' ? ['hotels'] : tool === 'hotels' ? ['flights'] : ['none']
    return {
      tool,
      reason: `Task ${input.task.kind} selected tool`,
      priority: input.task.priority,
      fallbackTools: fallback,
    }
  }

  if (input.goal.destination) {
    return {
      tool: 'flights',
      reason: 'Destination known — prepare flight search when ready',
      priority: 'normal',
      fallbackTools: ['hotels', 'weather'],
    }
  }

  return {
    tool: 'none',
    reason: 'Continue conversation — no tool yet',
    priority: 'deferred',
    fallbackTools: [],
  }
}

export const ToolOrchestrator = {
  route: routeTool,
}
