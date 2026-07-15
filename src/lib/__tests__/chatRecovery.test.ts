import { describe, it, expect } from 'vitest'
import {
  buildChatSearch,
  conversationIdFromSearch,
  readStoredConversationId,
  resolveInitialConversationId,
  writeStoredConversationId,
} from '../chat/chatRecovery'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  }
}

describe('chatRecovery', () => {
  it('reads and writes active conversation id', () => {
    const storage = memoryStorage()
    expect(readStoredConversationId(storage)).toBeNull()
    writeStoredConversationId('c-1', storage)
    expect(readStoredConversationId(storage)).toBe('c-1')
    writeStoredConversationId(null, storage)
    expect(readStoredConversationId(storage)).toBeNull()
  })

  it('parses conversation id from search and builds query string', () => {
    expect(conversationIdFromSearch('?conversation=abc&x=1')).toBe('abc')
    expect(conversationIdFromSearch('conversation=abc')).toBe('abc')
    expect(conversationIdFromSearch('')).toBeNull()
    expect(buildChatSearch('c2', '?foo=1')).toBe('?foo=1&conversation=c2')
    expect(buildChatSearch(null, '?conversation=c2&foo=1')).toBe('?foo=1')
  })

  it('prefers URL id, then storage, then first available', () => {
    const storage = memoryStorage({ 'rahhal.chat.activeConversationId': 'stored' })
    expect(resolveInitialConversationId({
      search: '?conversation=from-url',
      availableIds: ['stored', 'from-url', 'other'],
      storage,
    })).toBe('from-url')

    expect(resolveInitialConversationId({
      search: '',
      availableIds: ['stored', 'other'],
      storage,
    })).toBe('stored')

    expect(resolveInitialConversationId({
      search: '?conversation=missing',
      availableIds: ['a', 'b'],
      storage: memoryStorage(),
    })).toBe('a')

    expect(resolveInitialConversationId({
      search: '',
      availableIds: [],
      storage: memoryStorage(),
    })).toBeNull()
  })
})
