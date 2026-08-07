import { describe, expect, it } from 'vitest'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import type { BilamoVoiceTransport } from '../bilamo/voice/bilamoVoiceTransport'
import { greetingForHour, resolveDisplayName } from '../../design-system/greeting'

/**
 * Voice stabilization contracts for Bilamo classic TTS transport.
 * Realtime WebRTC will implement the same BilamoVoiceTransport surface.
 */

function makeTransport(): BilamoVoiceTransport & {
  spoken: string[]
  stopped: number
} {
  const mock = createMockTextToSpeechProvider()
  let gen = 0
  let speaking = false
  let stopped = 0
  const spoken: string[] = []

  return {
    kind: 'classic_tts',
    spoken,
    get stopped() {
      return stopped
    },
    speak({ text, locale }) {
      const generation = ++gen
      speaking = true
      // Interrupt prior: mock stop increments
      mock.stop()
      stopped += 1
      const done = (async () => {
        if (!text.trim()) {
          speaking = false
          return
        }
        await mock.speak({ text, locale, interrupt: true })
        spoken.push(text)
        if (gen === generation) speaking = false
      })()
      return { generation, done }
    },
    stop() {
      gen += 1
      speaking = false
      mock.stop()
      stopped += 1
    },
    isSpeaking() {
      return speaking
    },
  }
}

describe('Bilamo voice stabilization', () => {
  it('send-equivalent stop increments generation so stale TTS cannot reclaim speaking', async () => {
    const t = makeTransport()
    const first = t.speak({ text: 'Hello Japan', locale: 'en' })
    t.stop() // barge-in before done
    await first.done
    expect(t.isSpeaking()).toBe(false)
    expect(t.stopped).toBeGreaterThanOrEqual(2)
  })

  it('newer speak supersedes prior utterance without overlapping ownership', async () => {
    const t = makeTransport()
    const a = t.speak({ text: 'First reply', locale: 'en' })
    const b = t.speak({ text: 'Second reply', locale: 'en' })
    expect(b.generation).toBeGreaterThan(a.generation)
    await Promise.all([a.done, b.done])
    expect(t.spoken.at(-1)).toMatch(/Second/)
    expect(t.isSpeaking()).toBe(false)
  })

  it('transport never auto-reopens listening — speak completion leaves idle ownership to UI', async () => {
    const t = makeTransport()
    const handle = t.speak({ text: 'Done', locale: 'en' })
    await handle.done
    // No listen() API on transport — contract is speak/stop only.
    expect('listen' in t).toBe(false)
    expect(t.kind).toBe('classic_tts')
  })
})

describe('Bilamo greeting locale consistency', () => {
  it('does not mix English greeting with Arabic demo names', () => {
    const name = resolveDisplayName(
      { email: 'demo@example.com', user_metadata: { full_name: 'مستخدم تجريبي' } },
      'en',
    )
    expect(name).toBe('demo')
    const g = greetingForHour(23, name, 'en')
    expect(g).toMatch(/^Good night,/)
    expect(/[\u0600-\u06FF]/.test(g)).toBe(false)
  })

  it('uses Arabic greeting when locale is ar', () => {
    const g = greetingForHour(9, 'سامي', 'ar')
    expect(g).toMatch(/صباح الخير/)
    expect(g).toContain('سامي')
  })
})
