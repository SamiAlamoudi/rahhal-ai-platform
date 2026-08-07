/**
 * Direct audible-output probe — bypasses STT / conversation / cards.
 * Used by /voice-diagnostics "اختبار الصوت" only.
 */

import {
  getSharedAudioContextState,
  obtainPrimedTtsPlaybackElement,
  unlockAudioPlayback,
} from '../../chat/voice/audioElementTextToSpeechProvider'
import { voiceAuthenticatedFetch } from '../../security/voiceAuthProbe'

export const DIRECT_AUDIO_PROBE_TEXT =
  'مرحباً، أنا بيلامو. اختبار الصوت يعمل بنجاح.'

export type DirectAudioProbeResult = {
  correlationId: string
  stage: string
  httpStatus: number | null
  contentType: string | null
  bytes: number
  audioContextState: string | null
  playCalled: boolean
  playResult: 'resolved' | 'rejected' | 'pending' | null
  playError: string | null
  playingEvent: boolean
  timeupdateSeen: boolean
  maxCurrentTime: number
  ended: boolean
  elementReadyState: number | null
  elementPaused: boolean | null
  elementMuted: boolean | null
  elementVolume: number | null
  result: 'AUDIBLE_PIPELINE_CONFIRMED' | 'VOICE_OUTPUT_FAILED'
  failureStage: string | null
}

function newCorrelationId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `probe_${Date.now()}`
  }
}

/**
 * Request classic OpenAI TTS for a fixed Arabic sentence and play it.
 * Must be invoked from a user gesture (button tap).
 */
export async function runDirectAudioProbe(): Promise<DirectAudioProbeResult> {
  const correlationId = newCorrelationId()
  const out: DirectAudioProbeResult = {
    correlationId,
    stage: 'unlock',
    httpStatus: null,
    contentType: null,
    bytes: 0,
    audioContextState: null,
    playCalled: false,
    playResult: null,
    playError: null,
    playingEvent: false,
    timeupdateSeen: false,
    maxCurrentTime: 0,
    ended: false,
    elementReadyState: null,
    elementPaused: null,
    elementMuted: null,
    elementVolume: null,
    result: 'VOICE_OUTPUT_FAILED',
    failureStage: null,
  }

  try {
    await unlockAudioPlayback()
    out.audioContextState = getSharedAudioContextState()
    out.stage = 'tts_request'

    const res = await voiceAuthenticatedFetch('/api/openai/tts', {
      method: 'POST',
      kind: 'tts',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: DIRECT_AUDIO_PROBE_TEXT,
        locale: 'ar',
        voice: 'marin',
        format: 'wav',
        speed: 1,
        instructions:
          'Speak naturally in clear Arabic as Bilamo. Warm, confident, concise.',
      }),
    })

    out.httpStatus = res.status
    out.contentType = res.headers.get('content-type')
    if (!res.ok) {
      out.failureStage = `tts_http_${res.status}`
      out.stage = 'tts_http_failed'
      return out
    }

    const blob = await res.blob()
    out.bytes = blob.size
    out.stage = 'blob_received'
    if (blob.size < 64) {
      out.failureStage = 'zero_byte_tts'
      return out
    }
    const mime = (out.contentType || blob.type || '').toLowerCase()
    if (mime && !mime.includes('audio') && !mime.includes('octet-stream') && !mime.includes('wav')) {
      out.failureStage = `wrong_mime:${mime}`
      return out
    }

    out.stage = 'play'
    // Use the same gesture-primed TTS element as production — a fresh <audio>
    // stays locked on iPhone Safari even after unlockAudioPlayback().
    const audio = obtainPrimedTtsPlaybackElement()
    const objectUrl = URL.createObjectURL(blob)
    audio.src = objectUrl
    audio.muted = false
    audio.volume = 1
    out.elementMuted = audio.muted
    out.elementVolume = audio.volume

    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        out.elementReadyState = audio.readyState
        out.elementPaused = audio.paused
        out.elementMuted = audio.muted
        out.elementVolume = audio.volume
        out.audioContextState = getSharedAudioContextState()
        try {
          audio.pause()
          URL.revokeObjectURL(objectUrl)
          // Keep primed element in DOM; clear src for next turn.
          audio.removeAttribute('src')
          audio.load()
        } catch {
          // ignore
        }
        resolve()
      }

      audio.onplaying = () => {
        out.playingEvent = true
      }
      audio.ontimeupdate = () => {
        out.timeupdateSeen = true
        if (audio.currentTime > out.maxCurrentTime) out.maxCurrentTime = audio.currentTime
      }
      audio.onended = () => {
        out.ended = true
        done()
      }
      audio.onerror = () => {
        out.playResult = 'rejected'
        out.playError = 'element_error'
        out.failureStage = 'element_error'
        done()
      }

      out.playCalled = true
      out.playResult = 'pending'
      const attempt = audio.play()
      if (attempt && typeof attempt.then === 'function') {
        attempt
          .then(() => {
            out.playResult = 'resolved'
            // Wait for progression or end; hard cap 8s.
            window.setTimeout(() => {
              if (!settled) {
                if (out.maxCurrentTime > 0.05 || out.playingEvent) {
                  out.ended = out.ended || audio.ended
                } else {
                  out.failureStage = 'no_currentTime_progression'
                }
                done()
              }
            }, 8000)
          })
          .catch((err: unknown) => {
            out.playResult = 'rejected'
            out.playError = err instanceof Error ? err.name : 'play_rejected'
            out.failureStage = `play_rejected:${out.playError}`
            done()
          })
      } else {
        out.failureStage = 'play_unsupported'
        done()
      }
    })

    const progressed = out.playingEvent || out.maxCurrentTime > 0.05 || out.ended
    if (out.playResult === 'resolved' && progressed) {
      out.result = 'AUDIBLE_PIPELINE_CONFIRMED'
      out.failureStage = null
      out.stage = 'confirmed'
    } else if (!out.failureStage) {
      out.failureStage = 'playback_unconfirmed'
      out.stage = 'failed'
    }
    return out
  } catch (err) {
    out.failureStage = err instanceof Error ? err.message.slice(0, 80) : 'probe_exception'
    out.stage = 'exception'
    out.audioContextState = getSharedAudioContextState()
    return out
  }
}

/** Pure helpers for regression tests. */
export function classifyTtsProbeHttp(status: number, bytes: number, contentType: string | null): string {
  if (status === 401 || status === 403) return `tts_http_${status}`
  if (status >= 500) return `tts_http_${status}`
  if (status !== 200) return `tts_http_${status}`
  if (bytes < 64) return 'zero_byte_tts'
  const mime = (contentType || '').toLowerCase()
  if (mime && !mime.includes('audio') && !mime.includes('octet-stream') && !mime.includes('wav')) {
    return `wrong_mime:${mime}`
  }
  return 'ok'
}

export function shouldConfirmAudible(input: {
  playResult: DirectAudioProbeResult['playResult']
  playingEvent: boolean
  maxCurrentTime: number
  ended: boolean
}): boolean {
  if (input.playResult !== 'resolved') return false
  return input.playingEvent || input.maxCurrentTime > 0.05 || input.ended
}
