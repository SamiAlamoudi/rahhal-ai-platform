import { describe, it, expect } from 'vitest'
import { createChatProvider, getDefaultChatProviderType } from '../chat/chatProviderFactory'

describe('chatProviderFactory', () => {
  it('respects VITE_CHAT_PROVIDER=mock in test env', () => {
    expect(getDefaultChatProviderType()).toBe('mock')
    expect(createChatProvider('mock').providerId).toBe('mock')
  })

  it('creates travel-agent provider when requested', () => {
    expect(createChatProvider('travel-agent').providerId).toBe('travel-agent')
  })
})
