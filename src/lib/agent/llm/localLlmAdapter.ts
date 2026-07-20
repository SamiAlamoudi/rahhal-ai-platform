import type {
  AgentLlmProvider,
  AgentLlmResponse,
  ConversationLlmRequest,
  ConversationLlmResponse,
} from './types'
import { generateLocalConversation } from '../conversationBrain/localConversationModel'
import type { TravelFacts } from '../conversationBrain/travelFacts'

/**
 * Local LLM adapter — Conversation Brain generative fallback (no API key).
 * Parses Travel Facts from the conversation payload when present; otherwise
 * returns a minimal general reply. Remote OpenAI is preferred when configured.
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
    async converse(request: ConversationLlmRequest): Promise<ConversationLlmResponse> {
      const userContent = [...request.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
      const facts = extractFactsFromPayload(userContent)
      const conversationId = 'local'
      const userMessage = extractLatestUserMessage(userContent)
      if (facts) {
        const generated = generateLocalConversation({
          facts,
          userMessage,
          conversationId,
        })
        return {
          providerId: 'local',
          status: 'ok',
          text: JSON.stringify({
            displayText: generated.displayText,
            spokenText: generated.spokenText,
          }),
        }
      }
      return {
        providerId: 'local',
        status: 'ok',
        text: JSON.stringify({
          displayText: userMessage
            ? `I hear you — ${userMessage.slice(0, 80)}. Tell me a little more about the trip.`
            : 'Tell me a little more about the trip you are planning.',
          spokenText: 'Tell me a little more about the trip you are planning.',
        }),
      }
    },
  }
}

function extractFactsFromPayload(payload: string): TravelFacts | null {
  const marker = 'Travel Facts (structured — not prose):'
  const idx = payload.indexOf(marker)
  if (idx < 0) return null
  const after = payload.slice(idx + marker.length).trim()
  const endMarkers = [
    '\nUser profile',
    '\nRecent conversation:',
    '\nLatest user message:',
  ]
  let end = after.length
  for (const m of endMarkers) {
    const at = after.indexOf(m)
    if (at >= 0 && at < end) end = at
  }
  const json = after.slice(0, end).trim()
  try {
    return JSON.parse(json) as TravelFacts
  } catch {
    return null
  }
}

function extractLatestUserMessage(payload: string): string {
  const marker = 'Latest user message:'
  const idx = payload.indexOf(marker)
  if (idx < 0) return ''
  return payload.slice(idx + marker.length).trim()
}
