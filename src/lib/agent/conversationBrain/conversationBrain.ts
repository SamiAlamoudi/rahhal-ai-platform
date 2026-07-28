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
import {
  hasConfirmedHardFacts,
  isGreetingOnly,
  replyInventedTravelFacts,
} from './greetingGuard'
import { toSpokenDialogue } from '../../chat/voice/spokenDialoguePostProcessor'

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

/** Remote OpenAI: display verbatim; spoken path → short spoken dialogue. */
function passthroughSpokenText(spoken: string, displayFallback: string, locale?: string): string {
  const raw = (spoken || displayFallback || '').trim()
  if (!raw) return ''
  const stripped = stripMarkdownForSpeech(raw) || raw
  return toSpokenDialogue(stripped, {
    locale: locale === 'en' ? 'en' : 'ar',
    maxChars: 220,
  })
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

function buildTripStateJson(facts: TravelFacts, groundedEmpty: boolean): string {
  return JSON.stringify(
    {
      locale: facts.locale,
      objective: facts.objective,
      known: facts.known,
      missingSlots: facts.missingSlots,
      plan: groundedEmpty ? null : (facts.plan ?? null),
      planningDraft: groundedEmpty ? null : (facts.planningDraft ?? null),
      warnings: groundedEmpty ? [] : (facts.warnings ?? []),
      recommendations: groundedEmpty ? [] : (facts.recommendations ?? []),
      optionHints: groundedEmpty ? [] : (facts.optionHints ?? []),
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

function safeGreetingReply(locale: string | undefined): ConversationBrainResult {
  const ar = locale !== 'en'
  const text = ar
    ? 'وعليكم السلام، حياك الله. وين حاب تسافر؟'
    : 'Hello — welcome. Where would you like to travel?'
  return { displayText: text, spokenText: text, providerId: 'openai+grounded' }
}

function isGroundedEmptyGreeting(userMessage: string, facts: TravelFacts): boolean {
  return isGreetingOnly(userMessage) && !hasConfirmedHardFacts(facts.known)
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
      spokenText: passthroughSpokenText(spokenRaw, displayRaw, locale),
      providerId,
    }
  }

  return {
    displayText: optimizeDisplayText(displayRaw, locale),
    spokenText: toSpokenDialogue(
      optimizeSpokenText(spokenRaw, displayRaw, locale),
      { locale: locale === 'en' ? 'en' : 'ar', maxChars: 220 },
    ),
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
  /** Speaking style only — never travel slot assumptions. */
  voiceStyleNote?: string | null
  signal?: AbortSignal
  onDelta?: (partial: ConversationBrainDelta) => void
}): Promise<ConversationBrainResult> {
  const userMessage = latestUserText(input.messages)
  const groundedEmpty = isGroundedEmptyGreeting(userMessage, input.facts)
  const factsForModel: TravelFacts = groundedEmpty
    ? {
      ...input.facts,
      objective: 'greet_or_continue',
      optionHints: undefined,
      recommendations: undefined,
      warnings: undefined,
      planningDraft: undefined,
      plan: undefined,
    }
    : input.facts
  const factsJson = JSON.stringify(factsForModel, null, 2)
  const history = groundedEmpty
    ? '(start of conversation)'
    : historyLines(input.messages)
  const payload = buildConversationUserPayload({
    objective: factsForModel.objective,
    factsJson,
    tripStateJson: buildTripStateJson(factsForModel, groundedEmpty),
    memoryJson: buildMemoryJson(factsForModel),
    recentHistory: history,
    userProfileJson: groundedEmpty
      ? undefined
      : (input.userProfile ? JSON.stringify(input.userProfile) : undefined),
    voiceStyleNote: input.voiceStyleNote?.trim() || undefined,
    currentUserMessage: userMessage,
    groundingNote: groundedEmpty
      ? 'Greeting-only turn with empty known slots. Reply with a brief greeting and ONE neutral destination question only. Inventing budget, travelers, destination, dates, or itinerary is forbidden.'
      : undefined,
  })

  const llm = input.llms.getActive()

  // Browser traveler path must never hear local canned Arabic templates —
  // except a grounded empty greeting may use the safe greeting when offline.
  if (llm.providerId === 'local') {
    if (groundedEmpty) {
      const safe = safeGreetingReply(input.facts.locale)
      input.onDelta?.({
        displayText: safe.displayText,
        spokenText: safe.spokenText,
        raw: safe.displayText,
      })
      return { ...safe, providerId: 'local' }
    }
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
      temperature: groundedEmpty ? 0.4 : 0.85,
      stream: true,
      onDelta: input.onDelta
        ? (accumulated) => {
          const parsed = extractRemoteUtterance(accumulated)
          if (!parsed) return
          // Stream remote tokens as-is — never replace with local templates mid-turn.
          // Greeting grounding enforcement happens only on the final complete reply.
          if (groundedEmpty && replyInventedTravelFacts(parsed.displayText).length > 0) {
            return
          }
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
        if (groundedEmpty && replyInventedTravelFacts(parsed.displayText).length > 0) {
          if (typeof console !== 'undefined') {
            console.warn('[rahhal] greeting_hallucination_blocked', {
              invented: replyInventedTravelFacts(parsed.displayText),
            })
          }
          const safe = safeGreetingReply(input.facts.locale)
          input.onDelta?.({
            displayText: safe.displayText,
            spokenText: safe.spokenText,
            raw: safe.displayText,
          })
          return safe
        }
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
      if (groundedEmpty && replyInventedTravelFacts(raw).length > 0) {
        return safeGreetingReply(input.facts.locale)
      }
      return finalizeBrainResult(raw, raw, result.providerId, 'remote', input.facts.locale)
    }

    // OpenAI/remote was selected — NEVER substitute local travel templates.
    const unavailable = remoteUnavailableReply(input.facts.locale, llm.providerId)
    if (typeof console !== 'undefined') {
      console.warn('[rahhal] openai_conversation_unavailable', {
        providerId: unavailable.providerId,
        status: result.status,
        error: 'error' in result ? result.error : undefined,
      })
    }
    return unavailable
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
