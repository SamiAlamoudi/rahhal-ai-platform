import type { TextToSpeechProvider, TextToSpeechSpeakOptions } from './voiceTypes'

export function createMockTextToSpeechProvider(options?: {
  /** Artificial speak duration (ms). Useful with fake timers. */
  delayMs?: number
  /** If true, speak() never resolves until stop() — for watchdog tests. */
  hangUntilStop?: boolean
}): TextToSpeechProvider & {
  spoken: string[]
  speakCalls: number
} {
  let speaking = false
  const spoken: string[] = []
  let speakCalls = 0
  const delayMs = options?.delayMs ?? 0
  const hangUntilStop = options?.hangUntilStop ?? false
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
      if (hangUntilStop) {
        await new Promise<void>((resolve) => {
          speakResolve = () => {
            speakOptions.onEnd?.()
            resolve()
          }
        })
        speaking = false
        speakResolve = null
        return
      }
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
        speakOptions.onEnd?.()
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
