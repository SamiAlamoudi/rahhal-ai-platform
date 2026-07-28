/**
 * Conversation-First — Conversation Brain.
 * OpenAI authors 100% of traveler-facing language when remote is active.
 * Rahhal only orchestrates: stream tokens, strip markdown for TTS, inject facts/tools.
 * Local generative model is offline / explicit-local only — never used in the browser
 * traveler path (ChatGPT Voice parity).
 */

import type { ChatMessage } from '../../chat/chatTypes'
import type { AgentLlmRegistry } from '../llm/types'
import {
  buildConversationUserPayload,
  RAHHAL_CONVERSATION_SYSTEM_PROMPT,
} from './systemPrompt'
import type { TravelFacts } from './travelFacts'
import { generateLocalConversation } from './localConversationModel'
import {
  formatConsultantParagraphs,
  polishConsultantProse,
} from './consultantLocale'

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

/**
 * TTS orchestration only — strip markdown/list chrome that sounds bad aloud.
 * Never rewrites wording, never translates, never truncates for style.
 */
export function stripMarkdownForSpeech(text: string): string {
  return text
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
}

/**
 * Local-fallback speech shaping (polish + soft length cap).
 * Do NOT use on remote OpenAI output — that must pass through unchanged.
 */
export function optimizeSpokenText(spoken: string, displayFallback: string, locale?: string): string {
  const loc = locale === 'en' ? 'en' : 'ar'
  let text = (spoken || displayFallback || '').trim()
  if (!text) return ''
  text = stripMarkdownForSpeech(text)
  text = polishConsultantProse(text, loc)

  const maxChars = loc === 'ar' ? 320 : 360
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

/**
 * Local-fallback display shaping. Do NOT use on remote OpenAI output.
 */
export function optimizeDisplayText(display: string, locale?: string): string {
  const loc = locale === 'en' ? 'en' : 'ar'
  return formatConsultantParagraphs(polishConsultantProse(display, loc))
}

/** Remote OpenAI: display text is the model’s words, unchanged. */
function passthroughDisplayText(display: string): string {
  return display.trim()
}

/** Remote OpenAI: spoken text is the model’s words; TTS strip only. */
function passthroughSpokenText(spoken: string, displayFallback: string): string {
  const raw = (spoken || displayFallback || '').trim()
  if (!raw) return ''
  return stripMarkdownForSpeech(raw) || raw
}

/**
 * Extract traveler-facing utterance from model output.
 * ChatGPT Voice path: plain prose is used verbatim.
 * Legacy JSON { displayText, spokenText } is still accepted if a model returns it.
 */
export function extractRemoteUtterance(raw: string): { displayText: string; spokenText: string } | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced?.[1]?.trim() ?? trimmed

  // Legacy JSON object (older prompts) — accept but do not require.
  if (body.startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as {
        displayText?: unknown
        spokenText?: unknown
        reply?: unknown
      }
      const displayText = String(parsed.displayText ?? parsed.reply ?? '').trim()
      const spokenText = String(parsed.spokenText ?? displayText).trim()
      if (displayText) {
        return { displayText, spokenText: spokenText || displayText }
      }
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
    }
  }

  // Verbatim natural prose (ChatGPT Voice).
  return {
    displayText: trimmed,
    spokenText: trimmed,
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

/**
 * @param mode `remote` — OpenAI owns every word (no polish, no local-guard replace).
 *             `local` — offline generative model; polish allowed.
 */
function finalizeBrainResult(
  displayRaw: string,
  spokenRaw: string,
  providerId: string,
  mode: 'remote' | 'local',
  locale?: string,
): ConversationBrainResult {
  if (mode === 'remote') {
    return {
      displayText: passthroughDisplayText(displayRaw),
      spokenText: passthroughSpokenText(spokenRaw, displayRaw),
      providerId,
    }
  }

  return {
    displayText: optimizeDisplayText(displayRaw, locale),
    spokenText: optimizeSpokenText(spokenRaw, displayRaw, locale),
    providerId,
  }
}

function isBrowserTravelerPath(): boolean {
  return typeof window !== 'undefined'
}

function remoteUnavailableReply(locale: string | undefined, providerId: string): ConversationBrainResult {
  const ar = locale !== 'en'
  const reconnect = ar
    ? 'لحظة، فيه انقطاع بسيط بالمستشار الصوتي. نكمّل معكم بنفس النبرة حال ما يرجع الاتصال.'
    : 'One moment — the voice consultant connection dropped. We’ll continue naturally as soon as it’s back.'
  return {
    displayText: reconnect,
    spokenText: reconnect,
    providerId: `${providerId}+unavailable`,
  }
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

  // Browser traveler path must never hear local canned Arabic templates.
  if (llm.providerId === 'local') {
    if (isBrowserTravelerPath()) {
      const unavailable = remoteUnavailableReply(input.facts.locale, 'openai')
      input.onDelta?.({
        displayText: unavailable.displayText,
        spokenText: unavailable.spokenText,
        raw: unavailable.displayText,
      })
      return unavailable
    }
    const local = generateLocalConversation({
      facts: input.facts,
      userMessage,
      conversationId: input.conversationId,
    })
    const result = finalizeBrainResult(
      local.displayText,
      local.spokenText,
      llm.providerId,
      'local',
      input.facts.locale,
    )
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
      temperature: 0.9,
      stream: true,
      onDelta: input.onDelta
        ? (accumulated) => {
          const parsed = extractRemoteUtterance(accumulated)
          if (!parsed) return
          // Stream remote tokens as-is — never replace with local templates mid-turn.
          const guarded = finalizeBrainResult(
            parsed.displayText,
            parsed.spokenText,
            llm.providerId,
            'remote',
            input.facts.locale,
          )
          if (guarded.displayText !== lastEmittedDisplay) {
            lastEmittedDisplay = guarded.displayText
            input.onDelta?.({
              displayText: guarded.displayText,
              spokenText: guarded.spokenText,
              raw: accumulated,
            })
          }
        }
        : undefined,
    })
    if (result.status === 'ok' && result.text.trim()) {
      const parsed = extractRemoteUtterance(result.text)
      if (parsed) {
        return finalizeBrainResult(
          parsed.displayText,
          parsed.spokenText,
          result.providerId,
          'remote',
          input.facts.locale,
        )
      }
      // Model returned non-empty text — still pass through verbatim.
      const raw = result.text.trim()
      return finalizeBrainResult(raw, raw, result.providerId, 'remote', input.facts.locale)
    }

    // OpenAI/remote was selected — NEVER substitute local travel templates.
    return remoteUnavailableReply(input.facts.locale, llm.providerId)
  }

  // No converse() — browser still must not fall back to local templates.
  if (isBrowserTravelerPath()) {
    return remoteUnavailableReply(input.facts.locale, llm.providerId || 'openai')
  }

  const local = generateLocalConversation({
    facts: input.facts,
    userMessage,
    conversationId: input.conversationId,
  })
  return finalizeBrainResult(
    local.displayText,
    local.spokenText,
    'local',
    'local',
    input.facts.locale,
  )
}
