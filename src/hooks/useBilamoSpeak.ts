/**
 * Classic Bilamo TTS transport — interruptible, generation-tokenized.
 * Does not auto-relisten (interrupt_response contract preserved).
 * Implements BilamoVoiceTransport for a future WebRTC swap.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  preconnectOpenAiTtsRoute,
  unlockAudioPlayback,
} from '../lib/chat/voice/audioElementTextToSpeechProvider'
import { createTextToSpeechProvider } from '../lib/chat/voice/voiceProviderFactory'
import type { TextToSpeechProvider, VoiceLocale } from '../lib/chat/voice/voiceTypes'
import type {
  BilamoSpeakHandle,
  BilamoSpeakRequest,
  BilamoVoiceTransport,
} from '../lib/bilamo/voice/bilamoVoiceTransport'

export function useBilamoSpeak(): BilamoVoiceTransport & {
  /** @deprecated prefer speak({ text, locale }) handle */
  speakText: (text: string, locale?: VoiceLocale) => Promise<void>
} {
  const ttsRef = useRef<TextToSpeechProvider | null>(null)
  const speakingRef = useRef(false)
  const speakGen = useRef(0)

  useEffect(() => {
    ttsRef.current = createTextToSpeechProvider()
    try {
      preconnectOpenAiTtsRoute()
    } catch {
      /* ignore */
    }
    return () => {
      speakGen.current += 1
      speakingRef.current = false
      try {
        ttsRef.current?.stop()
      } catch {
        /* ignore */
      }
    }
  }, [])

  const stop = useCallback(() => {
    speakGen.current += 1
    speakingRef.current = false
    try {
      ttsRef.current?.stop()
    } catch {
      /* ignore */
    }
  }, [])

  const speak = useCallback((request: BilamoSpeakRequest): BilamoSpeakHandle => {
    const trimmed = request.text.trim()
    const generation = ++speakGen.current
    speakingRef.current = Boolean(trimmed)

    const done = (async () => {
      if (!trimmed) {
        if (speakGen.current === generation) speakingRef.current = false
        return
      }
      const tts = ttsRef.current
      if (!tts?.isSupported()) {
        if (speakGen.current === generation) speakingRef.current = false
        return
      }
      try {
        // Hard-stop any prior provider playback before starting a new utterance.
        try {
          tts.stop()
        } catch {
          /* ignore */
        }
        await unlockAudioPlayback().catch(() => undefined)
        if (speakGen.current !== generation) return

        const locale = request.locale
        tts.prefetch?.({
          text: trimmed,
          locale,
          dialect: locale === 'ar' ? 'saudi' : undefined,
          format: 'wav',
          speed: locale === 'ar' ? 0.98 : 1,
        })
        if (speakGen.current !== generation) return

        await tts.speak({
          text: trimmed,
          locale,
          interrupt: true,
          dialect: locale === 'ar' ? 'saudi' : undefined,
          format: 'wav',
          speed: locale === 'ar' ? 0.98 : 1,
          instructions:
            locale === 'ar'
              ? 'Speak warm Saudi-Gulf Arabic, natural consultant pacing, no theatrical accent.'
              : undefined,
        })
      } catch {
        // Soft-fail — orb state is owned by the experience via generation tokens.
      } finally {
        if (speakGen.current === generation) speakingRef.current = false
      }
    })()

    return { generation, done }
  }, [])

  const speakText = useCallback(
    async (text: string, locale: VoiceLocale = 'en') => {
      await speak({ text, locale }).done
    },
    [speak],
  )

  const isSpeaking = useCallback(() => speakingRef.current, [])

  return useMemo(
    () => ({
      kind: 'classic_tts' as const,
      speak,
      stop,
      isSpeaking,
      speakText,
    }),
    [speak, stop, isSpeaking, speakText],
  )
}
