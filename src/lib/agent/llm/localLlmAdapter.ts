import type { AgentLlmProvider, AgentLlmResponse } from './types'

/**
 * Local rule-backed adapter used by the foundation agent.
 * Structured planning stays in travelAgentService; this adapter only signals availability.
 */
export function createLocalAgentLlmAdapter(): AgentLlmProvider {
  return {
    providerId: 'local',
    isAvailable: () => true,
    async complete(request): Promise<AgentLlmResponse> {
      return {
        providerId: 'local',
        status: 'ok',
        draft: {
          summary: request.memory.requirements.destination
            ? `Local planner for ${request.memory.requirements.destination}`
            : 'Local planner awaiting destination',
          notes: [],
        },
        assistantHint: null,
      }
    },
  }
}
