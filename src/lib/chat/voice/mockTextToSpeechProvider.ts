import type { TextToSpeechProvider, TextToSpeechSpeakOptions } from './voiceTypes'

export function createMockTextToSpeechProvider(): TextToSpeechProvider & {
  spoken: string[]
} {
  let speaking = false
  const spoken: string[] = []

  return {
    providerId: 'mock-tts',
    spoken,
    isSupported: () => true,
    async speak(options: TextToSpeechSpeakOptions) {
      speaking = true
      options.onStart?.()
      spoken.push(options.text)
      speaking = false
    },
    stop() {
      speaking = false
    },
    isSpeaking() {
      return speaking
    },
  }
}
