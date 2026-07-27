/**
 * Voice-output presentation + TTS sanitization.
 * Screen message stays full; TTS receives a short, clean spoken line.
 */

/** Target ~2–5 short consultant sentences for audio turns. */
export const MAX_SPOKEN_CHARS = 280
export const MAX_SPOKEN_SENTENCES = 5

const BIDI_AND_INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g

export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\(([^)]+)\)/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/www\.\S+/gi, ' ')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/^\s*[-•*]\s+/gm, '')
    .replace(/\bSAR\b|\bUSD\b|\bEUR\b|\bGBP\b/gi, ' ')
    .replace(/\d{1,3}(?:,\d{3})+(?:\.\d+)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** TTS-only cleanup — does not mutate the stored assistant message. */
export function sanitizeSpokenArabic(text: string): string {
  return stripMarkdownForSpeech(text)
    .replace(BIDI_AND_INVISIBLE, '')
    // Drop common emoji / symbol noise speech engines misread.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    // Collapse repeated punctuation.
    .replace(/([.!?؟،,])\1+/g, '$1')
    // Soften technical English labels that leak into Arabic turns.
    .replace(/\b(providerMeta|conversationId|messageId|null|undefined|true|false)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSpokenSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?؟])\s+/)
    .map((p) => p.trim())
    .filter(Boolean)
  return parts.length ? parts : (text.trim() ? [text.trim()] : [])
}

/** Keep the first N natural sentences for spoken delivery. */
export function takeSpokenSentences(text: string, max = MAX_SPOKEN_SENTENCES): string {
  const sentences = splitSpokenSentences(text)
  if (sentences.length <= max) return sentences.join(' ')
  return sentences.slice(0, max).join(' ')
}

/**
 * Prefer providerMeta.spokenText; always sanitize + shorten for TTS.
 */
export function extractSpokenAnswer(input: {
  content: string
  spokenText?: string | null
}): string {
  const meta = typeof input.spokenText === 'string' ? input.spokenText.trim() : ''
  const source = meta || input.content
  const cleaned = sanitizeSpokenArabic(source)
  return takeSpokenSentences(cleaned).slice(0, MAX_SPOKEN_CHARS)
}

/** Alias used at the voice response boundary (audio modality). */
export function prepareVoiceSpokenText(input: {
  content: string
  spokenText?: string | null
}): string {
  return extractSpokenAnswer(input)
}

/**
 * Defensive TTS watchdog duration from text length (Safari often skips onend).
 * Clamped so short lines still get a few seconds and long lines cannot hang forever.
 */
export function estimateTtsWatchdogMs(text: string): number {
  const len = text.trim().length
  const estimated = 2_500 + len * 75
  return Math.max(5_000, Math.min(75_000, Math.round(estimated)))
}
