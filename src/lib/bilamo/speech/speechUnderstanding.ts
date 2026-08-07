/**
 * Speech understanding stage — runs before Bilamo intent extraction.
 *
 * Pipeline: transcript → language/dialect → cleanup → semantic normalize → confidence.
 * Never logs raw audio. Keeps original transcript separate from normalized text.
 */

import { resolveDestinationIdentity } from '../../agent/destinationIdentity'
import { detectArabicDialect, type ArabicDialectId } from '../../chat/voice/arabicDialectAdaptation'
import { normalizeArabicAsrForExtraction } from '../../chat/voice/arabicAsrNormalize'
import {
  detectConversationLanguage,
  resolveConversationLanguage,
  type ConversationLanguageCode,
} from '../../chat/voice/conversationLanguageLayer'
import { sanitizeArabicVoiceTranscript } from '../../chat/voice/sanitizeArabicVoiceTranscript'
import {
  coerceReplyLocale,
  type BilamoReplyLocale,
} from './localeBridge'

export type SpeechUnderstandingResult = {
  displayTranscript: string
  normalizedForExtract: string
  language: BilamoReplyLocale
  languageConfidence: number
  dialect: ArabicDialectId | null
  dialectConfidence: number
  transcriptConfidence: number
  normalizedIntent: string | null
  destinationConfidence: number
  needsDestinationConfirm: boolean
  confirmDestinationLabel: string | null
}

function cleanupForLanguage(text: string, language: BilamoReplyLocale): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  // Arabic-only sanitizer. Running it on French/English empties short Latin
  // utterances and strips valid FR tokens — root cause of FR intent loss.
  if (language === 'ar') {
    return sanitizeArabicVoiceTranscript(trimmed) || trimmed
  }
  return trimmed.replace(/\s+/g, ' ').trim()
}

function scoreTranscriptConfidence(input: {
  languageConfidence: number
  display: string
  normalized: string
  destinationConfidence: number
}): number {
  let score = input.languageConfidence * 0.45
  if (input.display.length >= 8) score += 0.15
  if (input.normalized.length >= 6) score += 0.1
  score += input.destinationConfidence * 0.3
  return Math.max(0, Math.min(1, score))
}

export function assessDestinationConfidence(raw: string | null | undefined): {
  confidence: number
  needsConfirm: boolean
  label: string | null
  identityLabel: string | null
} {
  const text = (raw || '').trim()
  if (!text) {
    return { confidence: 0, needsConfirm: false, label: null, identityLabel: null }
  }
  const identity = resolveDestinationIdentity(text)
  if (!identity) {
    return { confidence: 0, needsConfirm: false, label: null, identityLabel: null }
  }
  if (identity.country) {
    const exactish = identity.raw.length <= 28
    const confidence = exactish ? 0.92 : 0.75
    return {
      confidence,
      needsConfirm: false,
      label: identity.label,
      identityLabel: identity.label,
    }
  }
  // Unknown free-text place — confirm only when the token looks weak/garbled.
  const token = identity.label.trim()
  const weak =
    token.length < 3
    || /\d/.test(token)
    || /^(to|in|the|a|an|un|une|le|la|les|des|من|إلى|الى)$/i.test(token)
  return {
    confidence: weak ? 0.25 : 0.72,
    needsConfirm: weak,
    label: identity.label,
    identityLabel: identity.label,
  }
}

export function understandSpeechTurn(input: {
  transcript: string
  normalizedHint?: string | null
  previousLanguage?: BilamoReplyLocale | null
  languagePreference?: ConversationLanguageCode | string | null
}): SpeechUnderstandingResult {
  const raw = (input.transcript || '').trim()
  if (!raw) {
    return {
      displayTranscript: '',
      normalizedForExtract: '',
      language: input.previousLanguage ?? 'ar',
      languageConfidence: 0,
      dialect: null,
      dialectConfidence: 0,
      transcriptConfidence: 0,
      normalizedIntent: null,
      destinationConfidence: 0,
      needsDestinationConfirm: false,
      confirmDestinationLabel: null,
    }
  }

  const resolved = resolveConversationLanguage({
    preference: input.languagePreference ?? 'auto',
    utterance: raw,
    previousLanguage: input.previousLanguage === 'fr'
      ? 'fr'
      : input.previousLanguage === 'en'
        ? 'en'
        : input.previousLanguage === 'ar'
          ? 'ar'
          : null,
    fallbackPreference: input.previousLanguage === 'en' ? 'en' : 'ar',
  })
  const detected = detectConversationLanguage(raw)
  const language = coerceReplyLocale(resolved.language, input.previousLanguage ?? 'ar')
  const languageConfidence =
    resolved.source === 'explicit_switch'
      ? 1
      : resolved.source === 'preference'
        ? 0.85
        : detected.confidence

  const displayTranscript = cleanupForLanguage(raw, language)
  let normalizedForExtract =
    (input.normalizedHint || '').trim()
    || (language === 'ar'
      ? normalizeArabicAsrForExtraction(displayTranscript)
      : displayTranscript)
  if (!normalizedForExtract) normalizedForExtract = displayTranscript

  let dialect: ArabicDialectId | null = null
  let dialectConfidence = 0
  if (language === 'ar') {
    const d = detectArabicDialect(displayTranscript)
    dialect = d.dialect === 'auto' ? 'fusha' : d.dialect
    dialectConfidence = d.confidence
  }

  const fromFull = resolveDestinationIdentity(normalizedForExtract)
  const destAssess = assessDestinationConfidence(
    fromFull?.country || fromFull?.city ? fromFull.label : null,
  )

  const transcriptConfidence = scoreTranscriptConfidence({
    languageConfidence,
    display: displayTranscript,
    normalized: normalizedForExtract,
    destinationConfidence: destAssess.confidence,
  })

  return {
    displayTranscript,
    normalizedForExtract,
    language,
    languageConfidence,
    dialect,
    dialectConfidence,
    transcriptConfidence,
    normalizedIntent: destAssess.identityLabel
      ? `dest:${destAssess.identityLabel}`
      : `lang:${language}`,
    destinationConfidence: destAssess.confidence,
    needsDestinationConfirm: destAssess.needsConfirm,
    confirmDestinationLabel: destAssess.needsConfirm ? destAssess.label : null,
  }
}
