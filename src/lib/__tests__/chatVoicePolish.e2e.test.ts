/**
 * End-to-end style coverage for text + voice polish (Phase H.5).
 * Uses mocked STT/TTS + chat engine turn sender — no browser media APIs.
 */
import { describe, it, expect, vi } from 'vitest'
import { createVoiceSession } from '../chat/voice/voiceSession'
import { createMockSpeechToTextProvider } from '../chat/voice/mockSpeechToTextProvider'
import { createMockTextToSpeechProvider } from '../chat/voice/mockTextToSpeechProvider'
import { createDeltaCoalescer } from '../chat/streamUi'
import { resolveInitialConversationId, writeStoredConversationId } from '../chat/chatRecovery'
import { isBenignChatError } from '../chat/chatLogger'
import type { ChatMessage } from '../chat/chatTypes'

function assistant(content: string, status: ChatMessage['status'] = 'complete'): ChatMessage {
  return {
    id: 'a1',
    conversationId: 'c1',
    role: 'assistant',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status,
    error: null,
    providerMeta: {},
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
  }
}

describe('chat & voice polish e2e-style', () => {
  it('streams text deltas smoothly then recovers conversation selection after refresh', () => {
    const rendered: string[] = []
    const scheduled: Array<() => void> = []
    const coalescer = createDeltaCoalescer(
      (m) => {
        rendered.push(m.content)
      },
      (cb) => {
        scheduled.push(cb)
        return scheduled.length
      },
      () => {},
    )

    coalescer.push(assistant('مر', 'streaming'))
    coalescer.push(assistant('مرحبا', 'streaming'))
    scheduled[0]?.()
    expect(rendered).toEqual(['مرحبا'])

    const storage = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null
      },
      setItem(key: string, value: string) {
        this.store[key] = value
      },
      removeItem(key: string) {
        delete this.store[key]
      },
    }
    writeStoredConversationId('c-saved', storage)
    const recovered = resolveInitialConversationId({
      search: '',
      availableIds: ['c-other', 'c-saved'],
      storage,
    })
    expect(recovered).toBe('c-saved')
  })

  it('voice turn plays reply and treats interrupt as benign', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('أحتاج فندق في الرياض')
    const tts = createMockTextToSpeechProvider()
    const errors: string[] = []

    const sendTurn = vi.fn(async (_input, handlers) => {
      const reply = assistant('خطة لزيارة الرياض')
      handlers.onDelta?.(assistant('خطة', 'streaming'))
      await handlers.onComplete?.(reply)
      return {
        user: { ...reply, id: 'u1', role: 'user' as const, modality: 'audio' as const, content: 'أحتاج فندق في الرياض' },
        assistant: reply,
      }
    })

    const session = createVoiceSession({
      stt,
      tts,
      sendTurn: sendTurn as never,
      requestPermission: async () => ({ state: 'granted', error: null }),
      callbacks: {
        onError: (e) => errors.push(e),
      },
    })

    await session.startPushToTalk()
    const reply = await session.stopPushToTalkAndSend('c1')
    expect(reply?.content).toContain('الرياض')
    expect(tts.spoken.some((t) => t.includes('الرياض'))).toBe(true)

    session.interrupt()
    expect(errors.filter((e) => !isBenignChatError(e))).toHaveLength(0)
    session.dispose()
    expect(stt.onPartial).toBeUndefined()
  })

  it('hands-free resumes listening after idle interrupt', async () => {
    const { provider: stt } = createMockSpeechToTextProvider('')
    const tts = createMockTextToSpeechProvider()
    const statuses: string[] = []
    const session = createVoiceSession({
      stt,
      tts,
      requestPermission: async () => ({ state: 'granted', error: null }),
      callbacks: { onStatus: (s) => statuses.push(s) },
    })

    vi.useFakeTimers()
    await session.startHandsFree('c1')
    expect(session.getStatus()).toBe('listening')
    session.interrupt(undefined, { resumeHandsFree: true })
    const { HANDS_FREE_LISTEN_RESTART_MS } = await import('../chat/voice/voiceSession')
    await vi.advanceTimersByTimeAsync(HANDS_FREE_LISTEN_RESTART_MS)
    expect(session.getStatus()).toBe('listening')
    expect(statuses).toContain('reconnecting')
    session.dispose()
    vi.useRealTimers()
  })
})
