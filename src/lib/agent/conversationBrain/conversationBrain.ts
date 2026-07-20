/**
 * Experience Sprint 2 — Conversation Brain.
 * Owns all user-facing language. Travel Intelligence only supplies facts.
 */

import type { ChatMessage } from '../../chat/chatTypes'
import type { AgentLlmRegistry } from '../llm/types'
import {
  buildConversationUserPayload,
  RAHHAL_CONVERSATION_SYSTEM_PROMPT,
} from './systemPrompt'
import type { TravelFacts } from './travelFacts'
import { generateLocalConversation } from './localConversationModel'

export type ConversationBrainResult = {
  displayText: string
  spokenText: string
  providerId: string
}

function historyLines(messages: ChatMessage[], limit = 12): string {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-limit)
    .map((m) => `${m.role}: ${m.content.slice(0, 800)}`)
    .join('\n')
}

function latestUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') return messages[i]!.content
  }
  return ''
}

function parseModelJson(raw: string): { displayText: string; spokenText: string } | null {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced?.[1]?.trim() ?? trimmed
  try {
    const parsed = JSON.parse(body) as { displayText?: unknown; spokenText?: unknown; reply?: unknown }
    const displayText = String(parsed.displayText ?? parsed.reply ?? '').trim()
    const spokenText = String(parsed.spokenText ?? displayText).trim()
    if (!displayText) return null
    return { displayText, spokenText: spokenText || displayText }
  } catch {
    // Model returned prose — use as display; shorten for speech.
    if (!trimmed) return null
    const spoken = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0] ?? trimmed
    return {
      displayText: trimmed,
      spokenText: spoken.slice(0, 360),
    }
  }
}

export async function runConversationBrain(input: {
  llms: AgentLlmRegistry
  conversationId: string
  messages: ChatMessage[]
  facts: TravelFacts
  userProfile?: Record<string, unknown> | null
  signal?: AbortSignal
}): Promise<ConversationBrainResult> {
  const userMessage = latestUserText(input.messages)
  const factsJson = JSON.stringify(input.facts, null, 2)
  const payload = buildConversationUserPayload({
    objective: input.facts.objective,
    factsJson,
    recentHistory: historyLines(input.messages),
    userProfileJson: input.userProfile ? JSON.stringify(input.userProfile) : undefined,
    currentUserMessage: userMessage,
  })

  const llm = input.llms.getActive()
  if (typeof llm.converse === 'function') {
    const result = await llm.converse({
      systemPrompt: RAHHAL_CONVERSATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: payload }],
      signal: input.signal,
      temperature: 0.85,
    })
    if (result.status === 'ok' && result.text.trim()) {
      const parsed = parseModelJson(result.text)
      if (parsed) {
        return {
          displayText: parsed.displayText,
          spokenText: parsed.spokenText,
          providerId: result.providerId,
        }
      }
    }
  }

  // Guaranteed local generative path (also used when remote LLM fails).
  const local = generateLocalConversation({
    facts: input.facts,
    userMessage,
    conversationId: input.conversationId,
  })
  return {
    displayText: local.displayText,
    spokenText: local.spokenText,
    providerId: llm.providerId,
  }
}
