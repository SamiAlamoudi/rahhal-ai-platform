/**
 * Assemble pause-split Realtime ASR segments into one committed user turn.
 * Interim / segment finals are visual only until silence commit.
 */

import {
  assessAsrCompleteness,
  normalizeArabicAsrForExtraction,
} from './arabicAsrNormalize'
import { isConfirmedUserUtterance } from './userTranscriptGate'

/**
 * Wait after last speech_stopped / segment so brief Arabic hesitations do not split turns.
 * Kept short for ChatGPT-Voice-like first-audio latency (was 1500ms — felt like a long mute).
 */
export const ARABIC_UTTERANCE_COMMIT_MS = 450

export type AssembledUtteranceCommit = {
  /** Exact ASR text for display + conversation message (never rewritten). */
  committedTranscript: string
  /** Parser-only enrichment (digits / cabin aliases). */
  normalizedForExtract: string
  audioDurationMs: number
  completionReason: 'silence_commit'
  interimTranscript: string
  conversationLanguage: string
}

export type AssembledUtteranceReject = {
  rejected: true
  reason: string
  retryMessageAr: string
  retryMessageEn: string
  transcript: string
  audioDurationMs: number
  completionReason: 'rejected_incomplete' | 'rejected_noise'
  conversationLanguage: string
}

export type ArabicUtteranceAssembler = {
  reset: () => void
  onSpeechStarted: (atMs: number) => void
  onSpeechStopped: (atMs: number) => void
  /** Visual-only interim for the current open segment. */
  onInterim: (text: string) => string
  /**
   * Append a segment final (not yet a planner commit).
   * Returns current assembled display text.
   */
  onSegmentFinal: (text: string) => string
  getDisplayText: () => string
  getAudioDurationMs: (nowMs: number) => number
  getInterimTranscript: () => string
  hasPending: () => boolean
  isCommitted: () => boolean
  /** Clear commit timer without committing (e.g. hard Stop). */
  cancelPendingCommit: () => void
  scheduleCommit: (delayMs: number) => void
}

export function createArabicUtteranceAssembler(options: {
  conversationLanguage: () => string | null
  nowMs: () => number
  onCommit: (result: AssembledUtteranceCommit) => void
  onReject: (result: AssembledUtteranceReject) => void
  commitDelayMs?: number
}): ArabicUtteranceAssembler {
  const commitDelayMs = options.commitDelayMs ?? ARABIC_UTTERANCE_COMMIT_MS
  let segments: string[] = []
  let interim = ''
  let speechOpenAt: number | null = null
  let accumulatedSpeechMs = 0
  let commitTimer: ReturnType<typeof setTimeout> | null = null
  let committed = false
  let generation = 0

  const clearTimer = () => {
    if (commitTimer) {
      clearTimeout(commitTimer)
      commitTimer = null
    }
  }

  const joinDisplay = (): string => {
    const parts = [...segments]
    const i = interim.trim()
    if (i) parts.push(i)
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }

  const durationMs = (now: number): number => {
    let total = accumulatedSpeechMs
    if (speechOpenAt != null) total += Math.max(0, now - speechOpenAt)
    return total
  }

  const flushCommit = () => {
    commitTimer = null
    if (committed) return
    const lang = options.conversationLanguage() || 'ar'
    const display = segments.join(' ').replace(/\s+/g, ' ').trim()
    const audioMs = durationMs(options.nowMs())
    interim = ''

    if (!display || !isConfirmedUserUtterance(display)) {
      options.onReject({
        rejected: true,
        reason: 'noise_or_empty',
        retryMessageAr: 'ما سمعت الطلب واضح. عِد الجملة لو سمحت.',
        retryMessageEn: 'I did not hear a clear request. Please say it again.',
        transcript: display,
        audioDurationMs: audioMs,
        completionReason: 'rejected_noise',
        conversationLanguage: lang,
      })
      segments = []
      accumulatedSpeechMs = 0
      speechOpenAt = null
      return
    }

    const verdict = assessAsrCompleteness({
      transcript: display,
      audioDurationMs: audioMs,
      conversationLanguage: lang,
    })
    if (!verdict.ok) {
      options.onReject({
        rejected: true,
        reason: verdict.reason,
        retryMessageAr: verdict.retryMessageAr,
        retryMessageEn: verdict.retryMessageEn,
        transcript: display,
        audioDurationMs: audioMs,
        completionReason: 'rejected_incomplete',
        conversationLanguage: lang,
      })
      segments = []
      accumulatedSpeechMs = 0
      speechOpenAt = null
      return
    }

    committed = true
    const gen = generation
    options.onCommit({
      committedTranscript: display,
      normalizedForExtract: normalizeArabicAsrForExtraction(display),
      audioDurationMs: audioMs,
      completionReason: 'silence_commit',
      interimTranscript: display,
      conversationLanguage: lang,
    })
    // Ready for next utterance after handoff.
    if (gen === generation) {
      segments = []
      accumulatedSpeechMs = 0
      speechOpenAt = null
      // Keep committed=true until next speech_started resets.
    }
  }

  return {
    reset() {
      generation += 1
      clearTimer()
      segments = []
      interim = ''
      speechOpenAt = null
      accumulatedSpeechMs = 0
      committed = false
    },
    onSpeechStarted(atMs) {
      clearTimer()
      if (committed) {
        segments = []
        interim = ''
        accumulatedSpeechMs = 0
        committed = false
      }
      if (speechOpenAt == null) speechOpenAt = atMs
    },
    onSpeechStopped(atMs) {
      if (speechOpenAt != null) {
        accumulatedSpeechMs += Math.max(0, atMs - speechOpenAt)
        speechOpenAt = null
      }
      if (segments.length > 0 || interim.trim()) {
        // scheduled by caller via scheduleCommit
      }
    },
    onInterim(text) {
      if (committed) return joinDisplay()
      interim = (text || '').trim()
      return joinDisplay()
    },
    onSegmentFinal(text) {
      if (committed) return joinDisplay()
      const exact = (text || '').trim()
      if (!exact) return joinDisplay()
      interim = ''
      const last = segments[segments.length - 1]
      // Avoid duplicating identical consecutive segment finals.
      if (last && last === exact) return joinDisplay()
      // If new segment is a strict extension of the last, replace.
      if (last && exact.startsWith(last) && exact.length > last.length) {
        segments[segments.length - 1] = exact
      } else if (last && last.startsWith(exact) && last.length > exact.length) {
        // Ignore shorter rewrite of the same segment.
      } else {
        segments.push(exact)
      }
      return joinDisplay()
    },
    getDisplayText: joinDisplay,
    getAudioDurationMs: durationMs,
    getInterimTranscript: () => interim,
    hasPending: () => !committed && (segments.length > 0 || Boolean(interim.trim())),
    isCommitted: () => committed,
    cancelPendingCommit() {
      clearTimer()
    },
    scheduleCommit(delayMs = commitDelayMs) {
      if (committed) return
      if (!segments.length && !interim.trim()) return
      clearTimer()
      const gen = generation
      commitTimer = setTimeout(() => {
        if (gen !== generation) return
        flushCommit()
      }, delayMs)
    },
  }
}
