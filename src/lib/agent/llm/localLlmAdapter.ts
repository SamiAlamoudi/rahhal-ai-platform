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
            ? `Understood. What is the one detail still blocking the plan?`
            : 'What is the one detail still blocking the plan?',
          spokenText: 'What is the one detail still blocking the plan?',
        }),
      }
    },
  }
}

function extractFactsFromPayload(payload: string): TravelFacts | null {
  const markers = [
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
    '\nUser profile',
    '\nRecent conversation:',
    '\nLatest user message:',
    '\n</travel_facts>',
  ]
  let end = after.length
  for (const m of endMarkers) {
    const at = after.indexOf(m)
    if (at >= 0 && at < end) end = at
  }
  let json = after.slice(0, end).trim()
  // Sprint excellence — optional untrusted-data fences around Travel Facts JSON.
  if (json.startsWith('<travel_facts>')) {
    json = json.replace(/^<travel_facts>\s*/i, '').replace(/\s*<\/travel_facts>\s*$/i, '').trim()
  }
  // If the closing tag was used as an end marker, strip any leftover opener.
  if (json.startsWith('<travel_facts>')) {
    json = json.slice('<travel_facts>'.length).trim()
  }
  try {
    return JSON.parse(json) as TravelFacts
  } catch {
    return null
  }
}

function extractLatestUserMessage(payload: string): string {
  const fenced = payload.match(/<user_message>\s*([\s\S]*?)\s*<\/user_message>/i)
  if (fenced?.[1]) return fenced[1].trim()

  const marker = 'Latest user message:'
  const idx = payload.indexOf(marker)
  if (idx < 0) return ''
  const body = payload.slice(idx + marker.length).trim()
  // Drop trailing instruction line if present.
  const cut = body.split(/\nWrite the next advisor/i)[0] ?? body
  return cut.replace(/^<user_message>\s*/i, '').replace(/\s*<\/user_message>\s*$/i, '').trim()
}
