import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getVoiceMeterLevel,
  resetVoiceMeterLevel,
  setVoiceMeterLevel,
  subscribeVoiceMeter,
} from '../chat/voice/voiceMeterStore'
import { MESSAGE_LIST_VIRTUALIZE_AFTER } from '../../components/chat/experience/VirtualizedMessageList'
import {
  RECOVERY_VOICE_INTERRUPT_RESPONSE,
  RECOVERY_VOICE_MIC_AFTER_REPLY,
} from '../recovery/freeze'
import { buildRealtimeTurnDetection, buildServerVadFallback } from '../chat/voice/realtimeTurnConfig'

describe('Sprint 80 P1-5 — voice meter store', () => {
  beforeEach(() => {
    resetVoiceMeterLevel()
  })

  it('clamps and publishes level updates', () => {
    const seen: number[] = []
    const unsub = subscribeVoiceMeter(() => {
      seen.push(getVoiceMeterLevel())
    })
    setVoiceMeterLevel(0.5)
    setVoiceMeterLevel(0.5) // no-op duplicate
    setVoiceMeterLevel(2)
    setVoiceMeterLevel(-1)
    unsub()
    expect(seen).toEqual([0.5, 1, 0])
  })

  it('keeps an honest virtualization threshold (short chats fully mounted)', () => {
    expect(MESSAGE_LIST_VIRTUALIZE_AFTER).toBe(40)
  })

  it('isolates meter ticks from ChatPage React state (no full-tree re-render owner)', () => {
    const chatPage = readFileSync(resolve(__dirname, '../../pages/ChatPage.tsx'), 'utf8')
    expect(chatPage).toContain('setVoiceMeterLevel')
    expect(chatPage).toContain('useVoiceMeterLevel')
    expect(chatPage).not.toMatch(/\buseState\s*<[^>]*>\s*\(\s*0\s*\)/)
    expect(chatPage).not.toMatch(/\bvoiceLevel\b/)
    expect(chatPage).not.toMatch(/\bsetVoiceLevel\b/)
    expect(chatPage).toContain('const renderMessage = useCallback')
  })

  it('memoizes MessageBubble', () => {
    const bubble = readFileSync(
      resolve(__dirname, '../../components/chat/MessageBubble.tsx'),
      'utf8',
    )
    expect(bubble).toMatch(/export default memo\(function MessageBubble/)
  })
})

describe('Sprint 80 P1-6 — TTS unlock does not synthesize warm speech', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('source no longer POSTs مرحبا warmup', () => {
    const file = readFileSync(
      resolve(__dirname, '../chat/voice/audioElementTextToSpeechProvider.ts'),
      'utf8',
    )
    expect(file).toContain('preconnectOpenAiTtsRoute')
    expect(file).not.toContain("text: 'مرحبا'")
    expect(file).not.toContain('openai_tts_warmup_ok')
  })

  it('call sites only invoke unlockAudioPlayback (no local مرحبا TTS warm POST)', () => {
    const home = readFileSync(
      resolve(__dirname, '../../components/home/HomeVoiceConsultant.tsx'),
      'utf8',
    )
    const session = readFileSync(
      resolve(__dirname, '../chat/voice/voiceSession.ts'),
      'utf8',
    )
    expect(home).toContain('unlockAudioPlayback')
    expect(session).toContain('unlockAudioPlayback')
    expect(home).not.toContain("text: 'مرحبا'")
    expect(session).not.toContain("text: 'مرحبا'")
  })

  it('unlockAudioPlayback never POSTs /api/openai/tts', async () => {
    class FakeAudio {
      src = ''
      volume = 1
      preload = ''
      currentTime = 0
      setAttribute() {}
      async play() {
        return undefined
      }
      pause() {}
    }
    vi.stubGlobal('Audio', FakeAudio)
    vi.stubGlobal('speechSynthesis', {
      resume() {},
      cancel() {},
      speak() {},
    })
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      volume = 1
      constructor(_text?: string) {}
    })

    const calls: Array<{ url: string; method: string }> = []
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: String(init?.method ?? 'GET').toUpperCase(),
      })
      return new Response(null, { status: 204 })
    })

    const { unlockAudioPlayback } = await import('../chat/voice/audioElementTextToSpeechProvider')
    await unlockAudioPlayback()
    await new Promise((r) => setTimeout(r, 40))

    const ttsPosts = calls.filter(
      (c) => c.url.includes('/api/openai/tts') && c.method === 'POST',
    )
    expect(ttsPosts).toEqual([])
  })
})

describe('Sprint 80 P1-7 — doc/code voice freeze alignment', () => {
  it('matches Realtime turn config to recovery freeze constants', () => {
    expect(RECOVERY_VOICE_MIC_AFTER_REPLY).toBe('idle')
    expect(RECOVERY_VOICE_INTERRUPT_RESPONSE).toBe(false)
    expect(buildRealtimeTurnDetection().interrupt_response).toBe(false)
    expect(buildServerVadFallback().interrupt_response).toBe(false)
  })

  it('ARCHITECTURE doc states IDLE after reply (no auto-relisten)', () => {
    const file = readFileSync(
      resolve(__dirname, '../../../docs/ARCHITECTURE_CONVERSATION_FIRST.md'),
      'utf8',
    )
    expect(file).toMatch(/mic stays IDLE/i)
    expect(file).toMatch(/interrupt_response:\s*false/)
    expect(file).toMatch(/no auto-relisten/i)
  })

  it('AGENTS.md documents IDLE mic after assistant reply', () => {
    const file = readFileSync(resolve(__dirname, '../../../AGENTS.md'), 'utf8')
    expect(file).toMatch(/IDLE/)
    expect(file).toMatch(/interrupt_response:\s*false/)
  })
})
