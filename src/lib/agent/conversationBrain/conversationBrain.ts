/**
 * Conversation-First — Conversation Brain.
 * OpenAI ChatGPT authors user-facing language from Rahhal-injected context.
 * Local generative model is the offline/fallback path only.
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

export type ConversationBrainDelta = {
  displayText: string
  spokenText: string
  raw: string
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

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\t/g, '\t')
}

/** Best-effort extraction of a JSON string field from a partial model stream. */
function extractPartialJsonStringField(raw: string, field: string): string | null {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`)
  const match = raw.match(re)
  if (match?.[1] != null) return unescapeJsonString(match[1])
  // Incomplete trailing string while streaming
  const open = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)$`)
  const partial = raw.match(open)
  if (partial?.[1] != null) return unescapeJsonString(partial[1])
  return null
}

export function optimizeSpokenText(spoken: string, displayFallback: string, locale?: string): string {
  let text = (spoken || displayFallback || '').trim()
  if (!text) return ''
  // Strip markdown / list chrome that sounds bad in TTS.
  text = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[\s]*[-*•]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  const maxChars = locale === 'ar' ? 280 : 320
  if (text.length <= maxChars) return text

  const sentenceSplit = text.split(/(?<=[.!?؟。！？])\s+/)
  let built = ''
  for (const sentence of sentenceSplit) {
    const next = built ? `${built} ${sentence}` : sentence
    if (next.length > maxChars) break
    built = next
    if (built.split(/(?<=[.!?؟。！？])\s+/).filter(Boolean).length >= 3) break
  }
  if (built) return built.trim()
  return `${text.slice(0, maxChars - 1).trim()}…`
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
    const displayText = extractPartialJsonStringField(body, 'displayText')
      ?? extractPartialJsonStringField(body, 'reply')
    const spokenText = extractPartialJsonStringField(body, 'spokenText')
    if (displayText?.trim()) {
      return {
        displayText: displayText.trim(),
        spokenText: (spokenText ?? displayText).trim(),
      }
    }
    if (!trimmed) return null
    const spoken = trimmed.split(/\n+/).map((l) => l.trim()).filter(Boolean)[0] ?? trimmed
    return {
      displayText: trimmed,
      spokenText: spoken.slice(0, 360),
    }
  }
}

function buildTripStateJson(facts: TravelFacts): string {
  return JSON.stringify(
    {
      locale: facts.locale,
      objective: facts.objective,
      known: facts.known,
      missingSlots: facts.missingSlots,
      plan: facts.plan ?? null,
      planningDraft: facts.planningDraft ?? null,
      warnings: facts.warnings ?? [],
      recommendations: facts.recommendations ?? [],
      optionHints: facts.optionHints ?? [],
    },
    null,
    2,
  )
}

function buildMemoryJson(facts: TravelFacts): string {
  return JSON.stringify(
    {
      locale: facts.locale,
      known: facts.known,
      missingSlots: facts.missingSlots,
      softSignals: facts.softSignals ?? {},
      heardSummary: facts.heardSummary ?? [],
    },
    null,
    2,
  )
}

export async function runConversationBrain(input: {
  llms: AgentLlmRegistry
  conversationId: string
  messages: ChatMessage[]
  facts: TravelFacts
  userProfile?: Record<string, unknown> | null
  signal?: AbortSignal
  onDelta?: (partial: ConversationBrainDelta) => void
}): Promise<ConversationBrainResult> {
  const userMessage = latestUserText(input.messages)
  const factsJson = JSON.stringify(input.facts, null, 2)
  const payload = buildConversationUserPayload({
    objective: input.facts.objective,
    factsJson,
    tripStateJson: buildTripStateJson(input.facts),
    memoryJson: buildMemoryJson(input.facts),
    recentHistory: historyLines(input.messages),
    userProfileJson: input.userProfile ? JSON.stringify(input.userProfile) : undefined,
    currentUserMessage: userMessage,
  })

  const llm = input.llms.getActive()

  // Local fallback — keep deterministic generative model (no HTTP).
  if (llm.providerId === 'local') {
    const local = generateLocalConversation({
      facts: input.facts,
      userMessage,
      conversationId: input.conversationId,
    })
    const spokenText = optimizeSpokenText(
      local.spokenText,
      local.displayText,
      input.facts.locale,
    )
    const result = {
      displayText: local.displayText,
      spokenText,
      providerId: llm.providerId,
    }
    input.onDelta?.({
      displayText: result.displayText,
      spokenText: result.spokenText,
      raw: JSON.stringify({
        displayText: result.displayText,
        spokenText: result.spokenText,
      }),
    })
    return result
  }

  if (typeof llm.converse === 'function') {
    let lastEmittedDisplay = ''
    const result = await llm.converse({
      systemPrompt: RAHHAL_CONVERSATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: payload }],
      signal: input.signal,
      temperature: 0.85,
      stream: true,
      onDelta: input.onDelta
        ? (accumulated) => {
          const parsed = parseModelJson(accumulated)
          if (!parsed) return
          const spokenText = optimizeSpokenText(
            parsed.spokenText,
            parsed.displayText,
            input.facts.locale,
          )
          // Emit when display grows so the UI can stream tokens / phrases.
          if (parsed.displayText !== lastEmittedDisplay) {
            lastEmittedDisplay = parsed.displayText
            input.onDelta?.({
              displayText: parsed.displayText,
              spokenText,
              raw: accumulated,
            })
          }
        }
        : undefined,
    })
    if (result.status === 'ok' && result.text.trim()) {
      const parsed = parseModelJson(result.text)
      if (parsed) {
        const spokenText = optimizeSpokenText(
          parsed.spokenText,
          parsed.displayText,
          input.facts.locale,
        )
        return {
          displayText: parsed.displayText,
          spokenText,
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
  const spokenText = optimizeSpokenText(
    local.spokenText,
    local.displayText,
    input.facts.locale,
  )
  return {
    displayText: local.displayText,
    spokenText,
    providerId: llm.providerId,
  }
}
