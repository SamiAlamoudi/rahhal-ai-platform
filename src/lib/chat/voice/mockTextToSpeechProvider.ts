import type { TextToSpeechProvider, TextToSpeechSpeakOptions } from './voiceTypes'

export function createMockTextToSpeechProvider(options?: {
  /** Artificial speak duration (ms). Useful with fake timers. */
  delayMs?: number
}): TextToSpeechProvider & {
  spoken: string[]
  speakCalls: number
} {
  let speaking = false
  const spoken: string[] = []
  let speakCalls = 0
  const delayMs = options?.delayMs ?? 0
  let speakResolve: (() => void) | null = null

  return {
    providerId: 'mock-tts',
    spoken,
    get speakCalls() {
      return speakCalls
    },
    isSupported: () => true,
    async speak(speakOptions: TextToSpeechSpeakOptions) {
      speaking = true
      speakCalls += 1
      speakOptions.onStart?.()
      if (delayMs > 0) {
        await new Promise<void>((resolve) => {
          speakResolve = resolve
          setTimeout(() => {
            if (speakResolve === resolve) speakResolve = null
            resolve()
          }, delayMs)
        })
      }
      if (speaking) {
        spoken.push(speakOptions.text)
      }
      speaking = false
      speakResolve = null
    },
    stop() {
      speaking = false
      const resolve = speakResolve
      speakResolve = null
      resolve?.()
    },
    isSpeaking() {
      return speaking
    },
  }
}
