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
 * Parses Travel Facts / Trip State from the conversation payload when present.
 * Remote OpenAI is preferred when configured.
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
        const text = JSON.stringify({
          displayText: generated.displayText,
          spokenText: generated.spokenText,
        })
        request.onDelta?.(text)
        return {
          providerId: 'local',
          status: 'ok',
          text,
        }
      }
      const text = JSON.stringify({
        displayText: userMessage
          ? `Understood. What is the one detail still blocking the plan?`
          : 'What is the one detail still blocking the plan?',
        spokenText: 'What is the one detail still blocking the plan?',
      })
      request.onDelta?.(text)
      return {
        providerId: 'local',
        status: 'ok',
        text,
      }
    },
  }
}

function extractFactsFromPayload(payload: string): TravelFacts | null {
  const markers = [
    '=== TRIP STATE (source of truth) ===',
    'Travel Facts / Trip State / Memory / Preferences (source of truth):',
    'Travel Facts (source of truth — never contradict or re-ask known fields):',
    'Travel Facts (structured — not prose):',
  ]
  let idx = -1
  let markerLen = 0
  for (const marker of markers) {
    const at = payload.indexOf(marker)
    if (at >= 0) {
      idx = at
      markerLen = marker.length
      break
    }
  }
  if (idx < 0) return null
  const after = payload.slice(idx + markerLen).trim()
  const endMarkers = [
    '\n=== MEMORY',
    '\n=== USER PROFILE',
    '\n=== CONVERSATION CONTEXT',
    '\n=== RESPONSE CONTRACT',
    '\n=== SPEAKER OPTIMIZATION',
    '\n=== LATEST USER MESSAGE',
    '\nUser profile',
    '\nConversation context (recent turns):',
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
  const markers = ['=== LATEST USER MESSAGE ===', 'Latest user message:']
  for (const marker of markers) {
    const idx = payload.indexOf(marker)
    if (idx < 0) continue
    const body = payload.slice(idx + marker.length).trim()
    const cut = body.split(/\n(?:Write the next|Response contract reminder|=== )/i)[0] ?? body
    return cut.trim()
  }
  return ''
}
