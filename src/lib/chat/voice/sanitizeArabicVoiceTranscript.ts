/**
 * Arabic voice transcript hygiene — display + commit path.
 * Strips English ASR pollution, dedupes interim/final overlap, protects Yemen vs Japan.
 * Context-sensitive Bilamo brand repair (بيلامو vs person بلال).
 * Never invents destinations; never logs raw audio.
 */

import { normalizeBilamoAssistantName } from './bilamoBrandAsr'

const ARABIC_RE = /[\u0600-\u06FF]/
const LATIN_WORD_RE = /[A-Za-z\u00C0-\u024F]+/g

/** English ASR junk that must never become a user turn in Arabic sessions. */
const ENGLISH_NOISE = new Set([
  'down', 'the', 'a', 'an', 'to', 'for', 'and', 'or', 'of', 'in', 'on', 'at',
  'is', 'are', 'was', 'be', 'um', 'uh', 'ah', 'oh', 'mm', 'hmm', 'yeah', 'yes',
  'no', 'ok', 'okay', 'so', 'you', 'i', 'me', 'my', 'we', 'it', 'this', 'that',
])

/**
 * Prefer Arabic destination tokens when English ASR invents a conflicting place.
 * اليمن must never become Japan.
 */
const ARABIC_DEST_PRIORITY: Array<{ ar: RegExp; enStrip: RegExp }> = [
  { ar: /اليمن|يمن(?!ان)/, enStrip: /\b(?:japan|tokyo|osaka|kyoto)\b/gi },
  { ar: /اليابان|طوكيو|اوساكا|أوساكا|كيوتو/, enStrip: /\b(?:yemen|sanaa|sana'?a)\b/gi },
]

/** Collapse duplicated consecutive phrases (interim+final append bug). */
export function collapseDuplicatedTranscript(text: string): string {
  let out = (text || '').replace(/\s+/g, ' ').trim()
  if (!out) return ''

  // Exact doubled sentence: "X X"
  const half = Math.floor(out.length / 2)
  if (out.length >= 8 && out.length % 2 === 1) {
    const left = out.slice(0, half).trim()
    const right = out.slice(half + 1).trim()
    if (left && left === right) return left
  }
  const parts = out.split(' ').filter(Boolean)
  if (parts.length >= 4 && parts.length % 2 === 0) {
    const mid = parts.length / 2
    const a = parts.slice(0, mid).join(' ')
    const b = parts.slice(mid).join(' ')
    if (a === b) return a
  }

  // "phrase phrase" with space — repeated full string
  const repeated = out.match(/^(.+?)\s+\1$/u)
  if (repeated?.[1] && repeated[1].replace(/\s/g, '').length >= 4) {
    return repeated[1].trim()
  }

  return out
}

/** Remove Latin noise tokens from Arabic turns; keep Arabic letters intact. */
export function stripEnglishTokenPollution(text: string): string {
  const raw = (text || '').trim()
  if (!raw) return ''
  const hasArabic = ARABIC_RE.test(raw)
  if (!hasArabic) {
    // Pure Latin short junk ("Down") → empty so gate rejects.
    const letters = raw.replace(/[^A-Za-z]/g, '')
    if (letters.length > 0 && letters.length <= 12) {
      const tokens = raw.toLowerCase().split(/[^a-z]+/).filter(Boolean)
      if (tokens.length > 0 && tokens.every((t) => ENGLISH_NOISE.has(t) || t.length <= 4)) {
        return ''
      }
    }
    return raw
  }

  let out = raw.replace(LATIN_WORD_RE, (word) => {
    const lower = word.toLowerCase()
    if (ENGLISH_NOISE.has(lower)) return ' '
    // Strip English place names when Arabic already names a destination.
    if (/^(japan|tokyo|osaka|kyoto|yemen|down|destination)$/i.test(word)) return ' '
    return ' '
  })
  out = out.replace(/\s+/g, ' ').trim()
  return out
}

/** Apply Arabic destination priority so Yemen is not rewritten to Japan. */
export function protectArabicDestinations(text: string): string {
  let out = text
  for (const row of ARABIC_DEST_PRIORITY) {
    if (row.ar.test(out)) {
      out = out.replace(row.enStrip, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  return out
}

/**
 * Full sanitize for Arabic voice commits / display.
 * Final replaces interim — caller must not concatenate both.
 */
export function sanitizeArabicVoiceTranscript(text: string): string {
  let out = (text || '').trim()
  if (!out) return ''
  out = collapseDuplicatedTranscript(out)
  out = stripEnglishTokenPollution(out)
  out = protectArabicDestinations(out)
  out = collapseDuplicatedTranscript(out)
  out = normalizeBilamoAssistantName(out).normalized
  return out.replace(/\s+/g, ' ').trim()
}

/** True when Arabic session should reject this as non-utterance pollution. */
export function isEnglishAsrPollution(text: string): boolean {
  const t = (text || '').trim()
  if (!t) return true
  if (ARABIC_RE.test(t)) return false
  const cleaned = stripEnglishTokenPollution(t)
  return !cleaned || cleaned.length < 2
}
