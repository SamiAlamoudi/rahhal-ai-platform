import { describe, it, expect } from 'vitest'
import { createChatProvider, getDefaultChatProviderType } from '../chat/chatProviderFactory'

describe('chatProviderFactory', () => {
  it('defaults to mock provider', () => {
    expect(getDefaultChatProviderType()).toBe('mock')
    expect(createChatProvider().providerId).toBe('mock')
  })
})
