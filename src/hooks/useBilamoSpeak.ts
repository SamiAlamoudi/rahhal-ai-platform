/**
 * Classic Bilamo TTS helper — thin React wrapper over ClassicTransport.
 * Prefer useBilamoVoiceSession for product surfaces (shared duplex session).
 */

import { useEffect, useMemo, useRef } from 'react'
import { createClassicBilamoTransport } from '../lib/bilamo/voice/classicTransport'
import type {
  BilamoSpeakHandle,
  BilamoSpeakRequest,
  BilamoVoiceTransport,
} from '../lib/bilamo/voice/bilamoVoiceTransport'
import type { VoiceLocale } from '../lib/chat/voice/voiceTypes'

export function useBilamoSpeak(): BilamoVoiceTransport & {
  /** @deprecated prefer speak({ text, locale }) handle */
  speakText: (text: string, locale?: VoiceLocale) => Promise<void>
} {
  const transportRef = useRef<BilamoVoiceTransport | null>(null)
  if (!transportRef.current) {
    transportRef.current = createClassicBilamoTransport()
  }

  useEffect(() => {
    const t = transportRef.current
    void t?.connect()
    return () => {
      t?.dispose()
      transportRef.current = null
    }
  }, [])

  return useMemo(() => {
    const t = transportRef.current!
    return {
      ...t,
      speakText: async (text: string, locale: VoiceLocale = 'en') => {
        await t.speak({ text, locale }).done
      },
      // Bind methods so spreading keeps `this`-free call sites working.
      speak: (request: BilamoSpeakRequest): BilamoSpeakHandle => t.speak(request),
      stop: () => t.stop(),
      interrupt: () => t.interrupt(),
      isSpeaking: () => t.isSpeaking(),
      isListening: () => t.isListening(),
      isConnected: () => t.isConnected(),
      getConnectionState: () => t.getConnectionState(),
      connect: () => t.connect(),
      disconnect: () => t.disconnect(),
      startListening: (locale?: VoiceLocale) => t.startListening(locale),
      stopListening: () => t.stopListening(),
      setCallbacks: (cb) => t.setCallbacks(cb),
      dispose: () => t.dispose(),
      kind: 'classic_tts' as const,
    }
  }, [])
}
