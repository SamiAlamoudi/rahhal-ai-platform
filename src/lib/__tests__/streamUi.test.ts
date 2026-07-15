import { describe, it, expect, vi } from 'vitest'
import { createDeltaCoalescer } from '../chat/streamUi'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, status: ChatMessage['status'] = 'streaming'): ChatMessage {
  return {
    id: 'm1',
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

describe('createDeltaCoalescer', () => {
  it('coalesces rapid deltas into a single scheduled flush', () => {
    const callbacks: Array<() => void> = []
    const onFlush = vi.fn()
    const coalescer = createDeltaCoalescer(
      onFlush,
      (cb) => {
        callbacks.push(cb)
        return callbacks.length
      },
      () => {},
    )

    coalescer.push(msg('a'))
    coalescer.push(msg('ab'))
    coalescer.push(msg('abc'))
    expect(onFlush).not.toHaveBeenCalled()
    expect(callbacks).toHaveLength(1)

    callbacks[0]()
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush.mock.calls[0][0].content).toBe('abc')
  })

  it('flushNow cancels pending schedule and emits latest', () => {
    const cancelled: number[] = []
    const onFlush = vi.fn()
    const coalescer = createDeltaCoalescer(
      onFlush,
      () => 7,
      (id) => {
        cancelled.push(id)
      },
    )

    coalescer.push(msg('hello'))
    coalescer.flushNow()
    expect(cancelled).toEqual([7])
    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush.mock.calls[0][0].content).toBe('hello')
  })

  it('dispose drops pending updates', () => {
    const onFlush = vi.fn()
    const coalescer = createDeltaCoalescer(onFlush, () => 1, () => {})
    coalescer.push(msg('x'))
    coalescer.dispose()
    coalescer.flushNow()
    expect(onFlush).not.toHaveBeenCalled()
  })
})
