import type {
  SpeechRecognitionResultEvent,
  SpeechToTextProvider,
  SpeechToTextStartOptions,
} from './voiceTypes'

export interface MockSpeechToTextController {
  emitPartial: (transcript: string) => void
  emitFinal: (transcript: string) => void
  emitError: (error: string) => void
  emitEnd: () => void
}

export function createMockSpeechToTextProvider(
  scriptedFinal = 'أريد رحلة إلى دبي',
): { provider: SpeechToTextProvider; controller: MockSpeechToTextController } {
  let listening = false
  let lastTranscript = ''
  let options: SpeechToTextStartOptions | null = null

  const provider: SpeechToTextProvider = {
    providerId: 'mock-stt',
    isSupported: () => true,
    async start(next) {
      listening = true
      options = next
      lastTranscript = ''
    },
    async stop() {
      listening = false
      const transcript = lastTranscript || scriptedFinal
      lastTranscript = transcript
      provider.onFinal?.({ transcript, isFinal: true })
      provider.onEnd?.()
      return transcript
    },
    abort() {
      listening = false
      provider.onEnd?.()
    },
  }

  const controller: MockSpeechToTextController = {
    emitPartial(transcript) {
      if (!listening) return
      lastTranscript = transcript
      const event: SpeechRecognitionResultEvent = { transcript, isFinal: false }
      provider.onPartial?.(event)
    },
    emitFinal(transcript) {
      if (!listening && !options) return
      lastTranscript = transcript
      provider.onFinal?.({ transcript, isFinal: true })
    },
    emitError(error) {
      provider.onError?.(error)
    },
    emitEnd() {
      listening = false
      provider.onEnd?.()
    },
  }

  return { provider, controller }
}
