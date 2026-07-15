import { describe, it, expect, vi, afterEach } from 'vitest'
import { isBenignChatError, logChat, logChatError } from '../chat/chatLogger'

describe('chatLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('classifies cancelled/aborted interruptions as benign', () => {
    expect(isBenignChatError('cancelled')).toBe(true)
    expect(isBenignChatError(new Error('aborted'))).toBe(true)
    expect(isBenignChatError('تم إيقاف التوليد')).toBe(true)
    expect(isBenignChatError('network down')).toBe(false)
  })

  it('logs benign errors at debug and real errors at error', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    logChatError('scope', new Error('cancelled'))
    logChatError('scope', new Error('boom'), { conversationId: 'c1' })
    expect(debug).toHaveBeenCalled()
    expect(error).toHaveBeenCalled()
    logChat('warn', 'scope', 'attention')
  })
})
