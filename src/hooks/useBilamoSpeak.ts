/**
 * Quiet TTS helper for Bilamo conversation surface.
 * Speaks assistant spokenText after a turn; interruptible by mic / new turn.
 * Does not auto-relisten (interrupt_response contract preserved).
 */

import { useCallback, useEffect, useRef } from 'react'
import {
  preconnectOpenAiTtsRoute,
  unlockAudioPlayback,
} from '../lib/chat/voice/audioElementTextToSpeechProvider'
import { createTextToSpeechProvider } from '../lib/chat/voice/voiceProviderFactory'
import type { TextToSpeechProvider, VoiceLocale } from '../lib/chat/voice/voiceTypes'

export function useBilamoSpeak() {
  const ttsRef = useRef<TextToSpeechProvider | null>(null)
  const speakingRef = useRef(false)
  const speakGen = useRef(0)

  useEffect(() => {
    ttsRef.current = createTextToSpeechProvider()
    // Warm the audio path so the first reply feels immediate.
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

  const speak = useCallback(async (text: string, locale: VoiceLocale = 'en') => {
    const trimmed = text.trim()
    if (!trimmed) return
    const tts = ttsRef.current
    if (!tts?.isSupported()) return

    const gen = ++speakGen.current
    speakingRef.current = true
    try {
      await unlockAudioPlayback().catch(() => undefined)
      // Prefetch next chunk when the engine supports it (OpenAI audio path).
      tts.prefetch?.({
        text: trimmed,
        locale,
        dialect: locale === 'ar' ? 'saudi' : undefined,
        format: 'wav',
        speed: locale === 'ar' ? 0.98 : 1,
      })
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
      // Soft-fail — visual Orb speaking state already conveys presence.
    } finally {
      if (speakGen.current === gen) speakingRef.current = false
    }
  }, [])

  return { speak, stop, isSpeaking: () => speakingRef.current }
}
